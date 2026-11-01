import Automerge
import AutomergeRepo
import Foundation

public struct WorkspaceSnapshot: Sendable {
    public let documentID: String
    public let documentData: Data
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
