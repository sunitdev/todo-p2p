import Automerge
import XCTest

@MainActor
final class WorkspaceUITests: XCTestCase {
    private var app: XCUIApplication!
    private var directory: URL!

    override func setUpWithError() throws {
        continueAfterFailure = false
        directory = URL(fileURLWithPath: "/tmp/todo-p2p-test-\(UUID().uuidString)")
        print("owned fixture: \(directory.path)")
        app = XCUIApplication()
        app.launchEnvironment["TODO_P2P_TEST_DIRECTORY"] = directory.path
        app.launchEnvironment["TODO_P2P_TEST_KEYCHAIN"] = directory.lastPathComponent
    }

    override func tearDownWithError() throws {
        app.terminate()
        if app.launchEnvironment["TODO_P2P_PAIRING_FIXTURE"] != nil {
            app.launchEnvironment["TODO_P2P_TEST_CLEANUP"] = "1"
            app.launch()
            if !app.staticTexts["Saved locally"].waitForExistence(timeout: 3) {
                XCTAssertTrue(app.staticTexts["This app’s signing configuration does not permit secure Keychain storage."].exists)
            }
            app.terminate()
        }
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
    }

    private func evidence(_ name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name + " accessibility"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func saved() {
        XCTAssertTrue(app.staticTexts["Saved locally"].waitForExistence(timeout: 10))
    }

    private func back() {
        app.navigationBars.buttons.firstMatch.tap()
    }

    private func addTodo(_ title: String) {
        XCTAssertTrue(app.buttons["Add todo"].waitForExistence(timeout: 10))
        app.buttons["Add todo"].tap()
        let field = app.textFields["creation-title"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(title)
        app.buttons["Add"].tap()
    }

    private func relaunch() {
        app.terminate()
        app.launch()
        saved()
    }

    private func replace(_ field: XCUIElement, with value: String) {
        field.tap()
        field.press(forDuration: 1.2)
        let selectAll = app.menuItems["Select All"]
        if selectAll.waitForExistence(timeout: 2) {
            selectAll.tap()
        } else {
            app.buttons["Select All"].tap()
        }
        field.typeText(value)
        XCTAssertEqual(field.value as? String, value)
    }

    private func reveal(_ button: XCUIElement) {
        for _ in 0..<6 {
            if button.isHittable { return }
            app.swipeUp()
        }
        XCTAssertTrue(button.isHittable)
    }

    private struct Envelope: Decodable {
        let documentID: String
        let documentData: Data
    }

    private func snapshot() throws -> (Envelope, Document) {
        app.terminate()
        let bytes = try Data(contentsOf: directory.appendingPathComponent("workspace.snapshot"))
        let envelope = try JSONDecoder().decode(Envelope.self, from: bytes)
        let attachment = XCTAttachment(data: bytes, uniformTypeIdentifier: "public.json")
        attachment.name = "synthetic snapshot"
        attachment.lifetime = .keepAlways
        add(attachment)
        return (envelope, try Document(envelope.documentData))
    }

    func testCRUDAndRecovery() throws {
        app.launch()
        addTodo("UI acceptance")
        saved()
        relaunch()
        XCTAssertEqual(app.staticTexts.matching(identifier: "UI acceptance").count, 1)
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'todo-'")).firstMatch
        XCTAssertTrue(row.exists)
        let id = String(row.identifier.dropFirst(5))
        row.tap()
        let title = app.textFields["editor-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        let edited = "Edited 日本語"
        let notes = "First line\n第二行 👩🏽‍💻\ne\u{301} τέλος\n" + String(repeating: "Long notes line\n", count: 30)
        replace(title, with: edited)
        let editor = app.textViews["editor-notes"]
        editor.tap()
        editor.typeText(notes)
        app.buttons["Done"].tap()
        reveal(app.buttons["Save"])
        app.buttons["Save"].tap()
        saved()
        back()
        app.buttons["todo-" + id].tap()
        XCTAssertEqual(editor.value as? String, notes)
        evidence("edited Unicode and controls")
        relaunch()
        app.buttons["todo-" + id].tap()
        XCTAssertEqual(title.value as? String, edited)
        XCTAssertEqual(editor.value as? String, notes)
        let (initial, doc) = try snapshot()
        let todos = try XCTUnwrap(doc.get(obj: .ROOT, key: "todos"))
        guard case .Object(let map, _) = todos else { return XCTFail("missing todos map") }
        XCTAssertEqual(Array(doc.keys(obj: map)), [id])
        guard case .Object(let todo, _) = try doc.get(obj: map, key: id),
              case .Object(let titleText, _) = try doc.get(obj: todo, key: "title"),
              case .Object(let notesText, _) = try doc.get(obj: todo, key: "notes") else {
            return XCTFail("missing text objects")
        }
        XCTAssertEqual(Array(try doc.text(obj: titleText).unicodeScalars), Array(edited.unicodeScalars))
        XCTAssertEqual(Array(try doc.text(obj: notesText).unicodeScalars), Array(notes.unicodeScalars))
        app.launch()
        app.buttons["todo-" + id].tap()
        let completed = app.switches["Completed"]
        completed.tap()
        saved()
        evidence("completed")
        relaunch()
        app.buttons["todo-" + id].tap()
        XCTAssertEqual(completed.value as? String, "1")
        completed.tap()
        saved()
        relaunch()
        app.buttons["todo-" + id].tap()
        XCTAssertEqual(completed.value as? String, "0")
        replace(title, with: "Cancelled draft")
        app.buttons["Done"].tap()
        reveal(app.buttons["Cancel"])
        app.buttons["Cancel"].tap()
        XCTAssertEqual(title.value as? String, edited)
        reveal(app.buttons["Delete todo"])
        app.buttons["Delete todo"].tap()
        saved()
        relaunch()
        XCTAssertFalse(app.buttons["todo-" + id].exists)
        let (deleted, deletedDoc) = try snapshot()
        XCTAssertEqual(deleted.documentID, initial.documentID)
        let record = try XCTUnwrap(deletedDoc.get(obj: map, key: id))
        guard case .Object(let recordID, _) = record else { return XCTFail("missing tombstone") }
        XCTAssertEqual(try deletedDoc.get(obj: recordID, key: "deleted"), .Scalar(.Boolean(true)))
        app.launch()
        try Data().write(to: directory.appendingPathComponent("fail-next-save"))
        addTodo("Retained addition")
        XCTAssertTrue(app.buttons["Retry saving"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Saved locally"].exists)
        XCTAssertTrue(app.staticTexts["Retained addition"].exists
                      || app.textFields["editor-title"].value as? String == "Retained addition")
        evidence("failed addition")
        app.buttons["Retry saving"].tap()
        saved()
        relaunch()
        XCTAssertEqual(app.staticTexts.matching(identifier: "Retained addition").count, 1)
        let retained = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'todo-'")).firstMatch
        let retainedID = String(retained.identifier.dropFirst(5))
        retained.tap()
        try Data().write(to: directory.appendingPathComponent("fail-next-save"))
        reveal(app.buttons["Delete todo"])
        app.buttons["Delete todo"].tap()
        XCTAssertTrue(app.buttons["Retry saving"].waitForExistence(timeout: 10))
        evidence("failed deletion")
        app.buttons["Retry saving"].tap()
        saved()
        relaunch()
        XCTAssertFalse(app.buttons["todo-" + retainedID].exists)
        let (_, finalDoc) = try snapshot()
        XCTAssertEqual(Set(finalDoc.keys(obj: map)), Set([id, retainedID]))
        guard case .Object(let retainedRecord, _) = try finalDoc.get(obj: map, key: retainedID) else {
            return XCTFail("missing retained deletion")
        }
        XCTAssertEqual(try finalDoc.get(obj: retainedRecord, key: "deleted"), .Scalar(.Boolean(true)))
    }

    func testInvalidPairingAndScannerCancellationPreserveWorkspace() throws {
        app.launchEnvironment["TODO_P2P_PAIRING_FIXTURE"] = "1"
        app.launch()
        addTodo("Still offline")
        saved()
        app.terminate()
        let file = directory.appendingPathComponent("workspace.snapshot")
        let original = try Data(contentsOf: file)
        app.launch()
        app.buttons["Pair devices"].tap()
        app.buttons["Import malformed test code"].tap()
        XCTAssertTrue(app.staticTexts["This is not a supported pairing code."].exists)
        XCTAssertFalse(app.buttons["Accept pairing"].exists)
        app.buttons["Scan pairing code"].tap()
        XCTAssertTrue(app.buttons["Cancel scanning"].waitForExistence(timeout: 5))
        app.buttons["Cancel scanning"].tap()
        app.buttons["Done"].tap()
        app.terminate()
        XCTAssertEqual(try Data(contentsOf: file), original)
    }

    private func requireKeychainOrPreserved(file: URL, original: Data) throws {
        if app.staticTexts["This app’s signing configuration does not permit secure Keychain storage."].exists {
            XCTAssertFalse(app.buttons["Accept pairing"].exists)
            app.terminate()
            XCTAssertEqual(try Data(contentsOf: file), original)
            throw XCTSkip("Secure Keychain unavailable with this signing configuration; acceptance, restart and forget gates remain open.")
        }
    }

    func testFreshPairingPreservesInitialWorkspace() throws {
        app.launchEnvironment["TODO_P2P_PAIRING_FIXTURE"] = "1"
        app.launch()
        saved()
        app.terminate()
        let file = directory.appendingPathComponent("workspace.snapshot")
        let original = try Data(contentsOf: file)
        app.launch()
        app.buttons["Pair devices"].tap()
        app.buttons["Import test code"].tap()
        try requireKeychainOrPreserved(file: file, original: original)
        XCTAssertTrue(app.buttons["Accept pairing"].waitForExistence(timeout: 5), app.staticTexts.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
        app.buttons["Accept pairing"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].exists)
        app.terminate()
        XCTAssertEqual(try Data(contentsOf: file), original)
        app.launch()
        app.buttons["Pair devices"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].exists)
        app.buttons["Forget pairing"].tap()
        app.buttons["Forget on this device"].tap()
    }

    func testPairingPendingPreservesWorkspace() throws {
        app.launchEnvironment["TODO_P2P_PAIRING_FIXTURE"] = "1"
        app.launch()
        addTodo("Keep local todo")
        saved()
        app.terminate()
        let file = directory.appendingPathComponent("workspace.snapshot")
        let original = try Data(contentsOf: file)
        app.launch()
        app.buttons["Pair devices"].tap()
        app.buttons["Import malformed test code"].tap()
        XCTAssertTrue(app.staticTexts["This is not a supported pairing code."].exists)
        app.buttons["Import test code"].tap()
        try requireKeychainOrPreserved(file: file, original: original)
        XCTAssertTrue(app.buttons["Accept pairing"].exists)
        app.buttons["Cancel import"].tap()
        XCTAssertFalse(app.buttons["Accept pairing"].exists)
        app.buttons["Import test code"].tap()
        try requireKeychainOrPreserved(file: file, original: original)
        XCTAssertTrue(app.buttons["Accept pairing"].waitForExistence(timeout: 5), app.staticTexts.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
        app.buttons["Accept pairing"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].waitForExistence(timeout: 5))
        app.buttons["Import test code"].tap()
        try requireKeychainOrPreserved(file: file, original: original)
        XCTAssertTrue(app.buttons["Accept pairing"].waitForExistence(timeout: 5), app.staticTexts.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
        app.buttons["Accept pairing"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].exists)
        app.terminate()
        XCTAssertEqual(try Data(contentsOf: file), original)
        app.launch()
        app.buttons["Pair devices"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].exists)
        app.buttons["Import test code"].tap()
        XCTAssertTrue(app.staticTexts["Forget the existing pairing before accepting a different code."].exists)
        app.buttons["Forget pairing"].tap()
        app.buttons["Forget on this device"].tap()
        XCTAssertTrue(app.staticTexts["Accepted pairing awaiting initial sync"].waitForNonExistence(timeout: 5))
        app.terminate()
        XCTAssertEqual(try Data(contentsOf: file), original)
        app.launch()
        app.buttons["Pair devices"].tap()
        XCTAssertFalse(app.buttons["Forget pairing"].exists)
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["Keep local todo"].exists)
    }

    func testApplicationKeychainIntegration() throws {
        app.launchEnvironment["TODO_P2P_PAIRING_FIXTURE"] = "1"
        app.launch()
        saved()
        app.buttons["Check secure storage"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Secure storage integration passed"].waitForExistence(timeout: 5))
    }

    func testTransferPickerCancellationPreservesWorkspace() throws {
        app.launch()
        saved()
        let file = directory.appendingPathComponent("workspace.snapshot")
        let original = try Data(contentsOf: file)
        app.buttons["Export workspace"].firstMatch.tap()
        let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "Close"])).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 10), app.debugDescription)
        cancel.tap()
        XCTAssertTrue(cancel.waitForNonExistence(timeout: 5))
        app.buttons["Restore workspace"].firstMatch.tap()
        XCTAssertTrue(cancel.waitForExistence(timeout: 10), app.debugDescription)
        cancel.tap()
        relaunch()
        XCTAssertEqual(try Data(contentsOf: file), original)
    }

    func testCorruptOpeningPreservesBytes() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        let file = directory.appendingPathComponent("workspace.snapshot")
        let original = Data("synthetic corrupt bytes".utf8)
        try original.write(to: file)
        app.launch()
        XCTAssertTrue(app.buttons["Retry opening"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Existing data has been preserved."].exists)
        app.buttons["Retry opening"].tap()
        XCTAssertTrue(app.buttons["Retry opening"].waitForExistence(timeout: 5))
        evidence("corrupt opening retry")
        app.terminate()
        XCTAssertEqual(try Data(contentsOf: file), original)
    }
}
