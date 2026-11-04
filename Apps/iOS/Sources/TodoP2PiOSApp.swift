import SwiftUI
import TodoP2PApp

@main
struct TodoP2PiOSApp: App {
    @State private var model = WorkspaceModel()

    var body: some Scene {
        WindowGroup {
            WorkspaceView(model: model)
        }
    }
}
