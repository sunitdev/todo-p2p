import CoreImage.CIFilterBuiltins
import SwiftUI
import TodoP2PCore

public enum PairingQR {
    public static func image(_ payload: PairingPayload) throws -> CGImage {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(try payload.encoded().utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
              let image = CIContext().createCGImage(output.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
                                                   from: output.extent.applying(CGAffineTransform(scaleX: 8, y: 8))) else {
            throw PairingError.unavailable
        }
        return image
    }
}

struct PairingView: View {
    @Bindable var model: PairingModel
    let documentID: String
    @Environment(\.dismiss) private var dismiss
    @State private var scanning = false
    @State private var forgetting = false
    @State private var qr: CGImage?
    @State private var qrError = false
    #if DEBUG
    @State private var fixture: PairingPayload?
    #endif

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Pairing").font(.title)
                if let record = model.record {
                    Text(record.role == .owner ? "Pairing code ready" : "Accepted pairing awaiting initial sync")
                    Text("Target workspace: \(record.payload.documentID)")
                    #if os(macOS)
                    if record.role == .owner, let image = qr {
                        Image(decorative: image, scale: 1).interpolation(.none)
                            .resizable().scaledToFit().frame(width: 300, height: 300)
                            .padding(16).background(.white).accessibilityLabel("Private pairing QR code")
                    }
                    if qrError {
                        Text("Could not generate the pairing QR code.")
                        Button("Retry QR code") { open() }
                    }
                    #endif
                }
                if model.record != nil || model.error != nil {
                    Button("Forget pairing", role: .destructive) { forgetting = true }.accessibilityLabel("Forget pairing")
                }
                if let error = model.error {
                    Text(error).foregroundStyle(.red)
                    Button("Retry pairing") { open() }.accessibilityLabel("Retry pairing")
                }
                #if os(iOS)
                if let candidate = model.candidate {
                    Text("Accept pairing with workspace \(candidate.documentID)?")
                    Text("Your local todos and workspace stay on this phone and remain editable offline. Pairing shares credentials only. Receiving and switching to the Mac workspace requires a future authenticated initial sync.")
                    Button("Accept pairing") { model.accept() }
                    Button("Cancel import") { model.cancel() }
                } else {
                    Button("Scan pairing code") { scanning = true }
                    #if DEBUG
                    if ProcessInfo.processInfo.environment["TODO_P2P_PAIRING_FIXTURE"] != nil {
                        Button("Import malformed test code") { model.scan("invalid") }
                        Button("Import test code") {
                            let text = (try? fixture?.encoded()) ?? "invalid"
                            model.scan(text)
                        }
                    }
                    #endif
                }
                #endif
                Text("Forgetting removes pairing only on this device. It does not revoke another holder of the shared secret. Revocation requires secret rotation and re-pairing.").font(.caption)
                Button("Done") { model.cancel(); dismiss() }.accessibilityLabel("Done")
            }.padding()
        }
        .frame(minWidth: 300, minHeight: 400)
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.environment["TODO_P2P_PAIRING_FIXTURE"] != nil, fixture == nil {
                fixture = try? PairingPayload(documentID: WorkspaceStore.createNew().documentID.id, secret: PairingCredentials.randomSecret())
            }
            #endif
            open()
        }
        .confirmationDialog("Forget pairing on this device? Local todos and history will be preserved.", isPresented: $forgetting) {
            Button("Forget on this device", role: .destructive) { model.forget() }
        }
        #if os(iOS)
        .sheet(isPresented: $scanning) {
            PairingScanner { text in scanning = false; model.scan(text) }
        }
        #endif
    }
    private func open() {
        #if os(macOS)
        model.showOwner(documentID: documentID)
        qr = nil
        qrError = false
        if let record = model.record {
            do { qr = try PairingQR.image(record.payload) }
            catch { qrError = true }
        }
        #else
        model.reload()
        #endif
    }
}
