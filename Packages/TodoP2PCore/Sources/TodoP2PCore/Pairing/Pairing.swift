import AutomergeRepo
import Foundation
import Security

public enum WorkspaceIdentity {
    public static func validate(_ value: String) -> DocumentId? {
        guard (20...28).contains(value.utf8.count),
              value.utf8.allSatisfy({ "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".utf8.contains($0) }) else { return nil }
        return DocumentId(value)
    }
}

public enum PairingError: Error, LocalizedError {
    case invalidPayload, unavailable, corruptCredential, differentPairing, duplicate, randomFailure, signingConfiguration

    public var errorDescription: String? {
        switch self {
        case .invalidPayload: "This is not a supported pairing code."
        case .signingConfiguration: "This app’s signing configuration does not permit secure Keychain storage."
        case .unavailable: "Keychain access failed. Unlock this device and retry."
        case .corruptCredential: "Stored pairing cannot be read. It has been preserved."
        case .differentPairing: "Forget the existing pairing before accepting a different code."
        case .duplicate: "Pairing changed during this operation. Retry."
        case .randomFailure: "Could not generate secure pairing credentials. Retry."
        }
    }
}

public struct PairingPayload: Codable, Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    public let version: Int
    public let documentID: String
    private let secret: Data
    public var description: String { "PairingPayload(redacted)" }
    public var debugDescription: String { description }

    public init(documentID: String, secret: Data) throws {
        guard WorkspaceIdentity.validate(documentID) != nil, secret.count == 32 else { throw PairingError.invalidPayload }
        version = 1
        self.documentID = documentID
        self.secret = secret
    }

    public static func decode(_ text: String) throws -> Self {
        guard text.utf8.count <= 1024, let bytes = text.data(using: .utf8),
              let value = try? JSONDecoder().decode(Self.self, from: bytes), value.version == 1 else { throw PairingError.invalidPayload }
        return try Self(documentID: value.documentID, secret: value.secret)
    }

    public func encoded() throws -> String {
        String(decoding: try JSONEncoder().encode(self), as: UTF8.self)
    }
}

public struct PairingRecord: Codable, Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    public enum Role: String, Codable, Sendable { case owner, pendingInitialSync }
    public let payload: PairingPayload
    public let role: Role
    public var description: String { "PairingRecord(redacted)" }
    public var debugDescription: String { description }
    public init(payload: PairingPayload, role: Role) { self.payload = payload; self.role = role }
}

public protocol PairingCredentialStore {
    func load() throws -> PairingRecord?
    func add(_ record: PairingRecord) throws
    func delete() throws
}

public struct KeychainPairingStore: PairingCredentialStore {
    private let service: String
    private let account: String
    public init(service: String, account: String) { self.service = service; self.account = account }
    package var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service, kSecAttrAccount as String: account,
         kSecAttrSynchronizable as String: false, kSecUseDataProtectionKeychain as String: true]
    }
    private static func failure(_ status: OSStatus) -> PairingError {
        status == errSecMissingEntitlement ? .signingConfiguration : .unavailable
    }
    public func load() throws -> PairingRecord? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw Self.failure(status) }
        guard let data = result as? Data, data.count <= 2048,
              let record = try? JSONDecoder().decode(PairingRecord.self, from: data),
              let text = try? record.payload.encoded(),
              (try? PairingPayload.decode(text)) != nil else { throw PairingError.corruptCredential }
        return record
    }
    public func add(_ record: PairingRecord) throws {
        _ = try PairingPayload.decode(record.payload.encoded())
        var request = query
        request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        request[kSecValueData as String] = try JSONEncoder().encode(record)
        let status = SecItemAdd(request as CFDictionary, nil)
        if status == errSecDuplicateItem { throw PairingError.duplicate }
        guard status == errSecSuccess else { throw Self.failure(status) }
    }
    public func delete() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw Self.failure(status) }
    }
}

public enum PairingCredentials {
    public static func randomSecret() throws -> Data {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw PairingError.randomFailure }
        return Data(bytes)
    }

    public static func accept(_ payload: PairingPayload, role: PairingRecord.Role, store: any PairingCredentialStore) throws -> PairingRecord {
        _ = try PairingPayload.decode(payload.encoded())
        if let existing = try store.load() {
            guard existing.payload == payload, existing.role == role else { throw PairingError.differentPairing }
            return existing
        }
        let record = PairingRecord(payload: payload, role: role)
        do { try store.add(record) }
        catch PairingError.duplicate {
            guard let existing = try store.load(), existing == record else { throw PairingError.differentPairing }
            return existing
        }
        return record
    }

    public static func owner(documentID: String, store: any PairingCredentialStore,
                             random: () throws -> Data = randomSecret) throws -> PairingRecord {
        if let existing = try store.load() {
            guard existing.role == .owner, existing.payload.documentID == documentID else { throw PairingError.differentPairing }
            return existing
        }
        return try accept(PairingPayload(documentID: documentID, secret: random()), role: .owner, store: store)
    }
}
