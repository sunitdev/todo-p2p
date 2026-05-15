import { ed25519 } from "@noble/curves/ed25519";
import { blake3 } from "@noble/hashes/blake3";

export interface DeviceIdentity {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** Generate a fresh Ed25519 device identity. Caller must seal privateKey via SecureKeyStore. */
export function generateIdentity(): DeviceIdentity {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export function sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function verify(publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array): boolean {
  return ed25519.verify(signature, message, publicKey);
}

/** Stable, public-key-derived peer identifier (BLAKE3 → 32 bytes → hex). */
export function peerIdFromPublicKey(publicKey: Uint8Array): string {
  return bytesToHex(blake3(publicKey));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
