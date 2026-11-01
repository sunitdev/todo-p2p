import Automerge
import AutomergeRepo
import Foundation
import Testing
import TodoP2PCore

@Test func independentWorkspaceCreation() async throws {
    let first = try WorkspaceStore.createNew()
    let second = try WorkspaceStore.createNew()
    #expect(first.documentID != second.documentID)
    for store in [first, second] {
        let snapshot = await store.serialize()
        #expect(snapshot.documentID == store.documentID.id)
        #expect(DocumentId(snapshot.documentID) == store.documentID)
        #expect(!snapshot.documentData.isEmpty)
        let document = try Document(snapshot.documentData)
        #expect(Set(document.keys(obj: .ROOT)) == ["schemaVersion", "todos"])
        #expect(try document.getAll(obj: .ROOT, key: "schemaVersion") == [.Scalar(.Int(1))])
        let values = try document.getAll(obj: .ROOT, key: "todos")
        #expect(values.count == 1)
        guard case let .Object(todos, .Map) = try #require(values.first) else {
            Issue.record("expected the todos map")
            return
        }
        #expect(document.keys(obj: todos).isEmpty)
        #expect(document.length(obj: todos) == 0)
    }
}

@Test func workspaceSnapshotRoundTrip() async throws {
    let original = try WorkspaceStore.createNew()
    let snapshot = await original.serialize()
    let opened = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
    #expect(opened.documentID == original.documentID)
    let reopened = await opened.serialize()
    #expect(reopened.documentID == snapshot.documentID)
    try expectSameState(Document(snapshot.documentData), Document(reopened.documentData))
}

@Test func openingPreservesObjectsUnknownFieldsAndHistory() async throws {
    let document = try validDocument()
    try document.put(obj: .ROOT, key: "futureScalar", value: .String("old"))
    let oldHeads = document.heads()
    try document.put(obj: .ROOT, key: "futureScalar", value: .String("current"))
    let object = try document.putObject(obj: .ROOT, key: "futureObject", ty: .Map)
    try document.put(obj: object, key: "retained", value: .Boolean(true))
    let text = try document.putObject(obj: object, key: "text", ty: .Text)
    try document.spliceText(obj: text, start: 0, delete: 0, value: "retained text")
    let list = try document.putObject(obj: object, key: "list", ty: .List)
    try document.insert(obj: list, index: 0, value: .Int(42))
    let branch = document.fork()
    try document.put(obj: .ROOT, key: "futureConflict", value: .String("left"))
    try branch.put(obj: .ROOT, key: "futureConflict", value: .String("right"))
    try document.merge(other: branch)
    #expect(try document.getAll(obj: .ROOT, key: "futureConflict").count == 2)
    #expect(document.heads().count == 2)
    let todosValue = try document.get(obj: .ROOT, key: "todos")
    let objectValue = try document.get(obj: .ROOT, key: "futureObject")
    let textValue = try document.get(obj: object, key: "text")
    let listValue = try document.get(obj: object, key: "list")
    let before = try observedState(document)
    let documentID = DocumentId().id
    let store = try WorkspaceStore.open(documentID: documentID, documentData: document.save())
    let snapshot = await store.serialize()
    #expect(snapshot.documentID == documentID)
    let reloaded = try Document(snapshot.documentData)
    #expect(try observedState(document) == before)
    try expectSameState(document, reloaded)
    #expect(try reloaded.get(obj: .ROOT, key: "todos") == todosValue)
    #expect(try reloaded.get(obj: .ROOT, key: "futureObject") == objectValue)
    #expect(try reloaded.get(obj: object, key: "retained") == .Scalar(.Boolean(true)))
    #expect(try reloaded.get(obj: object, key: "text") == textValue)
    #expect(try reloaded.text(obj: text) == "retained text")
    #expect(try reloaded.get(obj: object, key: "list") == listValue)
    #expect(try reloaded.get(obj: list, index: 0) == .Scalar(.Int(42)))
    #expect(try reloaded.getAt(obj: .ROOT, key: "futureScalar", heads: oldHeads) == .Scalar(.String("old")))
}

@Test func openingRequiresSchemaVersionBeforeTodos() throws {
    try expectRejected(Document(), as: .missingSchemaVersion)
    let document = Document()
    _ = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
    try expectRejected(document, as: .missingSchemaVersion)
}

@Test(arguments: [
    ScalarValue.String("1"), .Uint(1), .F64(1), .Boolean(true),
    .Null, .Counter(1), .Timestamp(Date(timeIntervalSince1970: 1)), .Bytes(Data([1]))
])
func openingRejectsMalformedScalarVersions(value: ScalarValue) throws {
    let document = try validDocument()
    try document.put(obj: .ROOT, key: "schemaVersion", value: value)
    try expectRejected(document, as: .invalidSchemaVersionType)
}

@Test(arguments: [ObjType.Map, .Text, .List])
func openingRejectsObjectVersions(type: ObjType) throws {
    let document = try validDocument()
    _ = try document.putObject(obj: .ROOT, key: "schemaVersion", ty: type)
    try expectRejected(document, as: .invalidSchemaVersionType)
}

@Test(arguments: [Int64.min, -1, 0, 2, Int64.max])
func openingRejectsUnsupportedVersions(version: Int64) throws {
    let document = try validDocument()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(version))
    try expectRejected(document, as: .unsupportedSchemaVersion(version))
}

@Test(arguments: [ScalarValue.Int(2), .String("invalid")])
func openingRejectsDistinctVersionConflictsBeforeTypes(value: ScalarValue) throws {
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(0))
    let branch = document.fork()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    try branch.put(obj: .ROOT, key: "schemaVersion", value: value)
    try document.merge(other: branch)
    #expect(try document.getAll(obj: .ROOT, key: "schemaVersion") == [.Scalar(.Int(1)), .Scalar(value)])
    try expectRejected(document, as: .conflictingSchemaVersions)
}

@Test func openingAcceptsEqualConcurrentVersions() async throws {
    let document = try validDocument()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(0))
    let branch = document.fork()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    try branch.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    try document.merge(other: branch)
    #expect(document.heads().count == 2)
    #expect(try document.getAll(obj: .ROOT, key: "schemaVersion") == [.Scalar(.Int(1))])
    let before = try observedState(document)
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    let snapshot = await store.serialize()
    try expectSameState(document, Document(snapshot.documentData))
    #expect(try observedState(document) == before)
}

@Test func openingRequiresTodos() throws {
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    try expectRejected(document, as: .missingTodos)
}

@Test(arguments: [ScalarValue.String("map"), .Int(1), .Boolean(false), .Null])
func openingRejectsScalarTodos(value: ScalarValue) throws {
    let document = try validDocument()
    try document.put(obj: .ROOT, key: "todos", value: value)
    try expectRejected(document, as: .invalidTodosType)
}

@Test(arguments: [ObjType.Text, .List])
func openingRejectsNonMapObjectTodos(type: ObjType) throws {
    let document = try validDocument()
    _ = try document.putObject(obj: .ROOT, key: "todos", ty: type)
    try expectRejected(document, as: .invalidTodosType)
}

@Test func openingRejectsCompetingTodosMaps() throws {
    let document = try validDocument()
    let branch = document.fork()
    let left = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
    let right = try branch.putObject(obj: .ROOT, key: "todos", ty: .Map)
    try document.merge(other: branch)
    #expect(left != right)
    let values = try document.getAll(obj: .ROOT, key: "todos")
    #expect(values.count == 2)
    #expect(values.allSatisfy { if case .Object(_, .Map) = $0 { true } else { false } })
    try expectRejected(document, as: .competingTodosMaps)
}

@Test func openingRejectsMixedTodosBeforeCompetingMaps() throws {
    let document = try validDocument()
    let branch = document.fork()
    let third = document.fork()
    let left = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
    let right = try branch.putObject(obj: .ROOT, key: "todos", ty: .Map)
    try third.put(obj: .ROOT, key: "todos", value: .String("invalid"))
    try document.merge(other: branch)
    try document.merge(other: third)
    #expect(left != right)
    let values = try document.getAll(obj: .ROOT, key: "todos")
    #expect(values.count == 3)
    #expect(values.contains(.Scalar(.String("invalid"))))
    #expect(values.filter { if case .Object(_, .Map) = $0 { true } else { false } }.count == 2)
    try expectRejected(document, as: .invalidTodosType)
}

@Test func schemaValidationPrecedesTodosValidation() throws {
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .String("invalid"))
    try document.put(obj: .ROOT, key: "todos", value: .Boolean(false))
    try expectRejected(document, as: .invalidSchemaVersionType)
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(2))
    try expectRejected(document, as: .unsupportedSchemaVersion(2))
}

@Test(arguments: [
    "", "1", "111", "21111", "3QJmnh", "not-a-document-id", "00000000000000000000",
    "11111111111111111111", String(repeating: "1", count: 29), UUID().uuidString
])
func openingRejectsInvalidIdentity(documentID: String) throws {
    let bytes = try validDocument().save()
    #expect(throws: WorkspaceOpeningError.invalidDocumentID) {
        try WorkspaceStore.open(documentID: documentID, documentData: bytes)
    }
    #expect(throws: WorkspaceOpeningError.invalidDocumentID) {
        try WorkspaceStore.open(documentID: documentID, documentData: Data([0xFF]))
    }
}

@Test(arguments: [Data([0xFF]), Data("corrupt document".utf8)])
func openingPreservesAutomergeDecodingError(bytes: Data) throws {
    do {
        _ = try Document(bytes)
        Issue.record("expected corrupt bytes to fail decoding")
    } catch let original as LoadError {
        do {
            _ = try WorkspaceStore.open(documentID: DocumentId().id, documentData: bytes)
            Issue.record("expected opening to fail decoding")
        } catch let forwarded as LoadError {
            #expect(forwarded.errorDescription == original.errorDescription)
        }
    }
}

private func validDocument() throws -> Document {
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    _ = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
    return document
}

private struct ObservedState: Equatable {
    let root: [String: Set<Value>]
    let heads: Set<ChangeHash>
    let history: [ChangeHash]
}

private func observedState(_ document: Document) throws -> ObservedState {
    var root: [String: Set<Value>] = [:]
    for key in document.keys(obj: .ROOT) {
        root[key] = try document.getAll(obj: .ROOT, key: key)
    }
    return ObservedState(root: root, heads: document.heads(), history: document.getHistory())
}

private func expectSameState(_ original: Document, _ reloaded: Document) throws {
    #expect(try observedState(reloaded) == observedState(original))
    for hash in original.getHistory() {
        #expect(original.change(hash: hash) == reloaded.change(hash: hash))
    }
}

private func expectRejected(_ document: Document, as error: WorkspaceOpeningError) throws {
    let before = try observedState(document)
    let bytes = document.save()
    #expect(throws: error) {
        try WorkspaceStore.open(documentID: DocumentId().id, documentData: bytes)
    }
    #expect(try observedState(document) == before)
    try expectSameState(document, Document(bytes))
}
