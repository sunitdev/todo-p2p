import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { StoreProvider, useStore } from '../../src/lib/store';
import { FakeEngine } from '../helpers/fakeEngine';

afterEach(cleanup);

function wrapper(engine: FakeEngine) {
  return ({ children }: { children: React.ReactNode }) => (
    <StoreProvider engine={engine.asEngine()}>{children}</StoreProvider>
  );
}

describe('StoreProvider / useStore', () => {
  test('exposes empty initial todos/areas/projects', () => {
    const engine = new FakeEngine();
    const { result } = renderHook(() => useStore(), { wrapper: wrapper(engine) });
    expect(result.current.todos).toEqual([]);
    expect(result.current.areas).toEqual([]);
    expect(result.current.projects).toEqual([]);
  });

  test('addArea calls engine.commit once with bytes', async () => {
    const engine = new FakeEngine();
    const { result } = renderHook(() => useStore(), { wrapper: wrapper(engine) });
    await act(async () => {
      await result.current.addArea({ id: 'a1', name: 'Work', color: 'tint' });
    });
    expect(engine.commits.length).toBe(1);
    expect(engine.commits[0]).toBeInstanceOf(Uint8Array);
    expect(result.current.areas.map((a) => a.id)).toEqual(['a1']);
  });

  test('addProject commits and surfaces project', async () => {
    const engine = new FakeEngine();
    const { result } = renderHook(() => useStore(), { wrapper: wrapper(engine) });
    await act(async () => {
      await result.current.addProject({
        id: 'p1',
        title: 'P',
        icon: { kind: 'lucide', name: 'Folder' },
        color: 'tint',
        areaId: null,
      });
    });
    expect(engine.commits.length).toBe(1);
    expect(result.current.projects[0]?.id).toBe('p1');
  });

  test('unmount unsubscribes from engine', () => {
    const engine = new FakeEngine();
    const { unmount } = render(
      <StoreProvider engine={engine.asEngine()}>
        <span>x</span>
      </StoreProvider>,
    );
    expect(engine.unsubscribeCount).toBe(0);
    unmount();
    expect(engine.unsubscribeCount).toBe(1);
  });

  test('useStore outside provider throws', () => {
    function Consumer() {
      useStore();
      return null;
    }
    // happy-dom captures errors thrown during render via React error reporting.
    expect(() => render(<Consumer />)).toThrow(/StoreProvider/);
  });

  test('remote change triggers re-render', async () => {
    const engine = new FakeEngine();
    function View() {
      const store = useStore();
      return <div data-testid="count">{store.todos.length}</div>;
    }
    render(
      <StoreProvider engine={engine.asEngine()}>
        <View />
      </StoreProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');

    await act(async () => {
      const remote = engine.todos();
      const change = remote.add({ id: 'a', title: 'x' });
      // simulate the remote-change event path through engine
      engine.injectRemote('peer', change);
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
