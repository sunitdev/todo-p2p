import Foundation
import Observation
import Security
import TodoP2PCore

@MainActor @Observable
public final class PairingModel {
    public private(set) var record: PairingRecord?
    public private(set) var candidate: PairingPayload?
    public private(set) var error: String?
    private let store: any PairingCredentialStore

    init(store: any PairingCredentialStore) { self.store = store }

    static func configuredStore(environment: [String: String] = ProcessInfo.processInfo.environment) throws -> any PairingCredentialStore {
        #if DEBUG
        let env = environment
        let keys = ["TODO_P2P_TEST_DIRECTORY", "TODO_P2P_TEST_KEYCHAIN", "TODO_P2P_TEST_FAILURE", "TODO_P2P_PAIRING_FIXTURE", "TODO_P2P_TEST_CLEANUP"]
        if keys.contains(where: { env[$0] != nil }) {
            guard let path = env[keys[0]], path.hasPrefix("/tmp/todo-p2p-test-"),
                  UUID(uuidString: String(path.dropFirst("/tmp/todo-p2p-test-".count))) != nil,
                  let namespace = env[keys[1]], namespace == URL(fileURLWithPath: path).lastPathComponent else {
                throw PairingError.unavailable
            }
            let store = KeychainPairingStore(service: "local.sunit.TodoP2P.tests." + namespace, account: "pairing")
            if env["TODO_P2P_TEST_CLEANUP"] == "1" { try store.delete() }
            return store
        }
        #endif
        return KeychainPairingStore(service: "local.sunit.TodoP2P.pairing", account: "current")
    }

    func validateRestore(currentID: String, restoredID: String) throws {
        let existing = try store.load()
        if currentID != restoredID, existing != nil { throw WorkspaceTransferError.pairedIdentity }
    }

    #if DEBUG
    public private(set) var integrationResult: String?
    public func checkIsolatedKeychain(documentID: String) {
        let env = ProcessInfo.processInfo.environment
        guard env["TODO_P2P_PAIRING_FIXTURE"] == "1",
              let namespace = env["TODO_P2P_TEST_KEYCHAIN"],
              env["TODO_P2P_TEST_DIRECTORY"] == "/tmp/" + namespace,
              namespace.hasPrefix("todo-p2p-test-"),
              UUID(uuidString: String(namespace.dropFirst("todo-p2p-test-".count))) != nil,
              let keychain = store as? KeychainPairingStore else { return }
        do {
            guard try keychain.load() == nil else { throw PairingError.duplicate }
            defer { try? keychain.delete() }
            let first = try PairingCredentials.owner(documentID: documentID, store: keychain)
            guard try keychain.load() == first else { throw PairingError.corruptCredential }
            var query = keychain.query
            query[kSecReturnAttributes as String] = true
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            guard status == errSecSuccess else {
                integrationResult = "Keychain attribute status: \(status)"
                return
            }
            guard let attributes = result as? [String: Any],
                  attributes[kSecAttrSynchronizable as String] as? Bool == false,
                  attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String else {
                throw PairingError.corruptCredential
            }
            try keychain.delete()
            guard try keychain.load() == nil else { throw PairingError.corruptCredential }
            integrationResult = "Secure storage integration passed"
        } catch { integrationResult = error.localizedDescription }
    }
    #endif

    public func reload() { perform { record = try store.load() } }
    public func showOwner(documentID: String) {
        perform { record = try PairingCredentials.owner(documentID: documentID, store: store) }
    }
    public func scan(_ text: String) {
        candidate = nil
        perform {
            let payload = try PairingPayload.decode(text)
            let existing = try store.load()
            if let existing, existing.payload != payload { throw PairingError.differentPairing }
            candidate = payload
        }
    }
    public func cancel() { candidate = nil; error = nil }
    public func accept() {
        guard let candidate else { return }
        perform {
            record = try PairingCredentials.accept(candidate, role: .pendingInitialSync, store: store)
            self.candidate = nil
        }
    }
    public func forget() {
        perform { try store.delete(); record = nil; candidate = nil }
    }
    private func perform(_ action: () throws -> Void) {
        error = nil
        do { try action() }
        catch let failure as PairingError { error = failure.localizedDescription }
        catch { self.error = "Pairing failed. Retry." }
    }
}
