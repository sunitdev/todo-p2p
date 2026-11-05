import Automerge
import Foundation
import Testing
@testable import TodoP2PCore

@Test func archivePreservesFullStateAndRetiresWriter() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    let source = try WorkspaceStore.createNew()
    let kept = try await source.addTodo(title: "日本語 🌱")
    let removed = try await source.addTodo(title: "deleted")
    try await source.deleteTodo(id: removed.id)
    let snapshot = await source.serialize()
    let document = try Document(snapshot.documentData)
    try document.put(obj: .ROOT, key: "future", value: .String("unknown"))
    let concurrent = document.fork()
    try document.put(obj: .ROOT, key: "future", value: .String("first"))
    try concurrent.put(obj: .ROOT, key: "future", value: .String("second"))
    try document.merge(other: concurrent)
    #expect(try document.getAll(obj: .ROOT, key: "future").count == 2)
    let full = WorkspaceSnapshot(documentID: snapshot.documentID, documentData: document.save())
    let bytes = try WorkspaceArchive.encode(full)
    let envelope = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
    #expect(Set(envelope.keys) == ["storageVersion", "documentID", "documentData"])
    let active = try WorkspaceStore.createNew(directory: directory)
    _ = try await active.addTodo(title: "original")
    let original = await active.serialize()
    let replacement = try await active.restoreWorkspace(bytes)
    let reopened = try WorkspaceStore.open(directory: directory)
    let restored = await reopened.serialize()
    #expect(restored.documentID == full.documentID)
    let restoredDocument = try Document(restored.documentData)
    #expect(restoredDocument.heads() == document.heads())
    #expect(try restoredDocument.getAll(obj: .ROOT, key: "future") == document.getAll(obj: .ROOT, key: "future"))
    #expect(try restoredDocument.get(obj: .ROOT, key: "future") == document.get(obj: .ROOT, key: "future"))
    #expect(try await reopened.readTodos().todos.map(\.id) == [kept.id])
    await #expect(throws: WorkspaceTransferError.self) { try await active.flush() }
    await #expect(throws: WorkspaceTransferError.self) { try await active.addTodo(title: "stale") }
    let recovery = try WorkspaceArchive.decode(Data(contentsOf: replacement.recoveryDirectory.appendingPathComponent("previous-current.todop2p")))
    #expect(recovery.documentID == original.documentID)
    #expect(try Document(recovery.documentData).heads() == Document(original.documentData).heads())
}

@Test func invalidArchivesPreserveOriginal() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try WorkspaceStore.createNew(directory: directory)
    let file = directory.appendingPathComponent("workspace.snapshot")
    let original = try Data(contentsOf: file)
    var envelope = try #require(JSONSerialization.jsonObject(with: original) as? [String: Any])
    var invalid = [Data(), Data(original.prefix(20)), Data("{}".utf8)]
    envelope["storageVersion"] = 999
    invalid.append(try JSONSerialization.data(withJSONObject: envelope))
    envelope["storageVersion"] = 1
    envelope["documentData"] = Data("bad".utf8).base64EncodedString()
    invalid.append(try JSONSerialization.data(withJSONObject: envelope))
    let badSchema = Document()
    envelope["documentData"] = badSchema.save().base64EncodedString()
    invalid.append(try JSONSerialization.data(withJSONObject: envelope))
    for data in invalid {
        await #expect(throws: (any Error).self) { try await store.restoreWorkspace(data) }
        #expect(try Data(contentsOf: file) == original)
    }
    await #expect(throws: WorkspaceTransferError.self) { try await store.validateExportDestination(file) }
}
