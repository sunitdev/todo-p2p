import { blake3 } from "@noble/hashes/blake3";
import { wordlist } from "@scure/bip39/wordlists/english";

/**
 * QR payload exchanged at pairing time.
 * The `pskHash` provides channel binding so a relay-side MITM cannot
 * substitute keys without producing a different fingerprint.
 */
export interface PairingPayload {
  v: 1;
  nodeId: string;
  ticket: string;
  pskHash: string; // hex-encoded BLAKE3(psk)
  fingerprint: string; // 6-word BIP-39 phrase derived deterministically from nodeId+pskHash
}

/** Serialize payload for QR encoding. JSON kept for forward-compat fields. */
export function encodePairingPayload(p: PairingPayload): string {
  return JSON.stringify(p);
}

export function decodePairingPayload(raw: string): PairingPayload {
  const parsed: unknown = JSON.parse(raw);
  if (!isPairingPayload(parsed)) throw new Error("invalid pairing payload");
  return parsed;
}

function isPairingPayload(v: unknown): v is PairingPayload {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.nodeId === "string" &&
    typeof o.ticket === "string" &&
    typeof o.pskHash === "string" &&
    typeof o.fingerprint === "string"
  );
}

/**
 * Compute the 6-word fingerprint shown on both screens for out-of-band confirmation.
 * Domain-separated: never collides with any other BLAKE3 use elsewhere in the app.
 */
export function fingerprint(nodeId: string, pskHash: string): string {
  const input = new TextEncoder().encode(`todo-p2p/pairing/v1\0${nodeId}\0${pskHash}`);
  const digest = blake3(input);
  // 6 words × 11 bits = 66 bits of entropy from the first 9 bytes.
  const words: string[] = [];
  let bitBuf = 0n;
  let bits = 0;
  for (let i = 0; i < 9; i++) {
    const byte = digest[i];
    if (byte === undefined) throw new Error("unreachable");
    bitBuf = (bitBuf << 8n) | BigInt(byte);
    bits += 8;
    while (bits >= 11 && words.length < 6) {
      bits -= 11;
      const idx = Number((bitBuf >> BigInt(bits)) & 0x7ffn);
      const word = wordlist[idx];
      if (word === undefined) throw new Error("unreachable");
      words.push(word);
    }
  }
  return words.join(" ");
}

/**
 * State machine for the pairing handshake. UI drives transitions; security
 * properties live in the transitions, not the UI.
 */
export type PairingState =
  | { kind: "idle" }
  | { kind: "showing-ticket"; payload: PairingPayload; expiresAt: number }
  | { kind: "dialing"; payload: PairingPayload }
  | { kind: "awaiting-fingerprint-confirm"; payload: PairingPayload; remotePeerId: string }
  | { kind: "syncing"; remotePeerId: string }
  | { kind: "paired"; remotePeerId: string }
  | { kind: "failed"; reason: string };

export type PairingEvent =
  | { kind: "ticket-minted"; payload: PairingPayload; expiresAt: number }
  | { kind: "ticket-scanned"; payload: PairingPayload }
  | { kind: "peer-handshake-complete"; remotePeerId: string }
  | { kind: "fingerprint-confirmed" }
  | { kind: "fingerprint-rejected" }
  | { kind: "sync-complete" }
  | { kind: "ticket-expired" }
  | { kind: "error"; reason: string };

export function reduce(state: PairingState, event: PairingEvent): PairingState {
  switch (event.kind) {
    case "ticket-minted":
      return { kind: "showing-ticket", payload: event.payload, expiresAt: event.expiresAt };
    case "ticket-scanned":
      return { kind: "dialing", payload: event.payload };
    case "peer-handshake-complete":
      if (state.kind !== "dialing" && state.kind !== "showing-ticket") {
        return { kind: "failed", reason: `unexpected handshake in state ${state.kind}` };
      }
      return {
        kind: "awaiting-fingerprint-confirm",
        payload: state.kind === "dialing" ? state.payload : state.payload,
        remotePeerId: event.remotePeerId,
      };
    case "fingerprint-confirmed":
      if (state.kind !== "awaiting-fingerprint-confirm") {
        return { kind: "failed", reason: "confirm without pending handshake" };
      }
      return { kind: "syncing", remotePeerId: state.remotePeerId };
    case "fingerprint-rejected":
      return { kind: "failed", reason: "fingerprint mismatch — possible MITM" };
    case "sync-complete":
      if (state.kind !== "syncing") return { kind: "failed", reason: "sync-complete in wrong state" };
      return { kind: "paired", remotePeerId: state.remotePeerId };
    case "ticket-expired":
      return { kind: "failed", reason: "ticket expired" };
    case "error":
      return { kind: "failed", reason: event.reason };
  }
}

export const TICKET_TTL_SECONDS = 60;
