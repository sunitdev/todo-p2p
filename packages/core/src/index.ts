export { TodoStore, PALETTE_COLORS } from "./todoStore.ts";
export type {
  Todo,
  TodoDoc,
  Area,
  Project,
  Heading,
  Recurrence,
  IconRef,
  PaletteColor,
  AreaInput,
  ProjectInput,
  HeadingInput,
} from "./todoStore.ts";

export { SyncEngine } from "./syncEngine.ts";
export type { SyncEvent } from "./syncEngine.ts";

export { Backoff } from "./backoff.ts";
export type { BackoffOptions } from "./backoff.ts";

export {
  generateIdentity,
  sign,
  verify,
  peerIdFromPublicKey,
} from "./identity.ts";
export type { DeviceIdentity } from "./identity.ts";

export {
  encodePairingPayload,
  decodePairingPayload,
  fingerprint,
  reduce as pairingReduce,
  TICKET_TTL_SECONDS,
} from "./pairing.ts";
export type { PairingPayload, PairingState, PairingEvent } from "./pairing.ts";

export { migrate, CURRENT_SCHEMA_VERSION } from "./migrations/index.ts";

export { encryptBackup, decryptBackup, BackupError } from "./backup.ts";

export type {
  StorageAdapter,
  TransportAdapter,
  SecureKeyStore,
  TrustedPeer,
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  Unsubscribe,
} from "./adapters/index.ts";
