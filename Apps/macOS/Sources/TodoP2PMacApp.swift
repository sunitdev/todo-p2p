import SwiftUI
import TodoP2PApp

@main
struct TodoP2PMacApp: App {
    @State private var model = WorkspaceModel()

    var body: some Scene {
        WindowGroup {
            WorkspaceView(model: model)
                .frame(minWidth: 680, minHeight: 440)
        }.defaultSize(width: 900, height: 600)
    }
}
