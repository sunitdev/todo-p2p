import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../src/lib/store';
import { Home } from '../../src/screens/Home';
import { FakeEngine } from '../helpers/fakeEngine';

afterEach(cleanup);

function renderHome(engine = new FakeEngine()) {
  return {
    engine,
    ...render(
      <StoreProvider engine={engine.asEngine()}>
        <Home />
      </StoreProvider>,
    ),
  };
}

describe('Home screen', () => {
  let originalConfirm: typeof window.confirm;
  beforeEach(() => {
    originalConfirm = window.confirm;
  });
  afterEach(() => {
    window.confirm = originalConfirm;
  });

  function mainHeading() {
    return document.querySelector('main h1');
  }

  test('default selection is Today; renders demo Today items', () => {
    renderHome();
    expect(mainHeading()?.textContent).toBe('Today');
    expect(document.body.textContent).toContain('Create a new to-do');
    expect(document.body.textContent).toContain('Project 1 task');
  });

  test('clicking Inbox row switches main heading', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Inbox/ }));
    expect(mainHeading()?.textContent).toBe('Inbox');
  });

  test('opening "New List" shows ProjectForm dialog', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'New List' }));
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
  });

  test('submitting AreaForm commits via engine and closes modal', async () => {
    const { engine } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'New area' }));
    const dialog = screen.getByRole('dialog', { name: 'New area' });
    fireEvent.change(within(dialog).getByPlaceholderText('Personal, Work…'), {
      target: { value: 'Work' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    });
    expect(engine.commits.length).toBe(1);
    expect(screen.queryByRole('dialog', { name: 'New area' })).not.toBeInTheDocument();
  });

  test('Delete area cancelled via window.confirm=false does NOT call removeArea', async () => {
    const { engine } = renderHome();
    // seed an area through engine.todos() so it shows in sidebar
    await act(async () => {
      const change = engine.todos().addArea({ id: 'a1', name: 'Work', color: 'tint' });
      engine.injectRemote('seed', change);
    });
    expect(screen.getByText('Work')).toBeInTheDocument();
    const commitsBefore = engine.commits.length;

    window.confirm = mock(() => false) as unknown as typeof window.confirm;

    // open area context menu
    fireEvent.contextMenu(screen.getByText('Work'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete area/ }));

    // confirm was called, but no new commit (delete aborted)
    expect((window.confirm as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect(engine.commits.length).toBe(commitsBefore);
  });
});
