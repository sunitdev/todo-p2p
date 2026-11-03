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

    init(first: WorkspaceStore, second: WorkspaceStore) async {
        self.first = first
        self.second = second
        firstSession = await first.startSyncSession()
        secondSession = await second.startSyncSession()
    }

    init(first: WorkspaceSnapshot, second: WorkspaceSnapshot) async throws {
        try #require(first.documentID == second.documentID)
        try await self.init(first: WorkspaceStore.open(documentID: first.documentID, documentData: first.documentData),
                        second: WorkspaceStore.open(documentID: second.documentID, documentData: second.documentData))
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

private func record(_ document: Document) throws -> ObjId {
    try object(document, parent: object(document, parent: .ROOT, key: "todos"), key: sharedID)
}

private func edit(_ store: WorkspaceStore, field: String, value: String) async throws {
    if field == "title" {
        _ = try await store.editTitle(id: sharedID, title: value)
    } else {
        _ = try await store.editNotes(id: sharedID, notes: value)
    }
}

private struct TextScenario: Sendable {
    let baseline: String
    let first: String
    let second: String
    let outcomes: [String]
}

private let textScenarios = [
    TextScenario(baseline: "hello world!", first: "Greetings world!", second: "hello wonderful world!",
                 outcomes: ["Greetings wonderful world!"]),
    TextScenario(baseline: "ab", first: "aXb", second: "aYb", outcomes: ["aXYb", "aYXb"]),
    TextScenario(baseline: "abcdef", first: "abXYef", second: "abf", outcomes: ["abXYf"]),
    TextScenario(baseline: "Cafe\u{301} 🌍 end", first: "Cafe\u{301} 🌍 fin", second: "Cafe\u{301} 🚀 end",
                 outcomes: ["Cafe\u{301} 🚀 fin"])
]

@Test(arguments: ["title", "notes"], textScenarios)
private func concurrentTextSync(field: String, scenario: TextScenario) async throws {
    let fixture = try syncFixture()
    let seed = try WorkspaceStore.open(documentID: fixture.documentID, documentData: fixture.documentData)
    try await edit(seed, field: field, value: scenario.baseline)
    let baseline = await seed.serialize()
    let authors = try await WorkspaceSyncHarness(snapshot: baseline)
    try await edit(authors.first, field: field, value: scenario.first)
    try await edit(authors.second, field: field, value: scenario.second)
    let a = await authors.first.serialize()
    let b = await authors.second.serialize()
    var selected: [UInt32]?
    for starting in Replica.allCases {
        let harness = try await WorkspaceSyncHarness(first: a, second: b)
        try await harness.pump(starting: starting, label: "text \(field)")
        let todo = try #require(try await harness.first.readTodos().todos.first)
        let text = field == "title" ? todo.title : todo.notes
        let scalars = text.unicodeScalars.map(\.value)
        #expect(scenario.outcomes.contains { $0.unicodeScalars.map(\.value) == scalars })
        if let selected { #expect(scalars == selected) } else { selected = scalars }
        let expected = sharedTodo(title: field == "title" ? text : "shared baseline", notes: field == "notes" ? text : "")
        try await harness.expectConverged(expectedResult([expected]), starting: starting, label: "text result")
        for store in [harness.first, harness.second] {
            let projected = try #require(try await store.readTodos().todos.first)
            #expect((field == "title" ? projected.title : projected.notes).unicodeScalars.map(\.value) == scalars)
            for snapshot in [baseline, a, b] { try await expectPreserved(snapshot, on: store) }
        }
    }
}

private let booleanConflict: Set<Value> = [.Scalar(.Boolean(true)), .Scalar(.Boolean(false))]

@Test(arguments: [false, true])
private func concurrentCompletionSync(requested: Bool) async throws {
    let baseline = try syncFixture()
    let authors = try await WorkspaceSyncHarness(snapshot: baseline)
    _ = try await authors.first.setCompleted(id: sharedID, completed: true)
    _ = try await authors.second.setCompleted(id: sharedID, completed: true)
    _ = try await authors.second.setCompleted(id: sharedID, completed: false)
    #expect(try await authors.first.readTodos() == expectedResult([sharedTodo(completed: true)]))
    #expect(try await authors.second.readTodos() == expectedResult([sharedTodo()]))
    let a = await authors.first.serialize()
    let b = await authors.second.serialize()
    var selected: Bool?
    for starting in Replica.allCases {
        let harness = try await WorkspaceSyncHarness(first: a, second: b)
        try await harness.pump(starting: starting, label: "completion conflict")
        let value = try #require(try await harness.first.readTodos().todos.first).completed
        if let selected { #expect(value == selected) } else { selected = value }
        try await harness.expectConverged(expectedResult([sharedTodo(completed: value)]), starting: starting, label: "selected completion")
        let conflictSnapshot = await harness.first.serialize()
        let conflictHeads = try Document(conflictSnapshot.documentData).heads()
        for store in [harness.first, harness.second] {
            let doc = try Document(await store.serialize().documentData)
            #expect(try doc.getAll(obj: record(doc), key: "completed") == booleanConflict)
            #expect(booleanConflict.contains(.Scalar(.Boolean(value))))
            #expect(try doc.get(obj: record(doc), key: "completed") == .Scalar(.Boolean(value)))
        }
        _ = try await harness.first.setCompleted(id: sharedID, completed: requested)
        try await harness.expectConverged(expectedResult([sharedTodo(completed: requested)]), starting: starting.other, label: "resolved completion")
        for store in [harness.first, harness.second] {
            let doc = try Document(await store.serialize().documentData)
            #expect(try doc.getAll(obj: record(doc), key: "completed") == [.Scalar(.Boolean(requested))])
            #expect(try doc.getAllAt(obj: record(doc), key: "completed", heads: conflictHeads) == booleanConflict)
            for snapshot in [baseline, a, b, conflictSnapshot] { try await expectPreserved(snapshot, on: store) }
        }
    }
}

private func expectDeleted(_ store: WorkspaceStore, title: String, notes: String, completed: Bool) async throws {
    #expect(try await store.readTodos() == expectedResult([]))
    let doc = try Document(await store.serialize().documentData)
    let target = try record(doc)
    #expect(try doc.getAll(obj: target, key: "deleted") == [.Scalar(.Boolean(true))])
    #expect(try doc.text(obj: object(doc, parent: target, key: "title")).unicodeScalars.map(\.value) == title.unicodeScalars.map(\.value))
    #expect(try doc.text(obj: object(doc, parent: target, key: "notes")).unicodeScalars.map(\.value) == notes.unicodeScalars.map(\.value))
    #expect(try doc.getAll(obj: target, key: "completed") == [.Scalar(.Boolean(completed))])
    #expect(try doc.get(obj: target, key: "createdAt") == .Scalar(.Timestamp(creationTime)))
    for field in ["title", "notes"] {
        await #expect(throws: TodoEditingError.deletedTodo) { try await edit(store, field: field, value: "rejected") }
    }
    for requested in [true, false] {
        await #expect(throws: TodoEditingError.deletedTodo) {
            _ = try await store.setCompleted(id: sharedID, completed: requested)
        }
    }
    try await store.deleteTodo(id: sharedID)
    #expect(try Document(await store.serialize().documentData).heads() == doc.heads())
}

@Test(arguments: [false, true])
private func concurrentDeletionSync(bothDelete: Bool) async throws {
    let baseline = try syncFixture()
    let authors = try await WorkspaceSyncHarness(snapshot: baseline)
    try await authors.first.deleteTodo(id: sharedID)
    if bothDelete {
        try await authors.second.deleteTodo(id: sharedID)
    } else {
        _ = try await authors.second.editTitle(id: sharedID, title: "offline title 🌱")
        _ = try await authors.second.editNotes(id: sharedID, notes: "offline notes e\u{301}")
        _ = try await authors.second.setCompleted(id: sharedID, completed: true)
        #expect(try await authors.second.readTodos() == expectedResult([sharedTodo(title: "offline title 🌱", notes: "offline notes e\u{301}", completed: true)]))
    }
    let a = await authors.first.serialize()
    let b = await authors.second.serialize()
    for starting in Replica.allCases {
        let harness = try await WorkspaceSyncHarness(first: a, second: b)
        try await harness.expectConverged(expectedResult([]), starting: starting, label: "concurrent deletion")
        for store in [harness.first, harness.second] {
            try await expectDeleted(store, title: bothDelete ? "shared baseline" : "offline title 🌱",
                                    notes: bothDelete ? "" : "offline notes e\u{301}", completed: !bothDelete)
            for snapshot in [baseline, a, b] { try await expectPreserved(snapshot, on: store) }
        }
        #expect(try await harness.pump(starting: starting, label: "deleted operations quiet") == 0)
    }
}

private func pumpAll(_ pairs: [WorkspaceSyncHarness], starting: Replica, limit: Int = 100) async throws -> Int {
    var messages = 0
    for _ in 0..<limit {
        var round = 0
        for pair in pairs { round += try await pair.pump(starting: starting, label: "three replica pair") }
        messages += round
        if round == 0 { return messages }
    }
    var heads: [String] = []
    for pair in pairs {
        heads.append(String(describing: try Document(await pair.first.serialize().documentData).heads()))
        heads.append(String(describing: try Document(await pair.second.serialize().documentData).heads()))
    }
    throw PumpLimit(description: "three replicas: sweeps=\(limit), messages=\(messages), heads=\(heads)")
}

@Test private func staleReplicaDeletionSync() async throws {
    let baseline = try syncFixture()
    let authors = try await WorkspaceSyncHarness(snapshot: baseline)
    let stale = try WorkspaceStore.open(documentID: baseline.documentID, documentData: baseline.documentData)
    let actors = [await authors.first.writerActor, await authors.second.writerActor, await stale.writerActor]
    try #require(Set(actors).count == 3)
    try await authors.first.deleteTodo(id: sharedID)
    try await authors.expectConverged(expectedResult([]), starting: .first, label: "deletion before stale return")
    #expect(try await stale.readTodos() == expectedResult([sharedTodo()]))
    _ = try await stale.editTitle(id: sharedID, title: "stale title 🚀")
    _ = try await stale.editNotes(id: sharedID, notes: "stale notes e\u{301}")
    _ = try await stale.setCompleted(id: sharedID, completed: true)
    #expect(try await stale.readTodos() == expectedResult([sharedTodo(title: "stale title 🚀", notes: "stale notes e\u{301}", completed: true)]))
    let snapshots = [await authors.first.serialize(), await authors.second.serialize(), await stale.serialize()]
    var finalHeads: Set<ChangeHash>?
    for starting in Replica.allCases {
        let stores = try snapshots.map { try WorkspaceStore.open(documentID: $0.documentID, documentData: $0.documentData) }
        let ab = await WorkspaceSyncHarness(first: stores[0], second: stores[1])
        let ac = await WorkspaceSyncHarness(first: stores[0], second: stores[2])
        let bc = await WorkspaceSyncHarness(first: stores[1], second: stores[2])
        let pairs = starting == .first ? [ac, ab, bc] : [bc, ab, ac]
        _ = try await pumpAll(pairs, starting: starting)
        let heads = try Document(await stores[0].serialize().documentData).heads()
        if let finalHeads { #expect(heads == finalHeads) } else { finalHeads = heads }
        for store in stores {
            #expect(try Document(await store.serialize().documentData).heads() == heads)
            try await expectDeleted(store, title: "stale title 🚀", notes: "stale notes e\u{301}", completed: true)
            for snapshot in [baseline] + snapshots { try await expectPreserved(snapshot, on: store) }
        }
        #expect(try await pumpAll(pairs, starting: starting) == 0)
    }
}
