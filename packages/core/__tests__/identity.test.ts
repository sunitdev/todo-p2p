import { describe, expect, test } from "bun:test";
import { generateIdentity, peerIdFromPublicKey, sign, verify } from "../src/identity.ts";

describe("identity", () => {
  test("generates a 32-byte private key + 32-byte public key", () => {
    const id = generateIdentity();
    expect(id.privateKey.length).toBe(32);
    expect(id.publicKey.length).toBe(32);
  });

  test("sign + verify roundtrip", () => {
    const id = generateIdentity();
    const msg = new TextEncoder().encode("hello");
    const sig = sign(id.privateKey, msg);
    expect(verify(id.publicKey, sig, msg)).toBe(true);
  });

  test("verify rejects tampered message", () => {
    const id = generateIdentity();
    const sig = sign(id.privateKey, new TextEncoder().encode("hello"));
    expect(verify(id.publicKey, sig, new TextEncoder().encode("hellp"))).toBe(false);
  });

  test("peerId is deterministic from public key", () => {
    const id = generateIdentity();
    expect(peerIdFromPublicKey(id.publicKey)).toBe(peerIdFromPublicKey(id.publicKey));
    expect(peerIdFromPublicKey(id.publicKey).length).toBe(64); // 32 bytes hex
  });
});
