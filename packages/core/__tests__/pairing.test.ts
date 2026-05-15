import { describe, expect, test } from "bun:test";
import {
  decodePairingPayload,
  encodePairingPayload,
  fingerprint,
  pairingReduce,
  type PairingPayload,
  type PairingState,
} from "../src/index.ts";

const sample: PairingPayload = {
  v: 1,
  nodeId: "abc123",
  ticket: "TICKET",
  pskHash: "deadbeef",
  fingerprint: "x x x x x x",
};

describe("pairing payload", () => {
  test("encode + decode roundtrip", () => {
    const out = decodePairingPayload(encodePairingPayload(sample));
    expect(out).toEqual(sample);
  });

  test("decode rejects garbage", () => {
    expect(() => decodePairingPayload("{}")).toThrow();
    expect(() => decodePairingPayload(JSON.stringify({ v: 2, nodeId: "x" }))).toThrow();
  });

  test("decode rejects non-JSON", () => {
    expect(() => decodePairingPayload("not json")).toThrow();
  });
});

describe("fingerprint", () => {
  test("deterministic for same inputs", () => {
    expect(fingerprint("node-1", "psk-hash-1")).toBe(fingerprint("node-1", "psk-hash-1"));
  });

  test("differs for different inputs", () => {
    expect(fingerprint("node-1", "psk-hash-1")).not.toBe(fingerprint("node-2", "psk-hash-1"));
    expect(fingerprint("node-1", "psk-hash-1")).not.toBe(fingerprint("node-1", "psk-hash-2"));
  });

  test("produces exactly 6 BIP-39 words", () => {
    const fp = fingerprint("node-x", "psk-y");
    const words = fp.split(" ");
    expect(words.length).toBe(6);
    for (const w of words) expect(w.length).toBeGreaterThan(0);
  });
});

describe("pairing state machine", () => {
  test("happy path: idle → ticket-minted → handshake → confirm → sync → paired", () => {
    let s: PairingState = { kind: "idle" };
    s = pairingReduce(s, { kind: "ticket-minted", payload: sample, expiresAt: 0 });
    expect(s.kind).toBe("showing-ticket");
    s = pairingReduce(s, { kind: "peer-handshake-complete", remotePeerId: "peer-1" });
    expect(s.kind).toBe("awaiting-fingerprint-confirm");
    s = pairingReduce(s, { kind: "fingerprint-confirmed" });
    expect(s.kind).toBe("syncing");
    s = pairingReduce(s, { kind: "sync-complete" });
    expect(s.kind).toBe("paired");
  });

  test("scanner path: idle → scanned → handshake → confirm → sync → paired", () => {
    let s: PairingState = { kind: "idle" };
    s = pairingReduce(s, { kind: "ticket-scanned", payload: sample });
    expect(s.kind).toBe("dialing");
    s = pairingReduce(s, { kind: "peer-handshake-complete", remotePeerId: "peer-2" });
    expect(s.kind).toBe("awaiting-fingerprint-confirm");
    s = pairingReduce(s, { kind: "fingerprint-confirmed" });
    s = pairingReduce(s, { kind: "sync-complete" });
    expect(s.kind).toBe("paired");
  });

  test("fingerprint-rejected → failed (MITM)", () => {
    let s: PairingState = {
      kind: "awaiting-fingerprint-confirm",
      payload: sample,
      remotePeerId: "p",
    };
    s = pairingReduce(s, { kind: "fingerprint-rejected" });
    expect(s.kind).toBe("failed");
    if (s.kind === "failed") expect(s.reason).toMatch(/MITM/);
  });

  test("ticket-expired → failed", () => {
    let s: PairingState = { kind: "showing-ticket", payload: sample, expiresAt: 0 };
    s = pairingReduce(s, { kind: "ticket-expired" });
    expect(s.kind).toBe("failed");
  });

  test("confirm without pending handshake → failed", () => {
    const s = pairingReduce({ kind: "idle" }, { kind: "fingerprint-confirmed" });
    expect(s.kind).toBe("failed");
  });
});
