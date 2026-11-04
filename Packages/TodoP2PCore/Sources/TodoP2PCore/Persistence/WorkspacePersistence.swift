import Darwin
import Foundation

public enum WorkspaceStorageError: Error {
    case malformedEnvelope(any Error)
    case unsupportedVersion(Int)
    case missingWorkspace
    case policyMismatch(URL)
}

public enum WorkspaceSaveState: Sendable {
    case unsaved(revision: UInt64)
    case saving(revision: UInt64)
    case saved(revision: UInt64)
    case failed(revision: UInt64, error: any Error)
}

struct WorkspaceEnvelope: Codable {
    let storageVersion: Int
    let documentID: String
    let documentData: Data
}

package protocol WorkspaceFileIO: Sendable {
    func read(_ url: URL) throws -> Data
    func prepareDirectory(_ url: URL) throws
    func writeCandidate(_ data: Data, to url: URL) throws
    func promote(_ candidate: URL, to destination: URL, exclusive: Bool) throws
    func verifyPolicy(_ url: URL, directory: Bool) throws
    func removeCandidate(_ url: URL)
}

package struct LocalWorkspaceFileIO: WorkspaceFileIO {
    package init() {}
    package func read(_ url: URL) throws -> Data { try Data(contentsOf: url) }

    package func prepareDirectory(_ url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true,
                                               attributes: [.posixPermissions: 0o700])
        try applyPolicy(url, directory: true)
    }

    private func applyPolicy(_ url: URL, directory: Bool) throws {
        var attributes: [FileAttributeKey: Any] = [.posixPermissions: directory ? 0o700 : 0o600]
        #if os(iOS)
        attributes[.protectionKey] = FileProtectionType.complete
        #endif
        try FileManager.default.setAttributes(attributes, ofItemAtPath: url.path)
        var target = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try target.setResourceValues(values)
        try verifyPolicy(url, directory: directory)
    }

    package func verifyPolicy(_ url: URL, directory: Bool) throws {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        guard (attributes[.posixPermissions] as? NSNumber)?.intValue == (directory ? 0o700 : 0o600),
              try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true else {
            throw WorkspaceStorageError.policyMismatch(url)
        }
        // simulator files have no protection attribute to inspect
        #if os(iOS) && !targetEnvironment(simulator)
        guard attributes[.protectionKey] as? FileProtectionType == .complete else {
            throw WorkspaceStorageError.policyMismatch(url)
        }
        #endif
    }

    package func writeCandidate(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.withoutOverwriting, .completeFileProtection])
        #else
        try data.write(to: url, options: .withoutOverwriting)
        #endif
        try applyPolicy(url, directory: false)
        let handle = try FileHandle(forWritingTo: url)
        do {
            try handle.synchronize()
            try handle.close()
        } catch {
            try? handle.close()
            throw error
        }
    }

    package func promote(_ candidate: URL, to destination: URL, exclusive: Bool) throws {
        let result = candidate.withUnsafeFileSystemRepresentation { source in
            destination.withUnsafeFileSystemRepresentation { target in
                renamex_np(source!, target!, exclusive ? UInt32(RENAME_EXCL) : 0)
            }
        }
        guard result == 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
    }

    package func removeCandidate(_ url: URL) { try? FileManager.default.removeItem(at: url) }
}

struct WorkspacePersistence: Sendable {
    let directory: URL
    let io: any WorkspaceFileIO
    var file: URL { directory.appendingPathComponent("workspace.snapshot") }

    static func defaultDirectory() throws -> URL {
        try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                    appropriateFor: nil, create: false)
            .appendingPathComponent("TodoP2P", isDirectory: true)
    }

    func load() throws -> WorkspaceEnvelope {
        let data: Data
        do { data = try io.read(file) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            throw WorkspaceStorageError.missingWorkspace
        }
        let envelope: WorkspaceEnvelope
        do { envelope = try JSONDecoder().decode(WorkspaceEnvelope.self, from: data) }
        catch { throw WorkspaceStorageError.malformedEnvelope(error) }
        guard envelope.storageVersion == 1 else {
            throw WorkspaceStorageError.unsupportedVersion(envelope.storageVersion)
        }
        return envelope
    }

    func save(_ snapshot: WorkspaceSnapshot, exclusive: Bool = false) throws {
        let data = try JSONEncoder().encode(WorkspaceEnvelope(storageVersion: 1,
            documentID: snapshot.documentID, documentData: snapshot.documentData))
        try io.prepareDirectory(directory)
        let candidate = directory.appendingPathComponent(".candidate-\(UUID().uuidString)")
        defer { io.removeCandidate(candidate) }
        try io.writeCandidate(data, to: candidate)
        try io.promote(candidate, to: file, exclusive: exclusive)
        try io.verifyPolicy(file, directory: false)
    }
}
