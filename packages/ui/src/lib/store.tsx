import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Area,
  AreaInput,
  Project,
  ProjectInput,
  SyncEngine,
  Todo,
} from '@todo-p2p/core';
import { newId } from './id';

export type TodoPatch = Partial<
  Pick<
    Todo,
    | 'title'
    | 'tags'
    | 'projectId'
    | 'areaId'
    | 'notes'
    | 'dueDate'
    | 'scheduledFor'
    | 'scheduledWhen'
    | 'flagged'
  >
>;

export type TodoInput = Omit<Todo, 'id' | 'done' | 'createdAt'> & { id?: string };

export interface StoreValue {
  todos: Todo[];
  areas: Area[];
  projects: Project[];

  addTodo(input: TodoInput): Promise<void>;
  updateTodo(id: string, patch: TodoPatch): Promise<void>;

  addArea(input: AreaInput): Promise<void>;
  updateArea(id: string, patch: Partial<Omit<Area, 'id' | 'createdAt'>>): Promise<void>;
  removeArea(id: string): Promise<void>;

  addProject(input: ProjectInput): Promise<void>;
  updateProject(
    id: string,
    patch: Partial<Omit<Project, 'id' | 'createdAt'>>,
  ): Promise<void>;
  removeProject(id: string): Promise<void>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({
  engine,
  children,
}: {
  engine: SyncEngine;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const off = engine.on((e) => {
      if (e.kind === 'local-change' || e.kind === 'remote-change') {
        setVersion((v) => v + 1);
      }
    });
    return () => {
      off();
    };
  }, [engine]);

  const commit = useCallback(
    async (change: Uint8Array) => {
      await engine.commit(change, []);
    },
    [engine],
  );

  const store = engine.todos();

  const value = useMemo<StoreValue>(() => {
    // Snapshot derived from current store state. `version` triggers rebuild.
    void version;
    return {
      todos: store.list(),
      areas: store.listAreas(),
      projects: store.listProjects(),

      addTodo: ({ id, ...rest }) => commit(store.add({ id: id ?? newId(), ...rest })),
      updateTodo: (id, patch) => commit(store.updateTodo(id, patch)),

      addArea: (input) => commit(store.addArea(input)),
      updateArea: (id, patch) => commit(store.updateArea(id, patch)),
      removeArea: (id) => commit(store.removeArea(id)),

      addProject: (input) => commit(store.addProject(input)),
      updateProject: (id, patch) => commit(store.updateProject(id, patch)),
      removeProject: (id) => commit(store.removeProject(id)),
    };
  }, [store, commit, version]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
