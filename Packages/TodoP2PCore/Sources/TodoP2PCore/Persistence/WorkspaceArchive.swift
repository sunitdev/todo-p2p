import Foundation

public enum WorkspaceTransferError: Error, LocalizedError {
    case retiredStore, pairedIdentity, protectedDestination
    public var errorDescription: String? {
        switch self {
        case .retiredStore: "This workspace can no longer be changed."
        case .pairedIdentity: "Forget pairing before restoring a different workspace."
        case .protectedDestination: "Choose a destination outside application storage."
        }
    }
}

public struct WorkspaceReplacement: Sendable {
    public let store: WorkspaceStore
    public let recoveryDirectory: URL
}

public enum WorkspaceArchive {
    public static func encode(_ snapshot: WorkspaceSnapshot) throws -> Data {
        try JSONEncoder().encode(WorkspaceEnvelope(storageVersion: 1,
            documentID: snapshot.documentID, documentData: snapshot.documentData))
    }

    public static func decode(_ data: Data) throws -> WorkspaceSnapshot {
        let envelope: WorkspaceEnvelope
        do { envelope = try JSONDecoder().decode(WorkspaceEnvelope.self, from: data) }
        catch { throw WorkspaceStorageError.malformedEnvelope(error) }
        guard envelope.storageVersion == 1 else {
            throw WorkspaceStorageError.unsupportedVersion(envelope.storageVersion)
        }
        _ = try WorkspaceStore.open(documentID: envelope.documentID, documentData: envelope.documentData)
        return WorkspaceSnapshot(documentID: envelope.documentID, documentData: envelope.documentData)
    }
}
