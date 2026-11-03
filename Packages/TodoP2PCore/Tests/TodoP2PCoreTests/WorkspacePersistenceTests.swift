import Automerge
import Foundation
import Testing
@testable import TodoP2PCore

final class FaultIO: WorkspaceFileIO, @unchecked Sendable {
    enum Point { case none, read, write, replace, policy }
    private let lock = NSLock()
    private var point: Point = .none
    let real = LocalWorkspaceFileIO()
    func fail(_ point: Point) { lock.withLock { self.point = point } }
    private func check(_ point: Point) throws {
        if lock.withLock({ self.point == point }) { throw POSIXError(.EACCES) }
    }
    func read(_ url: URL) throws -> Data { try check(.read); return try real.read(url) }
    func prepareDirectory(_ url: URL) throws { try real.prepareDirectory(url) }
    func writeCandidate(_ data: Data, to url: URL) throws {
        try real.writeCandidate(data, to: url)
        try check(.write)
    }
    func promote(_ candidate: URL, to destination: URL, exclusive: Bool) throws {
        try check(.replace)
        try real.promote(candidate, to: destination, exclusive: exclusive)
    }
    func verifyPolicy(_ url: URL, directory: Bool) throws {
        try check(.policy)
        try real.verifyPolicy(url, directory: directory)
    }
    func removeCandidate(_ url: URL) { real.removeCandidate(url) }
}

private func temporaryWorkspace() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("todo-storage-\(UUID())")
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false)
    return url
}

private func expectSame(_ snapshot: WorkspaceSnapshot, _ store: WorkspaceStore) async throws {
    let after = await store.serialize()
    #expect(after.documentID == snapshot.documentID)
    let a = try Document(snapshot.documentData)
    let b = try Document(after.documentData)
    #expect(a.heads() == b.heads())
    #expect(a.getHistory() == b.getHistory())
    for hash in a.getHistory() { #expect(a.change(hash: hash) == b.change(hash: hash)) }
}

@Test func durableReopening() async throws {
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    var store: WorkspaceStore? = try WorkspaceStore.createNew(directory: directory)
    let todo = try await store!.addTodo(title: "durable")
    _ = try await store!.editNotes(id: todo.id, notes: "notes")
    let snapshot = await store!.serialize()
    store = nil
    let reopened = try WorkspaceStore.open(directory: directory)
    try await expectSame(snapshot, reopened)
    #expect(try await reopened.readTodos().todos.first?.id == todo.id)
    let before = try Data(contentsOf: directory.appendingPathComponent("workspace.snapshot"))
    #expect(throws: (any Error).self) { try WorkspaceStore.createNew(directory: directory) }
    #expect(try Data(contentsOf: directory.appendingPathComponent("workspace.snapshot")) == before)
}

@Test func localOperationsPersistAndMemoryStaysUnsaved() async throws {
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    let memory = try WorkspaceStore.createNew()
    _ = try await memory.addTodo(title: "memory")
    try await memory.flush()
    guard case .unsaved = await memory.saveState else { Issue.record("memory claimed saved"); return }
    let store = try WorkspaceStore.createNew(directory: directory)
    let todo = try await store.addTodo(title: "local")
    _ = try await store.editTitle(id: todo.id, title: "changed")
    _ = try await store.editNotes(id: todo.id, notes: "retained")
    _ = try await store.setCompleted(id: todo.id, completed: true)
    try await expectSame(await store.serialize(), WorkspaceStore.open(directory: directory))
    try await store.deleteTodo(id: todo.id)
    let reopened = try WorkspaceStore.open(directory: directory)
    #expect(try await reopened.readTodos().todos.isEmpty)
    try await expectSame(await store.serialize(), reopened)
    guard case .saved = await store.saveState else { Issue.record("not saved"); return }
}

@Test(arguments: [FaultIO.Point.write, .replace, .policy])
private func failedSaveRetry(point: FaultIO.Point) async throws {
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    let io = FaultIO()
    let store = try WorkspaceStore.createNew(directory: directory, io: io)
    let todo = try await store.addTodo(title: "previous")
    let file = directory.appendingPathComponent("workspace.snapshot")
    let previous = try Data(contentsOf: file)
    io.fail(point)
    await #expect(throws: (any Error).self) { try await store.editTitle(id: todo.id, title: "retry me") }
    guard case .failed = await store.saveState else { Issue.record("failure hidden"); return }
    #expect(try await store.readTodos().todos.first?.title == "retry me")
    if point != .policy {
        #expect(try Data(contentsOf: file) == previous)
        #expect(try await WorkspaceStore.open(directory: directory).readTodos().todos.first?.title == "previous")
    }
    io.fail(.none)
    _ = try await store.editNotes(id: todo.id, notes: "later edit")
    try await store.flush()
    try await expectSame(await store.serialize(), WorkspaceStore.open(directory: directory))
    #expect(try FileManager.default.contentsOfDirectory(atPath: directory.path) == ["workspace.snapshot"])
}

@Test func safeOpeningPreservesEvidence() throws {
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    do {
        _ = try WorkspaceStore.open(directory: directory)
        Issue.record("missing workspace opened")
    } catch WorkspaceStorageError.missingWorkspace { }
    let file = directory.appendingPathComponent("workspace.snapshot")
    let valid = try WorkspaceStore.createNew().documentID.id
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(99))
    let fixtures = [Data(), Data("{truncated".utf8)] + (try [
        WorkspaceEnvelope(storageVersion: 99, documentID: valid, documentData: document.save()),
        WorkspaceEnvelope(storageVersion: 1, documentID: "bad", documentData: document.save()),
        WorkspaceEnvelope(storageVersion: 1, documentID: valid, documentData: Data([0, 1])),
        WorkspaceEnvelope(storageVersion: 1, documentID: valid, documentData: document.save())
    ].map { try JSONEncoder().encode($0) })
    for (index, bytes) in fixtures.enumerated() {
        try bytes.write(to: file)
        do {
            _ = try WorkspaceStore.open(directory: directory)
            Issue.record("invalid workspace opened")
        } catch {
            switch (index, error) {
            case (0...1, WorkspaceStorageError.malformedEnvelope): break
            case (2, WorkspaceStorageError.unsupportedVersion(99)): break
            case (3, WorkspaceOpeningError.invalidDocumentID): break
            case (4, _): #expect(!(error is WorkspaceStorageError))
            case (5, WorkspaceOpeningError.unsupportedSchemaVersion(99)): break
            default: Issue.record("unexpected opening error: \(error)")
            }
        }
        #expect(try Data(contentsOf: file) == bytes)
    }
    let io = FaultIO()
    io.fail(.read)
    #expect(throws: POSIXError.self) { try WorkspaceStore.open(directory: directory, io: io) }
    #expect(try Data(contentsOf: file) == fixtures.last)
}

@Test func platformStoragePolicy() async throws {
    let resolved = try WorkspaceStore.storageDirectory()
    #expect(resolved.path.contains("/Library/Application Support/"))
    #expect(!resolved.path.contains("Mobile Documents"))
    #expect(!resolved.path.contains("iCloud"))
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    let io = LocalWorkspaceFileIO()
    try io.prepareDirectory(directory)
    let candidate = directory.appendingPathComponent("candidate")
    try io.writeCandidate(Data([1]), to: candidate)
    try io.verifyPolicy(candidate, directory: false)
    io.removeCandidate(candidate)
    let store = try WorkspaceStore.createNew(directory: directory)
    for title in ["first", "second", "third"] { _ = try await store.addTodo(title: title) }
    try io.verifyPolicy(directory, directory: true)
    try io.verifyPolicy(directory.appendingPathComponent("workspace.snapshot"), directory: false)
    print("storage policy verified: resolved=\(resolved.path), synthetic=\(directory.path)")
}

@Test func queuedEditsSaveLatestRevision() async throws {
    let directory = try temporaryWorkspace()
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try WorkspaceStore.createNew(directory: directory)
    let todo = try await store.addTodo(title: "queued")
    async let title = store.editTitle(id: todo.id, title: "latest title")
    async let notes = store.editNotes(id: todo.id, notes: "latest notes")
    _ = try await (title, notes)
    let reopened = try WorkspaceStore.open(directory: directory)
    #expect(try await reopened.readTodos().todos.first?.title == "latest title")
    #expect(try await reopened.readTodos().todos.first?.notes == "latest notes")
    try await expectSame(await store.serialize(), reopened)
    guard case .saved(revision: 3) = await store.saveState else { Issue.record("wrong saved revision"); return }
}
