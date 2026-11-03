import Automerge
import AutomergeRepo
import Foundation
import Testing
@testable import TodoP2PCore

private enum Replica: String, CaseIterable, Sendable {
    case first, second

    var other: Replica { self == .first ? .second : .first }
}

private struct PumpLimit: Error, CustomStringConvertible {
    let description: String
}

private struct WorkspaceSyncHarness {
    let first: WorkspaceStore
    let second: WorkspaceStore
    let firstSession: WorkspaceSyncSession
    let secondSession: WorkspaceSyncSession

    init(snapshot: WorkspaceSnapshot) async throws {
        first = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
        second = try WorkspaceStore.open(documentID: snapshot.documentID, documentData: snapshot.documentData)
        let firstActor = await first.writerActor
        let secondActor = await second.writerActor
        try #require(firstActor != secondActor)
        firstSession = await first.startSyncSession()
        secondSession = await second.startSyncSession()
    }

    func store(_ side: Replica) -> WorkspaceStore { side == .first ? first : second }
    func session(_ side: Replica) -> WorkspaceSyncSession { side == .first ? firstSession : secondSession }

    @discardableResult
    func pump(starting side: Replica, label: String, limit: Int = 100) async throws -> Int {
        var messages = 0
        for _ in 0..<limit {
            let before = messages
            for sender in [side, side.other] {
                if let message = try await store(sender).generateSyncMessage(session: session(sender)) {
                    try await store(sender.other).receiveSyncMessage(session: session(sender.other), message: message)
                    messages += 1
                }
            }
            if messages == before { return messages }
        }
        let firstHeads = try Document(await first.serialize().documentData).heads()
        let secondHeads = try Document(await second.serialize().documentData).heads()
        throw PumpLimit(description: "\(label): starting=\(side.rawValue), rounds=\(limit), messages=\(messages), pending=0, firstHeads=\(firstHeads), secondHeads=\(secondHeads)")
    }

    func expectConverged(_ expected: TodoReadResult, starting side: Replica, label: String) async throws {
        try await pump(starting: side, label: label)
        for replica in [first, second] {
            #expect(try await replica.readTodos() == expected)
        }
        let a = await first.serialize()
        let b = await second.serialize()
        #expect(a.documentID == b.documentID)
        #expect(try Document(a.documentData).heads() == Document(b.documentData).heads())
        #expect(try await pump(starting: side, label: "\(label) extra quiet round") == 0)
    }
}

private let sharedID = "550e8400-e29b-41d4-a716-446655440000"
private let creationTime = Date(timeIntervalSince1970: 1_700_000_000)

private func syncFixture() throws -> WorkspaceSnapshot {
    let document = Document()
    try document.put(obj: .ROOT, key: "schemaVersion", value: .Int(1))
    let todos = try document.putObject(obj: .ROOT, key: "todos", ty: .Map)
    let record = try document.putObject(obj: todos, key: sharedID, ty: .Map)
    let title = try document.putObject(obj: record, key: "title", ty: .Text)
    try document.updateText(obj: title, value: "shared baseline")
    _ = try document.putObject(obj: record, key: "notes", ty: .Text)
    try document.put(obj: record, key: "completed", value: .Boolean(false))
    try document.put(obj: record, key: "createdAt", value: .Timestamp(creationTime))
    try document.put(obj: record, key: "futureScalar", value: .String("retained"))
    let future = try document.putObject(obj: .ROOT, key: "future", ty: .Map)
    try document.put(obj: future, key: "flag", value: .Boolean(true))
    try document.put(obj: todos, key: "invalid-key", value: .String("diagnostic fixture"))
    _ = document.heads()
    try document.put(obj: .ROOT, key: "earlier", value: .String("history retained"))
    return WorkspaceSnapshot(documentID: DocumentId().id, documentData: document.save())
}

private func sharedTodo(title: String = "shared baseline", notes: String = "", completed: Bool = false) -> TodoProjection {
    TodoProjection(id: sharedID, title: title, notes: notes, completed: completed, createdAt: creationTime)
}

private func expectedResult(_ todos: [TodoProjection]) -> TodoReadResult {
    TodoReadResult(todos: todos.sorted { $0.id.utf8.lexicographicallyPrecedes($1.id.utf8) },
                   diagnostics: [TodoDiagnostic(key: "invalid-key", issue: .invalidID)])
}

private func object(_ document: Document, parent: ObjId, key: String) throws -> ObjId {
    guard case let .Object(id, _) = try #require(try document.get(obj: parent, key: key)) else {
        throw TodoDiagnostic.Issue.invalidType(key)
    }
    return id
}

private func expectPreserved(_ before: WorkspaceSnapshot, on store: WorkspaceStore) async throws {
    let snapshot = await store.serialize()
    #expect(snapshot.documentID == before.documentID)
    let original = try Document(before.documentData)
    let after = try Document(snapshot.documentData)
    let heads = original.heads()
    for hash in original.getHistory() { #expect(after.change(hash: hash) == original.change(hash: hash)) }
    let todos = try object(after, parent: .ROOT, key: "todos")
    #expect(try after.getAt(obj: .ROOT, key: "todos", heads: heads) == .Object(todos, .Map))
    let oldTodos = try object(original, parent: .ROOT, key: "todos")
    for id in original.keys(obj: oldTodos) where UUID(uuidString: id) != nil {
        let record = try object(after, parent: todos, key: id)
        #expect(try after.getAt(obj: todos, key: id, heads: heads) == .Object(record, .Map))
        for field in ["title", "notes"] {
            let text = try object(after, parent: record, key: field)
            #expect(try after.getAt(obj: record, key: field, heads: heads) == .Object(text, .Text))
        }
    }
    let record = try object(after, parent: todos, key: sharedID)
    #expect(try after.get(obj: record, key: "futureScalar") == .Scalar(.String("retained")))
    let future = try object(after, parent: .ROOT, key: "future")
    #expect(try after.getAt(obj: .ROOT, key: "future", heads: heads) == .Object(future, .Map))
    #expect(try after.get(obj: future, key: "flag") == .Scalar(.Boolean(true)))
    #expect(try after.get(obj: .ROOT, key: "earlier") == .Scalar(.String("history retained")))
    #expect(try after.get(obj: todos, key: "invalid-key") == .Scalar(.String("diagnostic fixture")))
}

@Test(arguments: Replica.allCases)
private func sharedBaselineSync(starting: Replica) async throws {
    let baseline = try syncFixture()
    let harness = try await WorkspaceSyncHarness(snapshot: baseline)
    try await harness.expectConverged(expectedResult([sharedTodo()]), starting: starting, label: "baseline")
    for store in [harness.first, harness.second] { try await expectPreserved(baseline, on: store) }
}

@Test(arguments: Replica.allCases)
private func independentAdditionsSync(starting: Replica) async throws {
    let harness = try await WorkspaceSyncHarness(snapshot: syncFixture())
    let a = try await harness.first.addTodo(title: "first addition 🌱", createdAt: creationTime.addingTimeInterval(1))
    let b = try await harness.second.addTodo(title: "second addition", createdAt: creationTime.addingTimeInterval(2))
    #expect(a.id != b.id)
    for id in [a.id, b.id] { #expect(UUID(uuidString: id)?.uuidString.lowercased() == id) }
    let beforeA = await harness.first.serialize()
    let beforeB = await harness.second.serialize()
    let expectedA = TodoProjection(id: a.id, title: "first addition 🌱", notes: "", completed: false,
                                  createdAt: creationTime.addingTimeInterval(1))
    let expectedB = TodoProjection(id: b.id, title: "second addition", notes: "", completed: false,
                                  createdAt: creationTime.addingTimeInterval(2))
    #expect(a == expectedA)
    #expect(b == expectedB)
    try await harness.expectConverged(expectedResult([sharedTodo(), expectedA, expectedB]), starting: starting, label: "additions")
    for store in [harness.first, harness.second] {
        try await expectPreserved(beforeA, on: store)
        try await expectPreserved(beforeB, on: store)
    }
}

@Test(arguments: Replica.allCases, [false, true])
private func independentFieldsAndSessionReuse(starting: Replica, completion: Bool) async throws {
    let baseline = try syncFixture()
    let harness = try await WorkspaceSyncHarness(snapshot: baseline)
    try await harness.expectConverged(expectedResult([sharedTodo()]), starting: starting, label: "initial handshake")
    _ = try await harness.first.editTitle(id: sharedID, title: "edited title")
    if completion {
        _ = try await harness.second.setCompleted(id: sharedID, completed: true)
    } else {
        _ = try await harness.second.editNotes(id: sharedID, notes: "independent notes 📝")
    }
    let notes = completion ? "" : "independent notes 📝"
    try await harness.expectConverged(expectedResult([sharedTodo(title: "edited title", notes: notes, completed: completion)]),
                                      starting: starting, label: "independent fields")
    _ = try await harness.first.editNotes(id: sharedID, notes: "later first edit")
    try await harness.expectConverged(expectedResult([sharedTodo(title: "edited title", notes: "later first edit", completed: completion)]),
                                      starting: starting.other, label: "first reused session")
    _ = try await harness.second.editTitle(id: sharedID, title: "later second edit")
    try await harness.expectConverged(expectedResult([sharedTodo(title: "later second edit", notes: "later first edit", completed: completion)]),
                                      starting: starting, label: "second reused session")
    for store in [harness.first, harness.second] { try await expectPreserved(baseline, on: store) }
}

@Test private func syncReceiveFailurePropagates() async throws {
    let harness = try await WorkspaceSyncHarness(snapshot: syncFixture())
    await #expect(throws: (any Error).self) {
        try await harness.first.receiveSyncMessage(session: harness.firstSession, message: Data([0xff]))
    }
}

@Test(arguments: Replica.allCases)
private func syncPumpLimitFails(starting: Replica) async throws {
    let harness = try await WorkspaceSyncHarness(snapshot: syncFixture())
    do {
        try await harness.pump(starting: starting, label: "limit fixture", limit: 1)
        Issue.record("expected the pump limit to fail")
    } catch let error as PumpLimit {
        #expect(error.description.contains("limit fixture"))
        #expect(error.description.contains("starting=\(starting.rawValue)"))
        #expect(error.description.contains("rounds=1"))
        #expect(error.description.contains("firstHeads="))
        #expect(error.description.contains("secondHeads="))
    }
}
