import Automerge
import AutomergeRepo
import Foundation

public struct WorkspaceSnapshot: Sendable {
    public let documentID: String
    public let documentData: Data
}

public struct TodoProjection: Sendable, Equatable {
    public let id: String
    public let title: String
    public let notes: String
    public let completed: Bool
    public let createdAt: Date
}

public struct TodoReadResult: Sendable, Equatable {
    public let todos: [TodoProjection]
    public let diagnostics: [TodoDiagnostic]
}

public struct TodoDiagnostic: Sendable, Equatable {
    public enum Issue: Error, Sendable, Equatable {
        case invalidID
        case missingField(String)
        case invalidType(String)
        case competingObjects(String)
        case conflictingCreatedAt
        case invalidDeleted
    }

    public let key: String
    public let issue: Issue
}

public enum TodoCreationError: Error, Sendable, Equatable {
    case invalidTitle
    case invalidTimestamp
}

public enum TodoEditingError: Error, Sendable, Equatable {
    case invalidID
    case missingTodo
    case deletedTodo
    case malformedRecord(TodoDiagnostic.Issue)
}

public enum WorkspaceOpeningError: Error, Equatable {
    case invalidDocumentID
    case missingSchemaVersion
    case conflictingSchemaVersions
    case invalidSchemaVersionType
    case unsupportedSchemaVersion(Int64)
    case missingTodos
    case invalidTodosType
    case competingTodosMaps
}

public actor WorkspaceStore {
    public nonisolated let documentID: DocumentId
    private let document: Document

    private init(documentID: DocumentId, document: Document) {
        self.documentID = documentID
        self.document = document
    }

    public static func createNew() throws -> WorkspaceStore {
        let documentID = DocumentId()
        let document = Document()
        try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
        _ = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
        return WorkspaceStore(documentID: documentID, document: document)
    }

    public static func open(documentID: String, documentData: Data) throws -> WorkspaceStore {
        // the pinned base58 decoder traps on payloads shorter than its checksum
        guard (20...28).contains(documentID.utf8.count), let identity = DocumentId(documentID) else {
            throw WorkspaceOpeningError.invalidDocumentID
        }
        let document = try Document(documentData)
        try validateRoot(document)
        return WorkspaceStore(documentID: identity, document: document)
    }

    public func serialize() -> WorkspaceSnapshot {
        WorkspaceSnapshot(documentID: documentID.id, documentData: document.save())
    }

    public func addTodo(title: String, createdAt: Date = Date()) throws -> TodoProjection {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw TodoCreationError.invalidTitle
        }
        let milliseconds = createdAt.timeIntervalSince1970 * 1000
        guard milliseconds.isFinite,
              milliseconds >= -9_223_372_036_854_775_808.0,
              milliseconds < 9_223_372_036_854_775_808.0 else {
            throw TodoCreationError.invalidTimestamp
        }
        let todos = try Self.object(document, parent: .ROOT, key: "todos", type: .Map)
        var id: String
        repeat {
            id = UUID().uuidString.lowercased()
        } while !(try document.getAll(obj: todos, key: id)).isEmpty
        let record = try document.putObject(obj: todos, key: id, ty: .Map)
        let text = try document.putObject(obj: record, key: "title", ty: .Text)
        try document.spliceText(obj: text, start: 0, delete: 0, value: title)
        _ = try document.putObject(obj: record, key: "notes", ty: .Text)
        try document.put(obj: record, key: "completed", value: .Boolean(false))
        try document.put(obj: record, key: "createdAt", value: .Timestamp(createdAt))
        return try projection(id: id, record: record)
    }

    public func editTitle(id: String, title: String) throws -> TodoProjection {
        try editText(id: id, field: "title", value: title)
    }

    public func editNotes(id: String, notes: String) throws -> TodoProjection {
        try editText(id: id, field: "notes", value: notes)
    }

    public func setCompleted(id: String, completed: Bool) throws -> TodoProjection {
        let record = try editableRecord(id: id)
        // always assign, an equal selected value can still hide a competing one
        try document.put(obj: record, key: "completed", value: .Boolean(completed))
        return try projection(id: id, record: record)
    }

    private func editText(id: String, field: String, value: String) throws -> TodoProjection {
        let record = try editableRecord(id: id)
        let text: ObjId
        do {
            text = try Self.object(document, parent: record, key: field, type: .Text)
        } catch let issue as TodoDiagnostic.Issue {
            throw TodoEditingError.malformedRecord(issue)
        }
        try document.updateText(obj: text, value: value)
        return try projection(id: id, record: record)
    }

    public func deleteTodo(id: String) throws {
        let target = try targetRecord(id: id)
        guard !target.deleted else { return }
        try document.put(obj: target.record, key: "deleted", value: .Boolean(true))
    }

    private func editableRecord(id: String) throws -> ObjId {
        let target = try targetRecord(id: id)
        guard !target.deleted else { throw TodoEditingError.deletedTodo }
        return target.record
    }

    private func targetRecord(id: String) throws -> (record: ObjId, deleted: Bool) {
        guard Self.isValidTodoID(id) else { throw TodoEditingError.invalidID }
        do {
            let todos = try Self.object(document, parent: .ROOT, key: "todos", type: .Map)
            guard !(try document.getAll(obj: todos, key: id)).isEmpty else {
                throw TodoEditingError.missingTodo
            }
            let record = try Self.object(document, parent: todos, key: id, type: .Map)
            if try Self.isDeleted(document, record: record) { return (record, true) }
            _ = try projection(id: id, record: record)
            return (record, false)
        } catch let issue as TodoDiagnostic.Issue {
            throw TodoEditingError.malformedRecord(issue)
        }
    }

    private static func isDeleted(_ document: Document, record: ObjId) throws -> Bool {
        let markers = try document.getAll(obj: record, key: "deleted")
        guard markers.allSatisfy({ $0 == .Scalar(.Boolean(true)) }) else {
            throw TodoDiagnostic.Issue.invalidDeleted
        }
        return !markers.isEmpty
    }

    private static func isValidTodoID(_ id: String) -> Bool {
        guard let uuid = UUID(uuidString: id), uuid.uuidString.lowercased() == id else { return false }
        return id[id.index(id.startIndex, offsetBy: 14)] == "4"
            && "89ab".contains(id[id.index(id.startIndex, offsetBy: 19)])
    }

    public func readTodos() throws -> TodoReadResult {
        let todos = try Self.object(document, parent: .ROOT, key: "todos", type: .Map)
        var projections: [TodoProjection] = []
        var diagnostics: [TodoDiagnostic] = []
        for key in document.keys(obj: todos).sorted(by: { $0.utf8.lexicographicallyPrecedes($1.utf8) }) {
            do {
                guard Self.isValidTodoID(key) else {
                    throw TodoDiagnostic.Issue.invalidID
                }
                let record = try Self.object(document, parent: todos, key: key, type: .Map)
                if try Self.isDeleted(document, record: record) { continue }
                projections.append(try projection(id: key, record: record))
            } catch let issue as TodoDiagnostic.Issue {
                diagnostics.append(TodoDiagnostic(key: key, issue: issue))
            }
        }
        return TodoReadResult(todos: projections, diagnostics: diagnostics)
    }

    private func projection(id: String, record: ObjId) throws -> TodoProjection {
        let title = try Self.object(document, parent: record, key: "title", type: .Text)
        let notes = try Self.object(document, parent: record, key: "notes", type: .Text)
        let completions = try document.getAll(obj: record, key: "completed")
        guard !completions.isEmpty else { throw TodoDiagnostic.Issue.missingField("completed") }
        guard completions.allSatisfy({ if case .Scalar(.Boolean) = $0 { true } else { false } }),
              case let .Scalar(.Boolean(completed)) = try document.get(obj: record, key: "completed") else {
            throw TodoDiagnostic.Issue.invalidType("completed")
        }
        let dates = try document.getAll(obj: record, key: "createdAt")
        guard !dates.isEmpty else { throw TodoDiagnostic.Issue.missingField("createdAt") }
        guard dates.allSatisfy({ if case .Scalar(.Timestamp) = $0 { true } else { false } }) else {
            throw TodoDiagnostic.Issue.invalidType("createdAt")
        }
        guard dates.count == 1 else { throw TodoDiagnostic.Issue.conflictingCreatedAt }
        guard case let .Scalar(.Timestamp(date)) = dates.first else {
            throw TodoDiagnostic.Issue.invalidType("createdAt")
        }
        return TodoProjection(id: id, title: try document.text(obj: title), notes: try document.text(obj: notes),
                              completed: completed, createdAt: date)
    }

    private static func object(_ document: Document, parent: ObjId, key: String, type: ObjType) throws -> ObjId {
        let values = try document.getAll(obj: parent, key: key)
        guard !values.isEmpty else { throw TodoDiagnostic.Issue.missingField(key) }
        guard values.allSatisfy({ if case let .Object(_, actual) = $0 { actual == type } else { false } }) else {
            throw TodoDiagnostic.Issue.invalidType(key)
        }
        guard values.count == 1 else { throw TodoDiagnostic.Issue.competingObjects(key) }
        guard case let .Object(id, _) = values.first else { throw TodoDiagnostic.Issue.invalidType(key) }
        return id
    }

    private static func validateRoot(_ document: Document) throws {
        let versions = try document.getAll(obj: .ROOT, key: "schemaVersion")
        guard let version = versions.first else {
            throw WorkspaceOpeningError.missingSchemaVersion
        }
        guard versions.count == 1 else {
            throw WorkspaceOpeningError.conflictingSchemaVersions
        }
        guard case let .Scalar(.Int(number)) = version else {
            throw WorkspaceOpeningError.invalidSchemaVersionType
        }
        guard number == 1 else {
            throw WorkspaceOpeningError.unsupportedSchemaVersion(number)
        }

        let todos = try document.getAll(obj: .ROOT, key: "todos")
        guard !todos.isEmpty else {
            throw WorkspaceOpeningError.missingTodos
        }
        guard todos.allSatisfy({ if case .Object(_, .Map) = $0 { true } else { false } }) else {
            throw WorkspaceOpeningError.invalidTodosType
        }
        guard todos.count == 1 else {
            throw WorkspaceOpeningError.competingTodosMaps
        }
    }
}
