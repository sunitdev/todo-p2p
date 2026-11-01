import AutomergeRepo
import Foundation

@AutomergeRepo
final class ProbeStorage: StorageProvider {
    nonisolated let id: STORAGE_ID = UUID().uuidString

    private struct RangeKey: Hashable {
        let id: DocumentId
        let prefix: String
    }

    private var documents: [DocumentId: Data] = [:]
    private var ranges: [RangeKey: [Data]] = [:]

    nonisolated init() {}

    func load(id: DocumentId) async throws -> Data? {
        documents[id]
    }

    func save(id: DocumentId, data: Data) async throws {
        documents[id] = data
    }

    func remove(id: DocumentId) async throws {
        documents.removeValue(forKey: id)
    }

    func addToRange(id: DocumentId, prefix: String, data: Data) async throws {
        ranges[RangeKey(id: id, prefix: prefix), default: []].append(data)
    }

    func loadRange(id: DocumentId, prefix: String) async throws -> [Data] {
        ranges[RangeKey(id: id, prefix: prefix)] ?? []
    }

    func removeRange(id: DocumentId, prefix: String, data: [Data]) async throws {
        let key = RangeKey(id: id, prefix: prefix)
        for chunk in data {
            if let index = ranges[key]?.firstIndex(of: chunk) {
                ranges[key]?.remove(at: index)
            }
        }
    }
}
