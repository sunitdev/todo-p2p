import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function mainHeading() {
  return document.querySelector('main h1');
}

function selectInbox() {
  fireEvent.click(screen.getByRole('button', { name: /Inbox/ }));
}

describe('Home screen', () => {
  let originalConfirm: typeof window.confirm;
  beforeEach(() => {
    originalConfirm = window.confirm;
  });
  afterEach(() => {
    window.confirm = originalConfirm;
  });

  test('default selection is Today; empty state shown', () => {
    renderHome();
    expect(mainHeading()?.textContent).toBe('Today');
    expect(document.body.textContent).toContain('Nothing here yet');
  });

  test('clicking Inbox row switches main heading', () => {
    renderHome();
    selectInbox();
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
    await act(async () => {
      const change = engine.todos().addArea({ id: 'a1', name: 'Work', color: 'tint' });
      engine.injectRemote('seed', change);
    });
    expect(screen.getByText('Work')).toBeInTheDocument();
    const commitsBefore = engine.commits.length;

    window.confirm = mock(() => false) as unknown as typeof window.confirm;

    fireEvent.contextMenu(screen.getByText('Work'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete area/ }));

    expect((window.confirm as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect(engine.commits.length).toBe(commitsBefore);
  });
});

describe('Home — add todo', () => {
  test('footer + opens inline row + Enter commits + new draft opens', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();

    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const input = screen.getByRole('textbox', { name: /New to-do title/i }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);

    await user.type(input, 'Buy milk{Enter}');

    expect(engine.commits.length).toBe(1);
    expect(engine.todos().list().map((t) => t.title)).toEqual(['Buy milk']);

    // rapid entry: a fresh blank draft input appears
    const next = screen.getByRole('textbox', { name: /New to-do title/i }) as HTMLInputElement;
    expect(next.value).toBe('');
    expect(document.activeElement).toBe(next);

    // visible in current Today view (default selection)
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  test('⌘N opens inline row and focuses input', async () => {
    renderHome();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }),
      );
    });
    const input = screen.getByRole('textbox', { name: /New to-do title/i });
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  test('bare `n` keystroke (web fallback) opens draft when no input focused', async () => {
    renderHome();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });
    expect(screen.getByRole('textbox', { name: /New to-do title/i })).toBeInTheDocument();
  });

  test('bare `n` while typing in title does NOT open a second draft', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const input = screen.getByRole('textbox', { name: /New to-do title/i });
    await user.type(input, 'nnnn');
    // value preserves typed letters; only one draft row exists
    expect((input as HTMLInputElement).value).toBe('nnnn');
    expect(screen.getAllByRole('textbox', { name: /New to-do title/i })).toHaveLength(1);
  });

  test('Escape cancels draft', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const input = screen.getByRole('textbox', { name: /New to-do title/i });
    await user.type(input, 'abc{Escape}');
    expect(screen.queryByRole('textbox', { name: /New to-do title/i })).not.toBeInTheDocument();
    expect(engine.commits.length).toBe(0);
  });

  test('blur with empty discards; blur with text commits', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();

    // empty blur → no commit
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const empty = screen.getByRole('textbox', { name: /New to-do title/i });
    await act(async () => {
      empty.blur();
    });
    expect(engine.commits.length).toBe(0);
    expect(screen.queryByRole('textbox', { name: /New to-do title/i })).not.toBeInTheDocument();

    // text + blur → commit
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const withText = screen.getByRole('textbox', { name: /New to-do title/i });
    await user.type(withText, 'Walk dog');
    await act(async () => {
      withText.blur();
    });
    expect(engine.commits.length).toBe(1);
    expect(engine.todos().list().map((t) => t.title)).toEqual(['Walk dog']);
  });

  test('rapid entry: two Enter commits two todos', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('alpha{Enter}beta{Enter}');
    expect(engine.commits.length).toBe(2);
    expect(engine.todos().list().map((t) => t.title)).toEqual(['alpha', 'beta']);
  });

  test('project selected: new todo inherits projectId', async () => {
    const user = userEvent.setup();
    const engine = new FakeEngine();
    await act(async () => {
      const change = engine.todos().addProject({
        id: 'p1',
        title: 'Spec',
        icon: { kind: 'lucide', name: 'Folder' },
        color: 'tint',
        areaId: null,
      });
      engine.injectRemote('seed', change);
    });
    renderHome(engine);

    await user.click(screen.getByRole('button', { name: /Spec/ }));
    expect(mainHeading()?.textContent).toBe('Spec');

    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('Draft RFC{Enter}');

    const todos = engine.todos().list();
    const added = todos.find((t) => t.title === 'Draft RFC');
    expect(added).toBeDefined();
    expect(added?.projectId).toBe('p1');
  });

  test('Today section: added todo appears in Today view (scheduledWhen=today)', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    // default is Today
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('Today bound{Enter}');

    const t = engine.todos().list()[0];
    expect(t?.scheduledWhen).toBe('today');
    expect(t?.projectId).toBeUndefined();
    expect(t?.areaId).toBeUndefined();
    expect(screen.getByText('Today bound')).toBeInTheDocument();
  });

  test('Inbox section: added todo lands in Inbox (no scheduledWhen)', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    selectInbox();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('Inbox bound{Enter}');

    const t = engine.todos().list()[0];
    expect(t?.scheduledWhen).toBeUndefined();
    expect(screen.getByText('Inbox bound')).toBeInTheDocument();
  });

  test('Today selection: added todo has scheduledWhen=today', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('Run{Enter}');
    const t = engine.todos().list().find((x) => x.title === 'Run');
    expect(t?.scheduledWhen).toBe('today');
  });

  test('Someday selection: added todo has scheduledWhen=someday', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: /Someday/ }));
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.keyboard('Later{Enter}');
    const t = engine.todos().list().find((x) => x.title === 'Later');
    expect(t?.scheduledWhen).toBe('someday');
  });

  test('notes field carries through to committed todo', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    const title = screen.getByRole('textbox', { name: /New to-do title/i });
    await user.type(title, 'Read book');
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('Chapter 3');
    title.focus();
    await user.keyboard('{Enter}');
    const t = engine.todos().list().find((x) => x.title === 'Read book');
    expect(t?.notes).toBe('Chapter 3');
  });

  test('flag toggled before commit sets flagged=true', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    const title = screen.getByRole('textbox', { name: /New to-do title/i });
    title.focus();
    await user.keyboard('Important{Enter}');
    const t = engine.todos().list().find((x) => x.title === 'Important');
    expect(t?.flagged).toBe(true);
  });

  test('schedule pill reflects current section', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: 'New To-Do' }));
    // default Today
    const card = screen.getByRole('textbox', { name: /New to-do title/i }).closest('li');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Today')).toBeInTheDocument();
  });
});
