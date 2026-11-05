import Foundation
import Testing
import TodoP2PCore
@testable import TodoP2PApp

final class TestIO: WorkspaceFileIO, @unchecked Sendable {
    private let lock = NSLock()
    private var failing = false
    private var exchangeFailure = false
    let real = LocalWorkspaceFileIO()
    func fail(_ value: Bool) { lock.withLock { failing = value } }
    func failExchange(_ value: Bool) { lock.withLock { exchangeFailure = value } }
    func exchange(_ first: URL, with second: URL) throws {
        if lock.withLock({ exchangeFailure }) { throw POSIXError(.EIO) }
        try real.exchange(first, with: second)
    }
    func read(_ url: URL) throws -> Data { try real.read(url) }
    func prepareDirectory(_ url: URL) throws { try real.prepareDirectory(url) }
    func writeCandidate(_ data: Data, to url: URL) throws {
        if lock.withLock({ failing }) { throw POSIXError(.ENOSPC) }
        try real.writeCandidate(data, to: url)
    }
    func promote(_ candidate: URL, to destination: URL, exclusive: Bool) throws {
        try real.promote(candidate, to: destination, exclusive: exclusive)
    }
    func verifyPolicy(_ url: URL, directory: Bool) throws { try real.verifyPolicy(url, directory: directory) }
    func removeCandidate(_ url: URL) { real.removeCandidate(url) }
}

@MainActor @Test func startupPreservesExistingEvidence() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let model = WorkspaceModel { try WorkspaceModel.openOrCreate(directory: directory, io: LocalWorkspaceFileIO()) }
    await model.start()
    #expect(!model.ready)
    #expect(model.openingError != nil)
    #expect(try FileManager.default.contentsOfDirectory(atPath: directory.path).isEmpty)
    let file = directory.appendingPathComponent("workspace.snapshot")
    let bytes = Data("invalid snapshot".utf8)
    try bytes.write(to: file)
    await model.start()
    #expect(!model.ready)
    #expect(try Data(contentsOf: file) == bytes)
}

@MainActor @Test func failedMutationsRefreshAndFlushWithoutDuplicates() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    let io = TestIO()
    let model = WorkspaceModel { try WorkspaceModel.openOrCreate(directory: directory, io: io) }
    await model.start()
    #expect(model.ready)
    io.fail(true)
    model.creationTitle = "  kept verbatim 🌱  "
    await model.add()
    #expect(model.todos.count == 1)
    #expect(model.creationTitle.isEmpty)
    let id = try #require(model.selection)
    #expect(model.todos.first?.title == "  kept verbatim 🌱  ")
    guard case .failed = model.saveState else { Issue.record("save failure hidden"); return }
    io.fail(false)
    await model.retrySaving()
    #expect(model.todos.count == 1)
    model.drafts[id] = TodoDraft(title: "", notes: "line one\n日本語 👩🏽‍💻")
    io.fail(true)
    await model.save(id: id)
    #expect(model.todos.first?.title == "")
    #expect(model.drafts[id]?.notes == "line one\n日本語 👩🏽‍💻")
    #expect(model.todos.first?.notes == "")
    io.fail(false)
    await model.save(id: id)
    await model.complete(id: id, value: true)
    await model.complete(id: id, value: false)
    let reopened = try WorkspaceStore.open(directory: directory)
    let todos = try await reopened.readTodos().todos
    #expect(todos.count == 1)
    #expect(todos.first?.id == id)
    #expect(todos.first?.notes == "line one\n日本語 👩🏽‍💻")
    #expect(todos.first?.completed == false)
    io.fail(true)
    await model.delete(id: id)
    #expect(model.todos.isEmpty)
    #expect(model.selection == nil)
    #expect(model.drafts[id] == nil)
    guard case .failed = model.saveState else { Issue.record("deletion failure hidden"); return }
    io.fail(false)
    await model.retrySaving()
    #expect(try await WorkspaceStore.open(directory: directory).readTodos().todos.isEmpty)
}

@MainActor @Test func creationValidationAndDraftNavigation() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    let model = WorkspaceModel { try WorkspaceModel.openOrCreate(directory: directory, io: LocalWorkspaceFileIO()) }
    await model.start()
    model.creationTitle = " \n "
    await model.add()
    #expect(model.todos.isEmpty)
    #expect(model.operationError?.contains("Enter a title") == true)
    model.creationTitle = "one"
    await model.add()
    let first = try #require(model.selection)
    model.drafts[first] = TodoDraft(title: "draft", notes: "retained")
    model.creationTitle = "two"
    await model.add()
    model.selection = first
    #expect(model.draft(for: first).notes == "retained")
    model.cancel(id: first)
    #expect(model.draft(for: first).title == "one")
    #expect(model.todos.map(\.id) == model.todos.map(\.id).sorted())
    let file = directory.appendingPathComponent("workspace.snapshot")
    var envelope = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any])
    envelope["storageVersion"] = 42
    let bytes = try JSONSerialization.data(withJSONObject: envelope)
    try bytes.write(to: file)
    let rejected = WorkspaceModel { try WorkspaceModel.openOrCreate(directory: directory, io: LocalWorkspaceFileIO()) }
    await rejected.start()
    #expect(!rejected.ready)
    #expect(try Data(contentsOf: file) == bytes)
}

@MainActor @Test func exportRetainsSaveFailureAndRestoreDiscardsDraftsOnlyOnCommit() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID())")
    let export = FileManager.default.temporaryDirectory.appendingPathComponent("todo-p2p-test-\(UUID()).todop2p")
    defer { try? FileManager.default.removeItem(at: directory); try? FileManager.default.removeItem(at: export) }
    let io = TestIO()
    let model = WorkspaceModel { try WorkspaceStore.createNew(directory: directory, io: io) }
    await model.start()
    io.fail(true)
    model.creationTitle = "unsaved 🌱"
    await model.add()
    let id = try #require(model.selection)
    model.drafts[id] = TodoDraft(title: "draft", notes: "unapplied")
    await model.exportWorkspace(to: export)
    guard case .failed = model.saveState else { Issue.record("export cleared save error"); return }
    let snapshot = try WorkspaceArchive.decode(Data(contentsOf: export))
    let candidate = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
    #expect(try await candidate.readTodos().todos.first?.title == "unsaved 🌱")
    await model.previewRestore(from: export)
    model.cancelRestore()
    #expect(model.drafts[id]?.title == "draft")
    await model.previewRestore(from: export)
    await model.confirmRestore()
    #expect(model.drafts[id]?.title == "draft")
    #expect(model.restorePreview != nil)
    io.fail(false)
    io.failExchange(true)
    let original = try Data(contentsOf: directory.appendingPathComponent("workspace.snapshot"))
    await model.confirmRestore()
    #expect(try Data(contentsOf: directory.appendingPathComponent("workspace.snapshot")) == original)
    #expect(model.drafts[id]?.title == "draft")
    io.failExchange(false)
    await model.confirmRestore()
    #expect(model.drafts.isEmpty)
    #expect(model.restorePreview == nil)
    #expect(model.todos.first?.title == "unsaved 🌱")
}
