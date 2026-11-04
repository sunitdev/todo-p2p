import Foundation
import Observation
import TodoP2PCore

public struct TodoDraft: Equatable {
    public var title: String
    public var notes: String
}

@MainActor @Observable
public final class WorkspaceModel {
    public private(set) var todos: [TodoProjection] = []
    public private(set) var diagnostics: [TodoDiagnostic] = []
    public var selection: String?
    public var drafts: [String: TodoDraft] = [:]
    public var creationTitle = ""
    public private(set) var ready = false
    public private(set) var busy = false
    public private(set) var openingError: String?
    public private(set) var operationError: String?
    public private(set) var saveState: WorkspaceSaveState?
    private var store: WorkspaceStore?
    private let openStore: () throws -> WorkspaceStore

    public init() {
        openStore = {
            #if DEBUG
            let environment = ProcessInfo.processInfo.environment
            if let path = environment["TODO_P2P_TEST_DIRECTORY"] {
                guard path.hasPrefix("/"), path.contains("todo-p2p-test-") else {
                    throw CocoaError(.fileReadInvalidFileName)
                }
                let directory = URL(fileURLWithPath: path, isDirectory: true)
                let io = DevelopmentIO(marker: directory.appendingPathComponent("fail-next-save"))
                return try Self.openOrCreate(directory: directory, io: io)
            }
            if environment["TODO_P2P_TEST_FAILURE"] != nil { throw CocoaError(.fileReadInvalidFileName) }
            #endif
            return try Self.openOrCreate(directory: WorkspaceStore.storageDirectory(), io: LocalWorkspaceFileIO())
        }
    }

    init(openStore: @escaping () throws -> WorkspaceStore) { self.openStore = openStore }

    package static func openOrCreate(directory: URL, io: any WorkspaceFileIO) throws -> WorkspaceStore {
        do {
            _ = try FileManager.default.attributesOfItem(atPath: directory.path)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return try WorkspaceStore.createNew(directory: directory, io: io)
        }
        return try WorkspaceStore.open(directory: directory, io: io)
    }

    public func start() async {
        guard !busy, store == nil else { return }
        busy = true
        defer { busy = false }
        do {
            store = try openStore()
            try await refresh()
            openingError = nil
            ready = true
        } catch {
            store = nil
            openingError = Self.message(for: error)
        }
    }

    static func message(for error: any Error) -> String {
        switch error {
        case WorkspaceStorageError.malformedEnvelope:
            return "The stored workspace could not be read. Its snapshot is malformed."
        case WorkspaceStorageError.unsupportedVersion(let version):
            return "This app cannot open storage version \(version)."
        case WorkspaceStorageError.missingWorkspace:
            return "The existing storage folder is missing its workspace snapshot."
        case WorkspaceStorageError.policyMismatch:
            return "The workspace does not meet the required storage protection settings."
        case WorkspaceOpeningError.unsupportedSchemaVersion(let version):
            return "This app cannot open workspace schema version \(version)."
        default:
            return error.localizedDescription
        }
    }

    private func refresh() async throws {
        guard let store else { return }
        saveState = await store.saveState
        let result = try await store.readTodos()
        todos = result.todos
        diagnostics = result.diagnostics
        let ids = Set(todos.map(\.id))
        drafts = drafts.filter { ids.contains($0.key) }
        if let selection, !ids.contains(selection) { self.selection = nil }
    }

    public func draft(for id: String) -> TodoDraft {
        drafts[id] ?? todos.first(where: { $0.id == id }).map { TodoDraft(title: $0.title, notes: $0.notes) }
            ?? TodoDraft(title: "", notes: "")
    }

    public func cancel(id: String) { drafts[id] = nil }

    private func perform(_ action: (WorkspaceStore) async throws -> Void) async {
        guard !busy, let store else { return }
        busy = true
        operationError = nil
        defer { busy = false }
        do { try await action(store) }
        catch { operationError = Self.message(for: error) }
        do { try await refresh() }
        catch { operationError = "Could not refresh todos: \(error)" }
    }

    public func add() async {
        guard !busy else { return }
        let before = Set(todos.map(\.id))
        let title = creationTitle
        await perform { store in _ = try await store.addTodo(title: title) }
        if let added = todos.first(where: { !before.contains($0.id) }) {
            selection = added.id
            creationTitle = ""
        } else if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            operationError = "Enter a title containing more than spaces or line breaks."
        }
    }

    public func save(id: String) async {
        guard !busy else { return }
        let draft = draft(for: id)
        guard let original = todos.first(where: { $0.id == id }) else { return }
        await perform { store in
            if draft.title != original.title { _ = try await store.editTitle(id: id, title: draft.title) }
            if draft.notes != original.notes { _ = try await store.editNotes(id: id, notes: draft.notes) }
        }
        if operationError == nil { drafts[id] = nil }
    }

    public func complete(id: String, value: Bool) async {
        await perform { store in _ = try await store.setCompleted(id: id, completed: value) }
    }

    public func delete(id: String) async { await perform { try await $0.deleteTodo(id: id) } }
    public func retrySaving() async { await perform { try await $0.flush() } }
}

#if DEBUG
private struct DevelopmentIO: WorkspaceFileIO {
    let marker: URL
    private let real = LocalWorkspaceFileIO()
    func read(_ url: URL) throws -> Data { try real.read(url) }
    func prepareDirectory(_ url: URL) throws { try real.prepareDirectory(url) }
    func writeCandidate(_ data: Data, to url: URL) throws {
        if FileManager.default.fileExists(atPath: marker.path) {
            try FileManager.default.removeItem(at: marker)
            throw POSIXError(.ENOSPC)
        }
        try real.writeCandidate(data, to: url)
    }
    func promote(_ candidate: URL, to destination: URL, exclusive: Bool) throws {
        try real.promote(candidate, to: destination, exclusive: exclusive)
    }
    func verifyPolicy(_ url: URL, directory: Bool) throws { try real.verifyPolicy(url, directory: directory) }
    func removeCandidate(_ url: URL) { real.removeCandidate(url) }
}
#endif
