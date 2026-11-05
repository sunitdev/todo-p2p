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
    public private(set) var pairing: PairingModel?
    public private(set) var documentID: String?
    private var store: WorkspaceStore?
    private let openStore: () throws -> WorkspaceStore
    private let useConfiguredPairing: Bool

    public init() {
        useConfiguredPairing = true
        openStore = {
            #if DEBUG
            let environment = ProcessInfo.processInfo.environment
            _ = try PairingModel.configuredStore()
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

    init(openStore: @escaping () throws -> WorkspaceStore) { self.openStore = openStore; useConfiguredPairing = false }

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
            documentID = store?.documentID.id
            if useConfiguredPairing { pairing = try PairingModel(store: PairingModel.configuredStore()) }
            pairing?.reload()
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

    public private(set) var generation: UInt64 = 0
    public private(set) var transferMessage: String?
    public private(set) var restorePreview: String?
    private var restoreData: Data?

    public func exportData() async throws -> Data {
        guard !busy, let store else { throw WorkspaceTransferError.retiredStore }
        return try await store.exportWorkspace()
    }

    public func reportTransfer(_ result: Result<URL, Error>) {
        switch result {
        case .success: transferMessage = "Exported current workspace. Editor drafts are excluded."
        case .failure(let error): transferMessage = Self.message(for: error)
        }
    }

    public func exportWorkspace(to url: URL) async {
        guard !busy, let store else { return }
        busy = true
        defer { busy = false }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            try await store.validateExportDestination(url)
            let bytes = try await store.exportWorkspace()
            try bytes.write(to: url, options: .atomic)
            transferMessage = "Exported current workspace. Editor drafts are excluded."
        } catch { transferMessage = Self.message(for: error) }
    }

    public func previewRestore(from url: URL) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        cancelRestore()
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            let snapshot = try WorkspaceArchive.decode(data)
            let candidate = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
            let result = try await candidate.readTodos()
            restoreData = data
            restorePreview = "Workspace \(snapshot.documentID) · \(result.todos.count) todos · \(result.diagnostics.count) diagnostics. Replace the current workspace and discard editor drafts? The original is retained in protected RestoreRecovery storage."
        } catch { transferMessage = Self.message(for: error) }
    }

    public func cancelRestore() { restoreData = nil; restorePreview = nil }

    public func confirmRestore() async {
        guard !busy, let store, let data = restoreData, let documentID else { return }
        busy = true
        defer { busy = false }
        do {
            let snapshot = try WorkspaceArchive.decode(data)
            try pairing?.validateRestore(currentID: documentID, restoredID: snapshot.documentID)
            let replacement = try await store.restoreWorkspace(data)
            generation += 1
            self.store = replacement.store
            self.documentID = replacement.store.documentID.id
            drafts = [:]
            selection = nil
            creationTitle = ""
            cancelRestore()
            transferMessage = "Workspace restored. Original retained at \(replacement.recoveryDirectory.path)"
            do { try await refresh() }
            catch { transferMessage = "Restore committed. Reopen the app to refresh the workspace." }
        } catch { transferMessage = Self.message(for: error) }
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
