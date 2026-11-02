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

@Test func addingAndReadingTwoTodos() async throws {
    let store = try WorkspaceStore.createNew()
    let date = Date(timeIntervalSince1970: 1_793_534_400.1259)
    let first = try await store.addTodo(title: "  Buy 🥛 e\u{301}\n", createdAt: date)
    let second = try await store.addTodo(title: "Second", createdAt: date)
    #expect(first.id != second.id)
    for todo in [first, second] {
        let uuid = try #require(UUID(uuidString: todo.id))
        #expect(uuid.uuidString.lowercased() == todo.id)
        #expect(todo.id[todo.id.index(todo.id.startIndex, offsetBy: 14)] == "4")
        #expect("89ab".contains(todo.id[todo.id.index(todo.id.startIndex, offsetBy: 19)]))
        #expect(!todo.completed)
        #expect(todo.notes.isEmpty)
        #expect(todo.createdAt == Date(timeIntervalSince1970: 1_793_534_400.125))
    }
    #expect(first.title == "  Buy 🥛 e\u{301}\n")
    #expect(second.title == "Second")
    let before = await store.serialize()
    let expected = [first, second].sorted { $0.id.utf8.lexicographicallyPrecedes($1.id.utf8) }
    for _ in 0..<3 {
        let result = try await store.readTodos()
        #expect(result.todos == expected)
        #expect(result.diagnostics.isEmpty)
    }
    let after = await store.serialize()
    try expectSameState(Document(before.documentData), Document(after.documentData))
    let document = try Document(after.documentData)
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    for todo in expected {
        let record = try fixtureObject(document, parent: todos, key: todo.id)
        #expect(Set(document.keys(obj: record)) == ["title", "notes", "completed", "createdAt"])
        for field in ["title", "notes"] {
            guard case let .Object(text, .Text) = try document.get(obj: record, key: field) else {
                Issue.record("expected Text object")
                return
            }
            #expect(try document.text(obj: text) == (field == "title" ? todo.title : ""))
        }
        #expect(try document.get(obj: record, key: "completed") == .Scalar(.Boolean(false)))
        #expect(try document.get(obj: record, key: "createdAt") == .Scalar(.Timestamp(todo.createdAt)))
        #expect(try document.getAll(obj: record, key: "deleted").isEmpty)
    }
    let reopened = try WorkspaceStore.open(documentID: after.documentID, documentData: after.documentData)
    #expect(reopened.documentID == store.documentID)
    #expect(try await reopened.readTodos().todos == expected)
}

@Test(arguments: ["", " ", "\n\t\r", "\u{2003}\u{00a0}"])
func invalidCreationTitlesDoNotMutate(title: String) async throws {
    let store = try WorkspaceStore.createNew()
    let before = await store.serialize()
    await #expect(throws: TodoCreationError.invalidTitle) { try await store.addTodo(title: title) }
    let after = await store.serialize()
    try expectSameState(Document(before.documentData), Document(after.documentData))
}

@Test(arguments: [Double.nan, .infinity, -.infinity, 9_223_372_036_854_776.0, -9_223_372_036_854_778.0])
func invalidCreationDatesDoNotMutate(seconds: Double) async throws {
    let store = try WorkspaceStore.createNew()
    let before = await store.serialize()
    await #expect(throws: TodoCreationError.invalidTimestamp) {
        try await store.addTodo(title: "Valid", createdAt: Date(timeIntervalSince1970: seconds))
    }
    let after = await store.serialize()
    try expectSameState(Document(before.documentData), Document(after.documentData))
}

@Test func addingPreservesExistingObjectsAndUnknownData() async throws {
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let record = try fixtureTodo(document, todos: todos, key: fixtureID)
    let text = try fixtureObject(document, parent: record, key: "title")
    try document.put(obj: record, key: "unknown", value: .String("retained"))
    let future = try document.putObject(obj: .ROOT, key: "future", ty: .Map)
    try document.put(obj: future, key: "flag", value: .Boolean(true))
    let history = document.getHistory()
    let heads = document.heads()
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    let added = try await store.addTodo(title: "new")
    #expect(added.id != fixtureID)
    let snapshot = await store.serialize()
    let after = try Document(snapshot.documentData)
    let afterTodos = try fixtureObject(after, parent: .ROOT, key: "todos")
    let afterRecord = try fixtureObject(after, parent: afterTodos, key: fixtureID)
    let afterText = try fixtureObject(after, parent: afterRecord, key: "title")
    #expect(try after.getAt(obj: .ROOT, key: "todos", heads: heads) == .Object(afterTodos, .Map))
    #expect(try after.getAt(obj: afterTodos, key: fixtureID, heads: heads) == .Object(afterRecord, .Map))
    #expect(try after.getAt(obj: afterRecord, key: "title", heads: heads) == .Object(afterText, .Text))
    #expect(try after.text(obj: text) == "existing")
    #expect(try after.get(obj: record, key: "unknown") == .Scalar(.String("retained")))
    let afterFuture = try fixtureObject(after, parent: .ROOT, key: "future")
    #expect(try after.getAt(obj: .ROOT, key: "future", heads: heads) == .Object(afterFuture, .Map))
    #expect(try after.get(obj: future, key: "flag") == .Scalar(.Boolean(true)))
    for hash in history { #expect(after.change(hash: hash) == document.change(hash: hash)) }
    #expect(try await store.readTodos().todos.count == 2)
}

private let fixtureID = "550e8400-e29b-41d4-a716-446655440000"

private func fixtureObject(_ document: Document, parent: ObjId, key: String) throws -> ObjId {
    guard case let .Object(id, _) = try #require(try document.get(obj: parent, key: key)) else {
        throw TodoDiagnostic.Issue.invalidType(key)
    }
    return id
}

@discardableResult
private func fixtureTodo(_ document: Document, todos: ObjId, key: String) throws -> ObjId {
    let record = try document.putObject(obj: todos, key: key, ty: .Map)
    let title = try document.putObject(obj: record, key: "title", ty: .Text)
    try document.spliceText(obj: title, start: 0, delete: 0, value: "existing")
    _ = try document.putObject(obj: record, key: "notes", ty: .Text)
    try document.put(obj: record, key: "completed", value: .Boolean(false))
    try document.put(obj: record, key: "createdAt", value: .Timestamp(Date(timeIntervalSince1970: 1)))
    return record
}

@Test(arguments: ["title", "notes", "completed", "createdAt"])
func malformedRequiredFieldsAreDiagnosed(field: String) async throws {
    for missing in [true, false] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        let record = try fixtureTodo(document, todos: todos, key: fixtureID)
        if missing { try document.delete(obj: record, key: field) }
        else { try document.put(obj: record, key: field, value: .String("invalid")) }
        try fixtureTodo(document, todos: todos, key: "00000000-0000-4000-8000-000000000000")
        try await expectRead(document, ids: ["00000000-0000-4000-8000-000000000000"],
                             issue: missing ? .missingField(field) : .invalidType(field))
    }
}

@Test func malformedKeysAndRecordsAreDiagnosed() async throws {
    for key in ["invalid", fixtureID.uppercased(), "550e8400-e29b-11d4-a716-446655440000",
                "550e8400-e29b-41d4-7716-446655440000"] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        try fixtureTodo(document, todos: todos, key: key)
        try await expectRead(document, ids: [], issue: .invalidID)
    }
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    try document.put(obj: todos, key: fixtureID, value: .Null)
    try await expectRead(document, ids: [], issue: .invalidType(fixtureID))
}

@Test(arguments: ["record", "title", "notes", "createdAt", "completed", "mixedCompletion", "deleted"])
func competingValuesFollowReadPolicy(field: String) async throws {
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let record = try fixtureTodo(document, todos: todos, key: fixtureID)
    let branch = document.fork()
    var issue: TodoDiagnostic.Issue?
    switch field {
    case "record":
        _ = try fixtureTodo(document, todos: todos, key: fixtureID)
        _ = try fixtureTodo(branch, todos: todos, key: fixtureID)
        issue = .competingObjects(fixtureID)
    case "title", "notes":
        _ = try document.putObject(obj: record, key: field, ty: .Text)
        _ = try branch.putObject(obj: record, key: field, ty: .Text)
        issue = .competingObjects(field)
    case "createdAt":
        try document.put(obj: record, key: field, value: .Timestamp(Date(timeIntervalSince1970: 2)))
        try branch.put(obj: record, key: field, value: .Timestamp(Date(timeIntervalSince1970: 3)))
        issue = .conflictingCreatedAt
    case "completed", "mixedCompletion":
        try document.put(obj: record, key: "completed", value: .Boolean(true))
        try branch.put(obj: record, key: "completed", value: .Boolean(true))
        try branch.put(obj: record, key: "completed", value: field == "completed" ? .Boolean(false) : .Int(0))
        if field == "mixedCompletion" { issue = .invalidType("completed") }
    default:
        try document.put(obj: record, key: "deleted", value: .Boolean(true))
        try branch.put(obj: record, key: "deleted", value: .Boolean(false))
        issue = .invalidDeleted
    }
    try document.merge(other: branch)
    try await expectRead(document, ids: issue == nil ? [fixtureID] : [], issue: issue)
    if field == "completed" {
        #expect(try document.getAll(obj: record, key: field) == [.Scalar(.Boolean(true)), .Scalar(.Boolean(false))])
        let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
        let projected = try #require(await store.readTodos().todos.first)
        #expect(try document.get(obj: record, key: field) == .Scalar(.Boolean(projected.completed)))
    }
}

@Test func existingTextAndDeletionVisibility() async throws {
    for marker in [ScalarValue.Boolean(true), .Boolean(false), .Null] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        let record = try fixtureTodo(document, todos: todos, key: fixtureID)
        try document.put(obj: record, key: "deleted", value: marker)
        try document.delete(obj: record, key: "title")
        try await expectRead(document, ids: [], issue: marker == .Boolean(true) ? nil : .invalidDeleted)
    }
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let record = try fixtureTodo(document, todos: todos, key: fixtureID)
    let title = try fixtureObject(document, parent: record, key: "title")
    let notes = try fixtureObject(document, parent: record, key: "notes")
    try document.spliceText(obj: title, start: 0, delete: 8, value: " \n")
    try document.spliceText(obj: notes, start: 0, delete: 0, value: "actual notes 📝")
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    let todo = try #require(await store.readTodos().todos.first)
    #expect(todo.title == " \n")
    #expect(todo.notes == "actual notes 📝")
    try await expectRead(document, ids: [fixtureID], issue: nil)
}

private func expectRead(_ document: Document, ids: [String], issue: TodoDiagnostic.Issue?) async throws {
    let before = try observedState(document)
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    let result = try await store.readTodos()
    #expect(result.todos.map(\.id) == ids)
    #expect(result.diagnostics.map(\.issue) == issue.map { [$0] } ?? [])
    if !result.diagnostics.isEmpty { #expect(result.diagnostics.first?.key == fixtureID || issue == .invalidID) }
    let after = await store.serialize()
    try expectSameState(document, Document(after.documentData))
    #expect(try observedState(document) == before)
}

@Test func readsUseOrdinalUUIDOrdering() async throws {
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let keys = ["ffffffff-ffff-4fff-bfff-ffffffffffff", fixtureID, "00000000-0000-4000-8000-000000000000"]
    for key in keys { try fixtureTodo(document, todos: todos, key: key) }
    try await expectRead(document, ids: keys.reversed(), issue: nil)
}

@Test(arguments: [-1.1259, 0, 4_102_444_800.1259])
func creationAcceptsPastAndFutureDates(seconds: Double) async throws {
    let store = try WorkspaceStore.createNew()
    let date = Date(timeIntervalSince1970: seconds)
    let todo = try await store.addTodo(title: "dated", createdAt: date)
    let expected = Date(timeIntervalSince1970: Double(Int64(date.timeIntervalSince1970 * 1000)) / 1000)
    #expect(todo.createdAt == expected)
    #expect(try await store.readTodos().todos == [todo])
}

@Test func editingTextIndependentlyAndReopening() async throws {
    let store = try WorkspaceStore.createNew()
    let original = try await store.addTodo(title: "Original")
    let values = ["", " \t\n", "first\nsecond 📝👩🏽‍💻🇮🇪", "e\u{301}", "é", "e\u{301}", ""]
    var title = original.title
    var notes = original.notes
    for value in values {
        let titled = try await store.editTitle(id: original.id, title: value)
        title = value
        #expect(Array(titled.title.unicodeScalars) == Array(value.unicodeScalars))
        #expect(Array(titled.notes.unicodeScalars) == Array(notes.unicodeScalars))
        let noted = try await store.editNotes(id: original.id, notes: value)
        notes = value
        #expect(Array(noted.notes.unicodeScalars) == Array(value.unicodeScalars))
        #expect(Array(noted.title.unicodeScalars) == Array(title.unicodeScalars))
        #expect(noted.id == original.id)
        #expect(noted.createdAt == original.createdAt)
        #expect(noted.completed == original.completed)
        let read = try #require(await store.readTodos().todos.first)
        #expect(Array(read.title.unicodeScalars) == Array(title.unicodeScalars))
        #expect(Array(read.notes.unicodeScalars) == Array(notes.unicodeScalars))
    }
    _ = try await store.editTitle(id: original.id, title: "Final 📝")
    let edited = try await store.editNotes(id: original.id, notes: "e\u{301}\nfinal")
    let snapshot = await store.serialize()
    let reopened = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
    #expect(reopened.documentID == store.documentID)
    #expect(try await reopened.readTodos().todos == [edited])
}

@Test func editingPreservesIdentityUnknownDataAndHistory() async throws {
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let record = try fixtureTodo(document, todos: todos, key: fixtureID)
    let otherID = "00000000-0000-4000-8000-000000000000"
    let other = try fixtureTodo(document, todos: todos, key: otherID)
    try document.put(obj: record, key: "completed", value: .Boolean(true))
    let unknown = try document.putObject(obj: record, key: "future", ty: .Map)
    try document.put(obj: unknown, key: "data", value: .Bytes(Data([1, 2, 3])))
    let branch = document.fork()
    try document.put(obj: .ROOT, key: "unknown", value: .String("left"))
    try branch.put(obj: .ROOT, key: "unknown", value: .String("right"))
    try document.merge(other: branch)
    let title = try fixtureObject(document, parent: record, key: "title")
    let notes = try fixtureObject(document, parent: record, key: "notes")
    let heads = document.heads()
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    _ = try await store.editTitle(id: fixtureID, title: "changed")
    _ = try await store.editNotes(id: fixtureID, notes: "new notes")
    let snapshot = await store.serialize()
    let after = try Document(snapshot.documentData)
    for object in [ObjId.ROOT, todos, record, other, unknown] {
        #expect(Set(after.keys(obj: object)) == Set(document.keys(obj: object)))
        for key in document.keys(obj: object) {
            #expect(try after.getAll(obj: object, key: key) == after.getAllAt(obj: object, key: key, heads: heads))
        }
    }
    #expect(try after.text(obj: title) == "changed")
    #expect(try after.text(obj: notes) == "new notes")
    for field in ["title", "notes"] {
        let text = try fixtureObject(document, parent: other, key: field)
        #expect(try after.text(obj: text) == document.text(obj: text))
    }
    #expect(try after.textAt(obj: title, heads: heads) == "existing")
    #expect(try after.textAt(obj: notes, heads: heads) == "")
    for hash in document.getHistory() {
        #expect(after.getHistory().contains(hash))
        #expect(after.change(hash: hash) == document.change(hash: hash))
    }
}

@Test func invalidAndMissingEditIDsDoNotMutate() async throws {
    let document = try validDocument()
    for id in ["", "invalid", fixtureID.uppercased(), "550e8400-e29b-11d4-a716-446655440000",
               "550e8400-e29b-41d4-7716-446655440000", fixtureID] {
        try await expectEditRejected(document, id: id, error: id == fixtureID ? .missingTodo : .invalidID)
    }
}

@Test(arguments: ["title", "notes", "completed", "createdAt"])
func editingRejectsMissingAndMalformedFields(field: String) async throws {
    for missing in [true, false] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        let record = try fixtureTodo(document, todos: todos, key: fixtureID)
        if missing { try document.delete(obj: record, key: field) }
        else { try document.put(obj: record, key: field, value: .String("invalid")) }
        try await expectEditRejected(document, error: .malformedRecord(
            missing ? .missingField(field) : .invalidType(field)))
    }
}

@Test(arguments: ["record", "title", "notes", "createdAt", "completed", "deleted"])
func editingRejectsCompetingAndMixedValues(field: String) async throws {
    for mixed in [false, true] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        let record = try fixtureTodo(document, todos: todos, key: fixtureID)
        let branch = document.fork()
        let parent = field == "record" ? todos : record
        let key = field == "record" ? fixtureID : field
        let issue: TodoDiagnostic.Issue
        switch field {
        case "record", "title", "notes":
            let type: ObjType = field == "record" ? .Map : .Text
            _ = try document.putObject(obj: parent, key: key, ty: type)
            if mixed { try branch.put(obj: parent, key: key, value: .Null) }
            else { _ = try branch.putObject(obj: parent, key: key, ty: type) }
            issue = mixed ? .invalidType(key) : .competingObjects(key)
        case "createdAt":
            try document.put(obj: record, key: key, value: .Timestamp(Date(timeIntervalSince1970: 2)))
            try branch.put(obj: record, key: key, value: mixed ? .Null : .Timestamp(Date(timeIntervalSince1970: 3)))
            issue = mixed ? .invalidType(key) : .conflictingCreatedAt
        case "completed":
            try document.put(obj: record, key: key, value: .Boolean(true))
            try branch.put(obj: record, key: key, value: .Null)
            issue = .invalidType(key)
        default:
            try document.put(obj: record, key: key, value: .Boolean(true))
            try branch.put(obj: record, key: key, value: mixed ? .Null : .Boolean(false))
            issue = .invalidDeleted
        }
        try document.merge(other: branch)
        try await expectEditRejected(document, error: .malformedRecord(issue))
    }
}

@Test func editingRejectsDeletedAndMalformedRecords() async throws {
    for marker in [ScalarValue.Boolean(true), .Boolean(false), .Null] {
        let document = try validDocument()
        let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
        let record = try fixtureTodo(document, todos: todos, key: fixtureID)
        try document.put(obj: record, key: "deleted", value: marker)
        try document.delete(obj: record, key: "title")
        try await expectEditRejected(document, error: marker == .Boolean(true)
            ? .deletedTodo : .malformedRecord(.invalidDeleted))
    }
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    try document.put(obj: todos, key: fixtureID, value: .Null)
    try await expectEditRejected(document, error: .malformedRecord(.invalidType(fixtureID)))
}

@Test func editingAllowsBooleanCompletionConflicts() async throws {
    let document = try validDocument()
    let todos = try fixtureObject(document, parent: .ROOT, key: "todos")
    let record = try fixtureTodo(document, todos: todos, key: fixtureID)
    let branch = document.fork()
    try document.put(obj: record, key: "completed", value: .Boolean(true))
    try branch.put(obj: record, key: "completed", value: .Boolean(true))
    try branch.put(obj: record, key: "completed", value: .Boolean(false))
    try document.merge(other: branch)
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    let original = try #require(await store.readTodos().todos.first)
    let edited = try await store.editTitle(id: fixtureID, title: "new")
    #expect(edited.completed == original.completed)
    let snapshot = await store.serialize()
    let after = try Document(snapshot.documentData)
    #expect(try after.getAll(obj: record, key: "completed") == document.getAll(obj: record, key: "completed"))
}

private func expectEditRejected(_ document: Document, id: String = fixtureID,
                                error: TodoEditingError) async throws {
    let store = try WorkspaceStore.open(documentID: DocumentId().id, documentData: document.save())
    for title in [true, false] {
        let before = await store.serialize()
        await #expect(throws: error) {
            if title { _ = try await store.editTitle(id: id, title: "replacement") }
            else { _ = try await store.editNotes(id: id, notes: "replacement") }
        }
        let after = await store.serialize()
        #expect(after.documentID == before.documentID)
        #expect(after.documentData == before.documentData)
        try expectSameState(Document(before.documentData), Document(after.documentData))
    }
}
