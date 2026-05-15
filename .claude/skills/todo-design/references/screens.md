# Screens

Each: layout → states → core types bound. Reference: Things3.

## TodoList — primary

```
┌──────────────┬──────────────────────────────────────────┐
│   Inbox    0 │   ⭐ Today                               │
│ ★ Today    5 │                                          │
│   Upcoming   │   This Morning                           │
│   Anytime    │   ☐  Pick up dry cleaning   Errands      │
│   Someday    │   ☐  Reply to design review ⚑           │
│   Logbook    │   ☐  Draft Q2 roadmap                    │
│              │      Focus on sync reliability + UX 📄  │
│   PROJECTS   │                                          │
│   ○ Things   │   This Evening                           │
│              │   ☐  30-minute walk         Health       │
│   AREA 1     │   ☐  Read A Pattern Lang.   Reading      │
│   ○ Proj 1   │                                          │
│   AREA 2     │                                          │
│   ○ Proj 2   │                                          │
│ + New List ⚙ │   ⊕    📅  →  🔎                        │
└──────────────┴──────────────────────────────────────────┘
```

- Sidebar (260px, `bg-bg-l1`): 6 fixed sections + Projects (standalone) + Areas (collapsible). Selected = full-fill `row-selected`. Icons semantic (Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green).
- Main (`bg-bg-l2`): 22px bold title + leading colored section icon. Group headings ("This Morning"/"This Evening") = 15px bold. Rows = `TodoRow`.
- Footer (`bg-bg-l1` + top separator): leading round filled-blue `+`, trailing 3 icons (Calendar, ArrowRight, Search). No "New To-Do" label.

Binds: `TodoDoc.todos`, `TodoDoc.order`, filtered by `scheduledWhen`/`scheduledFor`/`done`/`dueDate`.

Section filters:
- Inbox → no `projectId`, no `areaId`, no `scheduledWhen`, no `scheduledFor`, not done.
- Today → `scheduledWhen === 'today'` OR `scheduledFor` ≤ today.
- Upcoming → `scheduledFor` future, not done.
- Anytime → not scheduled, not someday, not done.
- Someday → `scheduledWhen === 'someday'`.
- Logbook → `done === true`.

States:
- empty → "Nothing here yet" + "Tap + to add a to-do." centered, label-secondary/tertiary.
- loading → skeleton 3 rows (no shimmer; static `bg-bg-l3` blocks, opacity-pulse ease-out).
- error → Toast at top; list stays last-known.

## TodoDetail — inline (no modal)

Things3 expands row in place. Tap → title replaced w/ title + notes + meta inputs, indented under same checkbox.

```
☐  Draft Q2 roadmap                                     ⚑
   ┌─────────────────────────────────────────────────┐
   │ Notes: Focus on sync reliability + UX polish    │
   ├─────────────────────────────────────────────────┤
   │ 📅 When  May 15           ⚑  Flag               │
   │ 🏷 Tags  Work                                    │
   │   [ Delete ]              [ Done editing ]      │
   └─────────────────────────────────────────────────┘
☐  30-minute walk
```

Binds: `Todo`. Mutations via `useStore().updateTodo(id, patch)`.

States: see TodoList loading/error. No empty (only renders for existing row).

## Pairing

```
┌─────────────────────────────────────────┐
│  Pair device                            │
│  ┌───────────────┐                      │
│  │   ▓▓ QR ▓▓    │  display PairingPayload as QR
│  │   ▓▓▓▓▓▓▓▓    │                      │
│  └───────────────┘                      │
│  Expires in 00:54        countdown 60s  │
│  Fingerprint: a3·f9·7c   match-confirm  │
│  [ Confirm match ]                      │
│  [ Scan QR instead ]                    │
└─────────────────────────────────────────┘
```

QR card = flat `bg-bg-l1` + 1px separator border, no glass. Countdown = `text-callout text-label-secondary`; switches to `text-red` after 50s.

Binds: `PairingPayload`, `PairingState`.

Critical: CLAUDE.md — tickets single-use, 60s expiry. Show countdown live.

## Settings

iOS-style grouped list on flat dark surfaces.

```
┌─────────────────────────────────────────┐
│  Settings                               │
│  DEVICE                                 │
│  ┌──────────────────────────────────┐  │
│  │  Name        MacBook              │  │
│  │  ID          a3f9··               │  │
│  └──────────────────────────────────┘  │
│  SYNC                                   │
│  ┌──────────────────────────────────┐  │
│  │  Paired devices       2           │  │
│  │  Pair new…                        │  │
│  └──────────────────────────────────┘  │
│  STORAGE                                │
│  ┌──────────────────────────────────┐  │
│  │  Export backup                    │  │
│  │  Wipe device              [red]   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Group label = `.section-header`. Each group = `Surface` (`bg-bg-l1 border border-separator rounded-2`). Rows 32px tall (`h-8`), 14px text.

Binds: `DeviceIdentity` (Device), `PairingState` (Sync).

## Unsupported

Single static state for Safari (no WebTransport).

```
┌─────────────────────────────────────────┐
│         [ AlertTriangle ]               │
│   Browser not supported                 │
│   This browser lacks WebTransport.      │
│   Use Chrome, Edge, or download         │
│   the desktop app.                      │
│   [ Get desktop app ]                   │
└─────────────────────────────────────────┘
```

Centered. Icon = `AlertTriangle` size 48, `text-label-secondary`. Title `text-title`, body `text-callout text-label-secondary`. Button = pill. No retry, no silent fallback.
