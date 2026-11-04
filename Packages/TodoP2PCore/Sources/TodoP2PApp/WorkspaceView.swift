import SwiftUI
import TodoP2PCore

public struct WorkspaceView: View {
    @Bindable var model: WorkspaceModel
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
                                        Task { await model.complete(id: todo.id, value: !todo.completed) }
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
                                Button("Delete todo", role: .destructive) { Task { await model.delete(id: todo.id) } }
                            }
                            .swipeActions {
                                Button("Delete", role: .destructive) { Task { await model.delete(id: todo.id) } }
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
                    Button("Retry opening") { Task { await model.start() } }
                }.padding()
            } else {
                ProgressView("Opening workspace…")
            }
        }
        .task { await model.start() }
        .sheet(isPresented: $pairing) {
            if let pairingModel = model.pairing, let id = model.documentID {
                PairingView(model: pairingModel, documentID: id)
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

    private func add() {
        Task {
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
                    Task { await model.complete(id: id, value: value) }
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
                    Button("Save") { Task { await model.save(id: id) } }.keyboardShortcut("s")
                    Button("Cancel") { model.cancel(id: id) }
                    Spacer()
                    Button("Delete todo", role: .destructive) { Task { await model.delete(id: id) } }
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
            if model.pairing != nil { Button("Pair devices") { pairing = true }.accessibilityLabel("Pair devices") }
            if model.busy { ProgressView("Working…") }
            if let error = model.operationError { Text(error).foregroundStyle(.red).textSelection(.enabled) }
            switch model.saveState {
            case .saved: Text("Saved locally")
            case .failed(_, let error):
                Text("Changes are not confirmed saved: \(WorkspaceModel.message(for: error))").foregroundStyle(.red)
                Button("Retry saving") { Task { await model.retrySaving() } }
            case .unsaved, .saving:
                Text("Changes not saved locally")
                Button("Retry saving") { Task { await model.retrySaving() } }
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
