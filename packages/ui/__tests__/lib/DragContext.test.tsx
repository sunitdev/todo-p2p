import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import {
  DragProvider,
  useDragContext,
  type DragContextValue,
  type DropTarget,
} from '../../src/lib/DragContext';

afterEach(cleanup);

/**
 * Helper component: captures the live `DragContextValue` into a ref so the
 * test can drive `registerTarget`/`resolveAt` directly. Mirrors the pattern in
 * `store.test.tsx`.
 */
function Capture({ onReady }: { onReady(ctx: DragContextValue): void }) {
  const ctx = useDragContext();
  useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
}

function fakeRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    right: x + w,
    bottom: y + h,
    width: w,
    height: h,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

function setupCtx(): DragContextValue {
  let captured!: DragContextValue;
  render(
    <DragProvider>
      <Capture onReady={(c) => (captured = c)} />
    </DragProvider>,
  );
  return captured;
}

describe('DragContext.useDragContext', () => {
  test('throws when used outside DragProvider', () => {
    // React logs an error to console when a child throws; that's expected and
    // not a test failure.
    expect(() => {
      render(<Capture onReady={() => {}} />);
    }).toThrow(/DragProvider/);
  });
});

describe('DragContext.registerTarget / resolveAt', () => {
  test('registerTarget adds to the registry and resolveAt returns it for an inside point', () => {
    const ctx = setupCtx();
    const t: DropTarget = {
      id: 'sec-inbox',
      kind: 'sidebar-section',
      rect: fakeRect(0, 0, 100, 50),
    };
    const unreg = ctx.registerTarget(t);
    expect(ctx.resolveAt(50, 25)).toBe(t);
    unreg();
  });

  test('resolveAt returns null for a point outside every registered target', () => {
    const ctx = setupCtx();
    ctx.registerTarget({
      id: 'a',
      kind: 'sidebar-project',
      rect: fakeRect(10, 10, 20, 20),
    });
    expect(ctx.resolveAt(0, 0)).toBeNull();
    expect(ctx.resolveAt(40, 40)).toBeNull();
  });

  test('unregister removes the entry — subsequent resolveAt is null', () => {
    const ctx = setupCtx();
    const t: DropTarget = {
      id: 'tag-1',
      kind: 'sidebar-tag',
      rect: fakeRect(0, 0, 100, 100),
    };
    const unreg = ctx.registerTarget(t);
    expect(ctx.resolveAt(10, 10)).toBe(t);
    unreg();
    expect(ctx.resolveAt(10, 10)).toBeNull();
  });

  test('overlapping rects: the smaller-area target wins (more specific intent)', () => {
    const ctx = setupCtx();
    // Big container (e.g. sidebar section) wrapping a small drop band.
    const big: DropTarget = {
      id: 'sec-today',
      kind: 'sidebar-section',
      rect: fakeRect(0, 0, 200, 200),
    };
    const small: DropTarget = {
      id: 'todo1-above',
      kind: 'row-above',
      rect: fakeRect(50, 80, 100, 6),
    };
    ctx.registerTarget(big);
    ctx.registerTarget(small);
    expect(ctx.resolveAt(80, 82)).toBe(small);
    // Outside the small band but still inside the big — falls back to big.
    expect(ctx.resolveAt(10, 10)).toBe(big);
  });

  test('boundary coordinates are inclusive on both sides', () => {
    const ctx = setupCtx();
    const t: DropTarget = {
      id: 'edge',
      kind: 'sidebar-area',
      rect: fakeRect(10, 10, 10, 10),
    };
    ctx.registerTarget(t);
    expect(ctx.resolveAt(10, 10)).toBe(t);
    expect(ctx.resolveAt(20, 20)).toBe(t);
    expect(ctx.resolveAt(9, 10)).toBeNull();
    expect(ctx.resolveAt(20, 21)).toBeNull();
  });

  test('setActiveTargetId updates the value exposed via the context', async () => {
    let captured!: DragContextValue;
    render(
      <DragProvider>
        <Capture onReady={(c) => (captured = c)} />
      </DragProvider>,
    );
    expect(captured.activeTargetId).toBeNull();
    await act(async () => {
      captured.setActiveTargetId('row-above-x');
    });
    expect(captured.activeTargetId).toBe('row-above-x');
    await act(async () => {
      captured.setActiveTargetId(null);
    });
    expect(captured.activeTargetId).toBeNull();
  });
});
