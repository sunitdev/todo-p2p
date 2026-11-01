import Automerge
import Testing

@Test func documentSerializationRoundTrip() throws {
    let original = Document()
    try original.put(obj: ObjId.ROOT, key: "probe", value: .String("round-trip-value"))

    let bytes = original.save()
    #expect(!bytes.isEmpty)

    let reloaded = try Document(bytes)
    #expect(reloaded !== original)
    let value = try reloaded.get(obj: ObjId.ROOT, key: "probe")
    #expect(value == .Scalar(.String("round-trip-value")))
}
