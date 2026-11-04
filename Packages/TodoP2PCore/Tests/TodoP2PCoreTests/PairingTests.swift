import AutomergeRepo
import Foundation
import Security
import Testing
@testable import TodoP2PCore

private final class CredentialFixture: PairingCredentialStore {
    var record: PairingRecord?
    var failRead = false
    var failWrite = false
    var failDelete = false
    var writes = 0
    func load() throws -> PairingRecord? {
        if failRead { throw PairingError.unavailable }
        return record
    }
    func add(_ record: PairingRecord) throws {
        if failWrite { throw PairingError.unavailable }
        writes += 1
        self.record = record
    }
    func delete() throws {
        if failDelete { throw PairingError.unavailable }
        record = nil
    }
}

@Test func pairingPayloadValidation() throws {
    let id = DocumentId().id
    let payload = try PairingPayload(documentID: id, secret: PairingCredentials.randomSecret())
    let equal = try PairingPayload.decode(payload.encoded()) == payload
    #expect(equal)
    let base: [String: Any] = ["version": 1, "documentID": id, "secret": Data(repeating: 0, count: 32).base64EncodedString()]
    var invalid: [[String: Any]] = []
    for (key, values) in [("version", [2, "1", NSNull()] as [Any]),
                           ("documentID", ["", "1", String(repeating: "1", count: 20), String(repeating: "!", count: 28), 1] as [Any]),
                           ("secret", ["!", "", Data(repeating: 0, count: 31).base64EncodedString(), Data(repeating: 0, count: 33).base64EncodedString(), 1] as [Any])] {
        for value in values { var row = base; row[key] = value; invalid.append(row) }
        var row = base; row.removeValue(forKey: key); invalid.append(row)
    }
    for row in invalid {
        let text = String(decoding: try JSONSerialization.data(withJSONObject: row), as: UTF8.self)
        #expect(throws: PairingError.self) { try PairingPayload.decode(text) }
    }
    for text in ["[]", "{}", "not JSON", String(repeating: " ", count: 1025)] {
        #expect(throws: PairingError.self) { try PairingPayload.decode(text) }
    }
}

@Test func credentialFailureAndRetry() throws {
    let store = CredentialFixture()
    let id = DocumentId().id
    #expect(throws: PairingError.self) {
        try PairingCredentials.owner(documentID: id, store: store, random: { throw PairingError.randomFailure })
    }
    #expect(store.writes == 0)
    store.failWrite = true
    #expect(throws: PairingError.self) { try PairingCredentials.owner(documentID: id, store: store) }
    #expect(store.record == nil)
    store.failWrite = false
    let first = try PairingCredentials.owner(documentID: id, store: store)
    let second = try PairingCredentials.owner(documentID: id, store: store, random: { throw PairingError.randomFailure })
    let same = first == second
    #expect(same)
    #expect(store.writes == 1)
    store.failRead = true
    #expect(throws: PairingError.self) { try PairingCredentials.owner(documentID: id, store: store) }
    store.failRead = false
    let other = try PairingPayload(documentID: DocumentId().id, secret: PairingCredentials.randomSecret())
    #expect(throws: PairingError.self) { try PairingCredentials.accept(other, role: .pendingInitialSync, store: store) }
    store.failDelete = true
    #expect(throws: PairingError.self) { try store.delete() }
    #expect(store.record != nil)
    store.failDelete = false
    try store.delete()
    #expect(try store.load() == nil)
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["TODO_P2P_KEYCHAIN_INTEGRATION"] == "1")) func realPairingKeychain() throws {
    let store = KeychainPairingStore(service: "local.sunit.TodoP2P.tests." + UUID().uuidString, account: UUID().uuidString)
    defer { try? store.delete() }
    #expect(try store.load() == nil)
    let first = try PairingCredentials.owner(documentID: DocumentId().id, store: store)
    let same = try store.load() == first
    #expect(same)
    var query = store.query
    query[kSecReturnAttributes as String] = true
    var result: CFTypeRef?
    #expect(SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess)
    let attributes = try #require(result as? [String: Any])
    #expect(attributes[kSecAttrSynchronizable as String] as? Bool == false)
    #expect(attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
    #expect(throws: PairingError.self) { try store.add(first) }
    #expect(SecItemUpdate(store.query as CFDictionary, [kSecValueData as String: Data("invalid".utf8)] as CFDictionary) == errSecSuccess)
    #expect(throws: PairingError.self) { try store.load() }
    try store.delete()
    #expect(try store.load() == nil)
}

@Test func repeatedPendingAcceptanceIsIdempotent() throws {
    let store = CredentialFixture()
    let payload = try PairingPayload(documentID: DocumentId().id, secret: PairingCredentials.randomSecret())
    let first = try PairingCredentials.accept(payload, role: .pendingInitialSync, store: store)
    let second = try PairingCredentials.accept(payload, role: .pendingInitialSync, store: store)
    let same = first == second
    #expect(same)
    #expect(store.writes == 1)
}
