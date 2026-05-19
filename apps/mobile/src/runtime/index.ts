// In-memory stub. Real adapter (iroh-ffi Expo Module + op-sqlite + SQLCipher)
// lands in a future wave per CLAUDE.md mobile stack.
import type { Todo, Project, Area } from '@todo-p2p/core';

export const stubTodos: Todo[] = [];
export const stubProjects: Project[] = [];
export const stubAreas: Area[] = [];

// TODO: replace with real iroh-ffi + op-sqlite adapter implementing
// StorageAdapter, TransportAdapter, SecureKeyStore from @todo-p2p/core.
