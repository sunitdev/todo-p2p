import AutomergeRepo
import Foundation
import Testing

@Test func repositoryConstruction() async {
    let repo = Repo(sharePolicy: .readonly)
    #expect(!repo.peerId.isEmpty)
    #expect(await repo.documentIds().isEmpty)
    #expect(await repo.peers().isEmpty)
}

@Test func repositoryStorageConstruction() async {
    let storage = ProbeStorage()
    let repo = Repo(sharePolicy: .readonly, storage: storage)
    #expect(await repo.localPeerMetadata.storageId == storage.id)
    #expect(await repo.documentIds().isEmpty)
}

@Test @AutomergeRepo func bonjourProviderConstructionAndAttachment() async {
    let configuration = PeerToPeerProviderConfiguration(
        passcode: UUID().uuidString,
        reconnectOnError: false,
        autoconnect: false
    )
    let provider = PeerToPeerProvider(configuration)
    let repo = Repo(sharePolicy: .readonly)
    repo.addNetworkAdapter(adapter: provider)
    // replacing the delegate breaks the library's adapter and subsystem cycle
    defer { provider.setDelegate(DiscardEvents(), as: repo.peerId, with: nil) }
    #expect(provider.peeredConnections.isEmpty)
    #expect(repo.peers().isEmpty)
}

private struct DiscardEvents: NetworkEventReceiver {
    func receiveEvent(event: NetworkAdapterEvents) async {}
}
