/// <reference lib="webworker" />
//
// Web Worker host for the browser iroh transport (E1.2). Loads the
// `@todo-p2p/iroh-wasm` module, runs one `IrohNode`, and bridges it to the main
// thread over a small postMessage RPC. Keeping iroh's network loop off the main
// thread avoids jank; the worker is the only place the WASM is imported.

import init, { IrohNode } from '@todo-p2p/iroh-wasm';

type RpcRequest = { type: 'rpc'; id: number; method: string; args: unknown[] };

type FromWorker =
  | { type: 'rpc-result'; id: number; ok: true; value: unknown }
  | { type: 'rpc-result'; id: number; ok: false; error: string }
  | { type: 'event'; event: unknown };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let node: IrohNode | null = null;
let starting: Promise<string> | null = null;

/** Initialize the WASM module + node once; return this device's node id. */
function ensureStarted(): Promise<string> {
  if (!starting) {
    starting = (async () => {
      await init();
      node = await IrohNode.start();
      pumpEvents(node);
      return node.nodeId;
    })();
  }
  return starting;
}

/** Drain the node's event stream and forward each event to the main thread. */
function pumpEvents(n: IrohNode): void {
  void (async () => {
    for (;;) {
      let event: unknown;
      try {
        event = await n.nextEvent();
      } catch {
        break;
      }
      if (event == null) break;
      post({ type: 'event', event });
    }
  })();
}

async function handle(method: string, args: unknown[]): Promise<unknown> {
  if (method === 'start') return ensureStarted();
  if (!node) throw new Error('iroh node not started');
  switch (method) {
    case 'mintPairingTicket':
      return node.mintPairingTicket(args[0] as number);
    case 'dialWithTicket':
      return node.dialWithTicket(args[0] as string);
    case 'dialTrusted':
      return node.dialTrusted(args[0] as string);
    case 'send':
      await node.send(args[0] as string, args[1] as Uint8Array);
      return undefined;
    case 'closePeer':
      node.closePeer(args[0] as string);
      return undefined;
    case 'stop':
      node.stop();
      return undefined;
    default:
      throw new Error(`unknown method ${method}`);
  }
}

function post(msg: FromWorker): void {
  ctx.postMessage(msg);
}

ctx.onmessage = (e: MessageEvent<RpcRequest>) => {
  const { id, method, args } = e.data;
  handle(method, args).then(
    (value) => post({ type: 'rpc-result', id, ok: true, value }),
    (err: unknown) =>
      post({
        type: 'rpc-result',
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
  );
};
