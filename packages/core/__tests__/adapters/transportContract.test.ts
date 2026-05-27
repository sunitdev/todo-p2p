import { describe, expect, test } from "bun:test";
import type { TransportAdapter } from "../../src/adapters/index.ts";
import { MemTransport } from "../helpers/MemTransport.ts";

/**
 * Reusable TransportAdapter contract. Run against the in-memory double here;
 * the real `IrohTauriTransport` / `IrohWebTransport` are validated by Rust
 * integration tests + manual two-device verification (they need native/WASM +
 * a relay, which can't run in bun+happy-dom).
 */
export function transportContract(make: () => TransportAdapter): void {
  test("start() resolves with a node id string", async () => {
    const t = make();
    expect(typeof (await t.start())).toBe("string");
  });

  test("mintPairingTicket honors the TTL in expiresAt", async () => {
    const t = make();
    const before = Date.now();
    const ticket = await t.mintPairingTicket(60);
    expect(ticket.expiresAt).toBeGreaterThanOrEqual(before);
    expect(ticket.pskHash).toBeInstanceOf(Uint8Array);
  });

  test("connectionTo returns a sendable handle for the peer id", () => {
    const t = make();
    const conn = t.connectionTo("peer-x");
    expect(conn.peerId).toBe("peer-x");
    expect(typeof conn.send).toBe("function");
    expect(typeof conn.close).toBe("function");
  });

  test("onMessage / onPeerStatus subscribe and unsubscribe", () => {
    const t = make();
    const offMsg = t.onMessage(() => {});
    const offStatus = t.onPeerStatus(() => {});
    expect(typeof offMsg).toBe("function");
    expect(typeof offStatus).toBe("function");
    offMsg();
    offStatus();
  });
}

describe("TransportAdapter contract — MemTransport", () => {
  transportContract(() => new MemTransport());
});
