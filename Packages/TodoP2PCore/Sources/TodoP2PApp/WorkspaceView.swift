import SwiftUI
import UniformTypeIdentifiers
#if os(macOS)
import AppKit
#endif
import TodoP2PCore

public struct WorkspaceView: View {
    @Bindable var model: WorkspaceModel
    @State private var importing = false
    @State private var pendingImport: Result<URL, Error>?
    @State private var exporting = false
    @State private var archive = ArchiveDocument()
    @State private var exportError: String?
    @State private var adding = false
    @State private var pairing = false

    public init(model: WorkspaceModel) { self.model = model }

    public var body: some View {
        Group {
            if model.ready {
                NavigationSplitView {
                    List(selection: $model.selection) {
                        ForEach(model.todos, id: \.id) { todo in
                            NavigationLink(value: todo.id) {
                                HStack {
                                    Button {
                                        run { await model.complete(id: todo.id, value: !todo.completed) }
                                    } label: {
                                        Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                                    }
                                    .buttonStyle(.borderless)
                                    .accessibilityLabel(todo.completed ? "Mark incomplete" : "Mark complete")
                                    Text(todo.title.isEmpty ? "Untitled" : todo.title)
                                        .strikethrough(todo.completed)
                                        .foregroundStyle(todo.completed ? .secondary : .primary)
                                }
                            }
                            .accessibilityIdentifier("todo-\(todo.id)")
                            .contextMenu {
                                Button("Delete todo", role: .destructive) { run { await model.delete(id: todo.id) } }
                            }
                            .swipeActions {
                                Button("Delete", role: .destructive) { run { await model.delete(id: todo.id) } }
                            }
                        }
                    }
                    .overlay {
                        if model.todos.isEmpty {
                            ContentUnavailableView("No todos", systemImage: "checklist", description: Text("Add a todo to get started."))
                        }
                    }
                    .safeAreaInset(edge: .bottom) { compactStatus }
                    .navigationTitle("Todos")
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Add todo", systemImage: "plus") { adding = true }.keyboardShortcut("n")
                        }
                    }
                    .navigationSplitViewColumnWidth(min: 220, ideal: 260)
                } detail: {
                    if let id = model.selection, model.todos.contains(where: { $0.id == id }) {
                        editor(id: id)
                    } else {
                        ContentUnavailableView("Select a todo", systemImage: "square.and.pencil")
                            .safeAreaInset(edge: .bottom) { compactStatus }
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    #if os(macOS)
                    status
                    #endif
                }
                .disabled(model.busy)
            } else if let error = model.openingError {
                VStack(spacing: 16) {
                    ContentUnavailableView("Could not open workspace", systemImage: "exclamationmark.triangle", description: Text(error))
                    Text("Existing data has been preserved.")
                    Button("Retry opening") { run { await model.start() } }
                }.padding()
            } else {
                ProgressView("Opening workspace…")
            }
        }
        .task { await model.start() }
        #if os(iOS)
        .sheet(isPresented: $importing, onDismiss: {
            if let result = pendingImport { pendingImport = nil; handleImport(result) }
        }) {
            NativeArchivePicker { result in
                pendingImport = result
                importing = false
            }
        }
        #else
        .fileImporter(isPresented: $importing, allowedContentTypes: [.data], onCompletion: handleImport)
        #endif
        .fileExporter(isPresented: $exporting, document: archive, contentType: .data, defaultFilename: "Workspace.todop2p") { result in
            model.reportTransfer(result)
        }
        .alert("Restore workspace?", isPresented: Binding(get: { model.restorePreview != nil }, set: { _ in })) {
            Button("Cancel", role: .cancel) { model.cancelRestore() }
            Button("Replace workspace", role: .destructive) { run { await model.confirmRestore() } }
        } message: { Text(model.restorePreview ?? "") }
        .sheet(isPresented: $pairing) {
            if let pairingModel = model.pairing, let id = model.documentID {
                PairingView(model: pairingModel, documentID: id).disabled(model.busy)
            }
        }
        .sheet(isPresented: $adding) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Add todo").font(.headline)
                TextField("Title", text: $model.creationTitle)
                    .accessibilityIdentifier("creation-title")
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { add() }
                if let error = model.operationError { Text(error).foregroundStyle(.red) }
                HStack {
                    Button("Cancel") { adding = false }
                    Spacer()
                    Button("Add") { add() }.keyboardShortcut(.defaultAction)
                }
            }.padding().frame(minWidth: 300).disabled(model.busy)
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url): run { await model.previewRestore(from: url) }
        case .failure(let error):
            if (error as? CocoaError)?.code != .userCancelled { model.reportTransfer(.failure(error)) }
        }
    }

    private func run(_ action: @escaping @MainActor () async -> Void) {
        let generation = model.generation
        Task { @MainActor in
            guard model.generation == generation else { return }
            await action()
        }
    }

    private func add() {
        run {
            let count = model.todos.count
            await model.add()
            if model.todos.count > count { adding = false }
        }
    }

    private func editor(id: String) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Toggle("Completed", isOn: Binding(get: {
                    model.todos.first(where: { $0.id == id })?.completed ?? false
                }, set: { value in
                    run { await model.complete(id: id, value: value) }
                }))
                Text("Title").font(.headline)
                TextField("Title", text: Binding(get: { model.draft(for: id).title }, set: {
                    var draft = model.draft(for: id); draft.title = $0; model.drafts[id] = draft
                }), axis: .vertical).textFieldStyle(.roundedBorder).accessibilityIdentifier("editor-title")
                Text("Notes").font(.headline)
                TextEditor(text: Binding(get: { model.draft(for: id).notes }, set: {
                    var draft = model.draft(for: id); draft.notes = $0; model.drafts[id] = draft
                }))
                .frame(minHeight: 220).border(.secondary.opacity(0.3)).accessibilityLabel("Notes").accessibilityIdentifier("editor-notes")
                if model.drafts[id] != nil { Text("Editor draft — use Save to apply changes").font(.caption) }
                HStack {
                    Button("Save") { run { await model.save(id: id) } }.keyboardShortcut("s")
                    Button("Cancel") { model.cancel(id: id) }
                    Spacer()
                    Button("Delete todo", role: .destructive) { run { await model.delete(id: id) } }
                }
            }.padding()
        }
        .safeAreaInset(edge: .bottom) { compactStatus }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Edit todo")
        #if os(iOS)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
            }
        }
        #endif
    }

    @ViewBuilder private var compactStatus: some View {
        #if os(iOS)
        status
        #endif
    }

    private var status: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Button("Export workspace") {
                    run {
                        #if os(macOS)
                        let panel = NSSavePanel()
                        panel.nameFieldStringValue = "Workspace.todop2p"
                        panel.message = "Contains personal data. Choose a local destination. Editor drafts are excluded."
                        if panel.runModal() == .OK, let url = panel.url { await model.exportWorkspace(to: url) }
                        #else
                        do { archive = ArchiveDocument(data: try await model.exportData()); exporting = true }
                        catch { exportError = WorkspaceModel.message(for: error) }
                        #endif
                    }
                }
                .accessibilityLabel("Export workspace")
                Button("Restore workspace") { importing = true }.accessibilityLabel("Restore workspace")
            }.disabled(model.busy)
            Text("Exports contain personal data. Choose a local destination.").font(.caption)
            if let message = model.transferMessage { Text(message).textSelection(.enabled) }
            if let exportError { Text(exportError) }
            #if DEBUG
            if ProcessInfo.processInfo.environment["TODO_P2P_PAIRING_FIXTURE"] == "1", let pair = model.pairing, let id = model.documentID {
                Button("Check secure storage") { pair.checkIsolatedKeychain(documentID: id) }
                if let result = pair.integrationResult { Text(result) }
            }
            #endif
            if model.pairing != nil { Button("Pair devices") { pairing = true }.accessibilityLabel("Pair devices") }
            if model.busy { ProgressView("Working…") }
            if let error = model.operationError { Text(error).foregroundStyle(.red).textSelection(.enabled) }
            switch model.saveState {
            case .saved: Text("Saved locally")
            case .failed(_, let error):
                Text("Changes are not confirmed saved: \(WorkspaceModel.message(for: error))").foregroundStyle(.red)
                Button("Retry saving") { run { await model.retrySaving() } }
            case .unsaved, .saving:
                Text("Changes not saved locally")
                Button("Retry saving") { run { await model.retrySaving() } }
            case nil: EmptyView()
            }
            if !model.diagnostics.isEmpty {
                DisclosureGroup("\(model.diagnostics.count) malformed records — stored data preserved") {
                    ForEach(model.diagnostics, id: \.key) { issue in
                        Text("\(issue.key): \(String(describing: issue.issue))").textSelection(.enabled)
                    }
                }
            }
        }.font(.callout).padding().frame(maxWidth: .infinity, alignment: .leading).background(.bar)
    }
}

private struct ArchiveDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.data] }
    var data = Data()
    init(data: Data = Data()) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let bytes = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        data = bytes
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

#if os(iOS)
private struct NativeArchivePicker: UIViewControllerRepresentable {
    let completion: (Result<URL, Error>?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data])
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIDocumentPickerViewController, context: Context) {}
    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let completion: (Result<URL, Error>?) -> Void
        init(completion: @escaping (Result<URL, Error>?) -> Void) { self.completion = completion }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            if let url = urls.first { completion(.success(url)) }
        }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { completion(nil) }
    }
}
#endif
