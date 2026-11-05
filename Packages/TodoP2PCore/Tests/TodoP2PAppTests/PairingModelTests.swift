import Foundation
import Testing
import Vision
@testable import TodoP2PApp
import TodoP2PCore

@MainActor @Test func renderedPairingQRRoundTrip() throws {
    let payload = try PairingPayload(documentID: WorkspaceStore.createNew().documentID.id, secret: PairingCredentials.randomSecret())
    let image = try PairingQR.image(payload)
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(cgImage: image).perform([request])
    let text = try #require(request.results?.first?.payloadStringValue != nil ? request.results?.first?.payloadStringValue : nil)
    let same = try PairingPayload.decode(text) == payload
    #expect(same)
}

private final class ModelCredentials: PairingCredentialStore {
    var record: PairingRecord?
    var fail = false
    var failRead = false
    func load() throws -> PairingRecord? {
        if failRead { throw PairingError.unavailable }
        return record
    }
    func add(_ record: PairingRecord) throws {
        if fail { throw PairingError.unavailable }
        self.record = record
    }
    func delete() throws {
        if fail { throw PairingError.unavailable }
        record = nil
    }
}

@MainActor @Test func pendingAcceptanceFailuresPreserveWorkspace() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let workspace = try WorkspaceStore.createNew(directory: directory)
    _ = try await workspace.addTodo(title: "Preserved")
    let file = directory.appendingPathComponent("workspace.snapshot")
    let original = try Data(contentsOf: file)
    let credentials = ModelCredentials()
    let model = PairingModel(store: credentials)
    let payload = try PairingPayload(documentID: WorkspaceStore.createNew().documentID.id, secret: PairingCredentials.randomSecret())
    model.scan(try payload.encoded())
    model.cancel()
    #expect(model.record == nil)
    model.scan("invalid")
    #expect(model.candidate == nil)
    model.scan(try payload.encoded())
    credentials.fail = true
    model.accept()
    #expect(model.record == nil)
    #expect(model.candidate != nil)
    credentials.fail = false
    model.accept()
    #expect(model.record?.role == .pendingInitialSync)
    let reopened = PairingModel(store: credentials)
    reopened.reload()
    #expect(reopened.record?.payload.documentID == payload.documentID)
    credentials.fail = true
    reopened.forget()
    #expect(reopened.record != nil)
    credentials.fail = false
    reopened.forget()
    #expect(reopened.record == nil)
    #expect(try Data(contentsOf: file) == original)
    #expect(try WorkspaceStore.open(directory: directory).documentID == workspace.documentID)
}

#if DEBUG
@MainActor @Test func invalidPairingIsolationFailsClosed() {
    for env in [
        ["TODO_P2P_TEST_DIRECTORY": "/tmp/todo-p2p-test-invalid"],
        ["TODO_P2P_TEST_KEYCHAIN": "isolated"],
        ["TODO_P2P_PAIRING_FIXTURE": "1"],
        ["TODO_P2P_TEST_CLEANUP": "1"],
        ["TODO_P2P_TEST_DIRECTORY": "/tmp/todo-p2p-test-" + UUID().uuidString, "TODO_P2P_TEST_KEYCHAIN": "mismatch"]
    ] {
        #expect(throws: PairingError.self) { try PairingModel.configuredStore(environment: env) }
    }
}
#endif

@MainActor @Test func restorePairingCompatibilityFailsClosed() throws {
    let credentials = ModelCredentials()
    let model = PairingModel(store: credentials)
    let current = try WorkspaceStore.createNew().documentID.id
    let other = try WorkspaceStore.createNew().documentID.id
    try model.validateRestore(currentID: current, restoredID: other)
    model.showOwner(documentID: current)
    let original = credentials.record
    try model.validateRestore(currentID: current, restoredID: current)
    #expect(throws: WorkspaceTransferError.self) { try model.validateRestore(currentID: current, restoredID: other) }
    credentials.failRead = true
    #expect(throws: PairingError.self) { try model.validateRestore(currentID: current, restoredID: current) }
    #expect(throws: PairingError.self) { try model.validateRestore(currentID: current, restoredID: other) }
    let unchanged = credentials.record == original
    #expect(unchanged)
}
