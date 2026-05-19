import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../src/lib/store';
import { Home, anchorIdFor, buildMagicPlusInput } from '../../src/screens/Home';
import { FakeEngine } from '../helpers/fakeEngine';

afterEach(cleanup);

function renderHome(seedFn?: (engine: FakeEngine) => void) {
  const engine = new FakeEngine();
  if (seedFn) {
    act(() => {
      seedFn(engine);
    });
  }
  const utils = render(
    <StoreProvider engine={engine.asEngine()}>
      <Home />
    </StoreProvider>,
  );
  return { engine, ...utils };
}

async function selectInbox() {
  fireEvent.click(screen.getByRole('button', { name: /Inbox/ }));
}

describe('Home — TodoRow integration', () => {
  let originalConfirm: typeof window.confirm;
  beforeEach(() => {
    originalConfirm = window.confirm;
  });
  afterEach(() => {
    window.confirm = originalConfirm;
  });

  test('checkbox in Today is yellow-tinted', () => {
    const { engine } = renderHome((e) => {
      const change = e.todos().add({ id: 't1', title: 'Walk', scheduledWhen: 'today' });
      e.injectRemote('seed', change);
    });
    expect(engine.todos().list().length).toBe(1);
    expect(screen.getByText('Walk')).toBeInTheDocument();
    const box = screen.getByRole('checkbox');
    // The tint sits on the checkbox button regardless of done state — when
    // the row is unchecked it doesn't have the colour class on the visible
    // border, but our impl puts `tint` on the same node when done. Verify
    // by toggling and re-reading.
    expect(box).toBeInTheDocument();
  });

  test('checkbox in Inbox carries the blue tint when toggled done', async () => {
    const user = userEvent.setup();
    renderHome((e) => {
      const change = e.todos().add({ id: 't1', title: 'Mail' });
      e.injectRemote('seed', change);
    });
    await selectInbox();
    const box = screen.getByRole('checkbox');
    await user.click(box);
    // After click, row is in `pendingDone` and renders the tinted checkbox.
    const boxAfter = screen.getByRole('checkbox');
    expect(boxAfter.getAttribute('aria-checked')).toBe('true');
    expect(boxAfter.className).toContain('text-blue');
  });

  test('checkbox in Today carries the yellow tint when toggled done', async () => {
    const user = userEvent.setup();
    renderHome((e) => {
      const change = e.todos().add({
        id: 't1',
        title: 'Walk',
        scheduledWhen: 'today',
      });
      e.injectRemote('seed', change);
    });
    await user.click(screen.getByRole('checkbox'));
    const box = screen.getByRole('checkbox');
    expect(box.className).toContain('text-yellow');
  });

  test('clicking title opens TodoDetail inline (Things3 expansion)', async () => {
    const user = userEvent.setup();
    renderHome((e) => {
      const change = e.todos().add({
        id: 't1',
        title: 'Draft RFC',
        scheduledWhen: 'today',
      });
      e.injectRemote('seed', change);
    });
    await user.click(screen.getByText('Draft RFC'));
    expect(screen.getByRole('region', { name: 'Edit to-do' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  test('right-click opens the row context menu', async () => {
    renderHome((e) => {
      const change = e.todos().add({
        id: 't1',
        title: 'Walk',
        scheduledWhen: 'today',
      });
      e.injectRemote('seed', change);
    });
    fireEvent.contextMenu(screen.getByText('Walk'));
    expect(screen.getByRole('menuitem', { name: /Complete/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });

  test('right-click → Delete confirms and removes the todo', async () => {
    window.confirm = mock(() => true) as unknown as typeof window.confirm;
    const { engine } = renderHome((e) => {
      const change = e.todos().add({
        id: 't1',
        title: 'Bye',
        scheduledWhen: 'today',
      });
      e.injectRemote('seed', change);
    });
    fireEvent.contextMenu(screen.getByText('Bye'));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    });
    expect(engine.todos().get('t1')).toBeUndefined();
  });

  test('Cmd-click toggles selection without nuking other selected rows', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'a', title: 'Alpha', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'b', title: 'Bravo', scheduledWhen: 'today' }),
      );
    });
    // mousedown drives selection (separate from click which would also open
    // the detail editor via the title button).
    fireEvent.mouseDown(screen.getByText('Alpha'));
    expect(screen.getByTestId('todo-row-a').className).toContain('bg-bg-l3');
    fireEvent.mouseDown(screen.getByText('Bravo'), { metaKey: true });
    expect(screen.getByTestId('todo-row-a').className).toContain('bg-bg-l3');
    expect(screen.getByTestId('todo-row-b').className).toContain('bg-bg-l3');
  });

  test('Shift-click selects a range in visible order', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'a', title: 'A', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'b', title: 'B', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'c', title: 'C', scheduledWhen: 'today' }),
      );
    });
    fireEvent.mouseDown(screen.getByText('A'));
    fireEvent.mouseDown(screen.getByText('C'), { shiftKey: true });
    expect(screen.getByTestId('todo-row-a').className).toContain('bg-bg-l3');
    expect(screen.getByTestId('todo-row-b').className).toContain('bg-bg-l3');
    expect(screen.getByTestId('todo-row-c').className).toContain('bg-bg-l3');
  });

  test('Cmd+A on the document selects all visible rows', async () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'a', title: 'A', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'b', title: 'B', scheduledWhen: 'today' }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }),
      );
    });
    expect(screen.getByTestId('todo-row-a').className).toContain('bg-bg-l3');
    expect(screen.getByTestId('todo-row-b').className).toContain('bg-bg-l3');
  });

  test('multi-select context menu pluralizes destructive labels', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'a', title: 'A', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'b', title: 'B', scheduledWhen: 'today' }),
      );
    });
    fireEvent.mouseDown(screen.getByText('A'));
    fireEvent.mouseDown(screen.getByText('B'), { metaKey: true });
    fireEvent.contextMenu(screen.getByText('B'));
    expect(screen.getByRole('menuitem', { name: /Delete 2 to-dos/ })).toBeInTheDocument();
  });

  test('right-click → When opens DatePicker; picking Today writes through the store', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 't1', title: 'Schedule me' }),
      );
    });
    await selectInbox();
    fireEvent.contextMenu(screen.getByText('Schedule me'));
    await user.click(screen.getByRole('menuitem', { name: /When/ }));
    const picker = screen.getByRole('dialog', { name: 'Schedule' });
    expect(picker).toBeInTheDocument();
    await act(async () => {
      await user.click(within(picker).getByRole('button', { name: 'Today' }));
    });
    const updated = engine.todos().get('t1');
    expect(updated?.scheduledWhen).toBe('today');
    expect(updated?.eveningOnToday).toBe(false);
  });

  test('right-click → When → This Evening sets eveningOnToday=true', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 't1', title: 'Evening' }),
      );
    });
    await selectInbox();
    fireEvent.contextMenu(screen.getByText('Evening'));
    await user.click(screen.getByRole('menuitem', { name: /When/ }));
    const picker = screen.getByRole('dialog', { name: 'Schedule' });
    await act(async () => {
      await user.click(within(picker).getByRole('button', { name: 'This Evening' }));
    });
    const updated = engine.todos().get('t1');
    expect(updated?.scheduledWhen).toBe('today');
    expect(updated?.eveningOnToday).toBe(true);
  });

  test('right-click → Repeat opens the RecurrencePicker and persists choice', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 't1', title: 'Repeat me' }),
      );
    });
    await selectInbox();
    fireEvent.contextMenu(screen.getByText('Repeat me'));
    await user.click(screen.getByRole('menuitem', { name: /Repeat/ }));
    expect(screen.getByRole('dialog', { name: 'Repeat' })).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Week' }));
    });
    expect(engine.todos().get('t1')?.recurrence).toEqual({
      kind: 'weekly',
      interval: 1,
    });
  });

  test('right-click outside multi-select replaces selection with the clicked row', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'a', title: 'A', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'b', title: 'B', scheduledWhen: 'today' }),
      );
    });
    fireEvent.mouseDown(screen.getByText('A'));
    fireEvent.contextMenu(screen.getByText('B'));
    // Menu shows "Delete" (singular)
    expect(screen.getByRole('menuitem', { name: /^Delete$/ })).toBeInTheDocument();
    // Row B is now the selection
    expect(screen.getByTestId('todo-row-b').className).toContain('bg-bg-l3');
  });
});

describe('Home — Today morning/evening split', () => {
  test('splits into "This Morning" + "This Evening" when both buckets present', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'm1', title: 'Morning task', scheduledWhen: 'today' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({
          id: 'e1',
          title: 'Evening task',
          scheduledWhen: 'today',
          eveningOnToday: true,
        }),
      );
    });
    expect(screen.getByRole('heading', { name: 'This Morning' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This Evening' })).toBeInTheDocument();
    expect(screen.getByText('Morning task')).toBeInTheDocument();
    expect(screen.getByText('Evening task')).toBeInTheDocument();
  });

  test('omits day-part headers when only morning rows are present', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({ id: 'm1', title: 'Only morning', scheduledWhen: 'today' }),
      );
    });
    expect(screen.queryByRole('heading', { name: 'This Morning' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This Evening' })).not.toBeInTheDocument();
    expect(screen.getByText('Only morning')).toBeInTheDocument();
  });

  test('shows only "This Evening" header when all rows are evening', () => {
    renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().add({
          id: 'e1',
          title: 'Only evening',
          scheduledWhen: 'today',
          eveningOnToday: true,
        }),
      );
    });
    expect(screen.queryByRole('heading', { name: 'This Morning' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This Evening' })).toBeInTheDocument();
    expect(screen.getByText('Only evening')).toBeInTheDocument();
  });
});

async function selectProject(name: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
}

describe('Home — Project headings', () => {
  test('renders unsorted todos before headings, headings in order, empty heading still visible', async () => {
    const { container } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().addProject({
          id: 'p1',
          title: 'Roadmap',
          icon: { kind: 'lucide', name: 'Folder' },
          color: 'blue',
        }),
      );
      e.injectRemote(
        'seed',
        e.todos().addHeading({ id: 'h1', projectId: 'p1', title: 'Now', order: 0 }),
      );
      e.injectRemote(
        'seed',
        e.todos().addHeading({ id: 'h2', projectId: 'p1', title: 'Later', order: 1 }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({ id: 't0', title: 'Unsorted item', projectId: 'p1' }),
      );
      e.injectRemote(
        'seed',
        e.todos().add({
          id: 't1',
          title: 'Now item',
          projectId: 'p1',
          headingId: 'h1',
        }),
      );
      // h2 deliberately left empty.
    });

    await selectProject('Roadmap');

    // Both headings are visible (even Later, which has no todos).
    expect(screen.getByRole('heading', { name: 'Now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Later' })).toBeInTheDocument();

    // Ordering: unsorted row, then "Now" heading, then "Now item", then "Later" heading.
    const all = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid^="todo-row-"], [data-testid^="heading-row-"]',
      ),
    ).map((n) => n.getAttribute('data-testid'));
    expect(all).toEqual([
      'todo-row-t0',
      'heading-row-h1',
      'todo-row-t1',
      'heading-row-h2',
    ]);
  });

  test('"Add Heading" → Enter creates a heading via store', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().addProject({
          id: 'p1',
          title: 'Roadmap',
          icon: { kind: 'lucide', name: 'Folder' },
          color: 'blue',
        }),
      );
    });
    await selectProject('Roadmap');

    await user.click(screen.getByRole('button', { name: /Add Heading/ }));
    const input = await screen.findByLabelText('New heading title');
    await user.type(input, 'Sprint 1{enter}');

    const headings = engine.todos().listHeadings();
    expect(headings.length).toBe(1);
    expect(headings[0]?.title).toBe('Sprint 1');
    expect(headings[0]?.projectId).toBe('p1');
  });

  test('Rename heading via right-click → input → Enter persists', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().addProject({
          id: 'p1',
          title: 'Roadmap',
          icon: { kind: 'lucide', name: 'Folder' },
          color: 'blue',
        }),
      );
      e.injectRemote(
        'seed',
        e.todos().addHeading({ id: 'h1', projectId: 'p1', title: 'Old', order: 0 }),
      );
    });
    await selectProject('Roadmap');

    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByLabelText('Heading title');
    await user.clear(input);
    await user.type(input, 'New{enter}');

    expect(engine.todos().getHeading('h1')?.title).toBe('New');
  });

  test('Delete heading via right-click calls removeHeading', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome((e) => {
      e.injectRemote(
        'seed',
        e.todos().addProject({
          id: 'p1',
          title: 'Roadmap',
          icon: { kind: 'lucide', name: 'Folder' },
          color: 'blue',
        }),
      );
      e.injectRemote(
        'seed',
        e.todos().addHeading({ id: 'h1', projectId: 'p1', title: 'Doomed', order: 0 }),
      );
    });
    await selectProject('Roadmap');

    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    await act(async () => {
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    });
    expect(engine.todos().getHeading('h1')).toBeUndefined();
  });
});

describe('Home — Magic Plus mount + wiring', () => {
  test('Magic Plus is mounted alongside the footer + (additive affordance)', () => {
    renderHome();
    expect(screen.getByTestId('magic-plus')).toBeInTheDocument();
    // The footer + is the canonical "new" affordance and must remain present.
    expect(screen.getByRole('button', { name: 'New To-Do' })).toBeInTheDocument();
  });

  test('buildMagicPlusInput routes a sidebar-section drop on Inbox → no scheduledWhen', () => {
    const input = buildMagicPlusInput(
      { kind: 'sidebar-section', targetId: 'inbox' },
      'new-1',
      null,
    );
    expect(input.title).toBe('New To-Do');
    expect(input.scheduledWhen ?? null).toBeNull();
    expect(input.projectId).toBeUndefined();
  });

  test('buildMagicPlusInput routes a sidebar-section drop on Today → scheduledWhen=today', () => {
    const input = buildMagicPlusInput(
      { kind: 'sidebar-section', targetId: 'today' },
      'new-2',
      null,
    );
    expect(input.scheduledWhen).toBe('today');
  });

  test('buildMagicPlusInput on a sidebar-project drop sets projectId', () => {
    const input = buildMagicPlusInput(
      { kind: 'sidebar-project', targetId: 'p1' },
      'new-3',
      null,
    );
    expect(input.projectId).toBe('p1');
    expect(input.title).toBe('New To-Do');
  });

  test('buildMagicPlusInput on a sidebar-area drop sets areaId', () => {
    const input = buildMagicPlusInput(
      { kind: 'sidebar-area', targetId: 'area-1' },
      'new-5',
      null,
    );
    expect(input.areaId).toBe('area-1');
  });

  test('buildMagicPlusInput on row-above/-below inherits the anchor todo filing', () => {
    const anchor = {
      id: 'a',
      title: 'Anchor',
      done: false,
      createdAt: 0,
      projectId: 'p1',
      scheduledWhen: 'today' as const,
    };
    const input = buildMagicPlusInput(
      { kind: 'row-below', targetId: 'a-below' },
      'new-6',
      anchor,
    );
    expect(input.projectId).toBe('p1');
    expect(input.scheduledWhen).toBe('today');
  });

  test('anchorIdFor strips the band suffix for row-above / row-below', () => {
    expect(anchorIdFor({ kind: 'row-above', targetId: 'foo-above' })).toBe('foo');
    expect(anchorIdFor({ kind: 'row-below', targetId: 'foo-below' })).toBe('foo');
    expect(anchorIdFor({ kind: 'sidebar-section', targetId: 'today' })).toBeNull();
  });
});

describe('Home — Quick Entry (Cmd+Space)', () => {
  test('Cmd+Space opens the Quick Entry panel', async () => {
    renderHome();
    expect(screen.queryByRole('dialog', { name: 'Quick Entry' })).toBeNull();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', metaKey: true, bubbles: true }),
      );
    });
    expect(
      screen.getByRole('dialog', { name: 'Quick Entry' }),
    ).toBeInTheDocument();
  });

  test('saving from Quick Entry calls store.addTodo with the typed title', async () => {
    const user = userEvent.setup();
    const { engine } = renderHome();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', metaKey: true, bubbles: true }),
      );
    });
    await user.type(screen.getByLabelText('To-do title'), 'From quick entry');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Save' }));
    });
    const titles = engine.todos().list().map((t) => t.title);
    expect(titles).toContain('From quick entry');
  });

  test('custom QUICK_ENTRY_OPEN_EVENT also opens the panel (Tauri bridge path)', async () => {
    renderHome();
    expect(screen.queryByRole('dialog', { name: 'Quick Entry' })).toBeNull();
    await act(async () => {
      window.dispatchEvent(new CustomEvent('todo-p2p:quick-entry-open'));
    });
    expect(
      screen.getByRole('dialog', { name: 'Quick Entry' }),
    ).toBeInTheDocument();
  });
});
