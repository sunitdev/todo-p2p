# Screens

Each: layout → states → Apple reference → core types bound.

## TodoList

Apple ref: Reminders (iOS).

```
┌─────────────────────────────┐
│  Todos                  + │ ← NavBar large-title, chrome on scroll
│                             │
│  3 open                     │ ← subtitle
├─────────────────────────────┤
│ ○  Buy milk            ›   │ ← ListRow swipe→done/delete
│ ○  Ship release        ›   │
│ ●  Renew passport      ›   │
│                             │
│                       [ + ] │ ← floating Button filled, bottom-trailing
└─────────────────────────────┘
```

Binds: `TodoDoc.todos`, `TodoDoc.order`.

States:
- empty → "No todos. Tap + to add." centered, secondaryLabel.
- loading → skeleton 3 rows, shimmer with smooth spring.
- error → Toast kind=error, list stays last-known.
- loaded → rendered above.

## TodoDetail

Apple ref: Reminders detail sheet.

```
┌─────────────────────────────┐
│ ╴╴╴╴ (sheet handle)         │
│                             │
│  Title          [        ]  │ ← TextField
│  Notes          [        ]  │ ← TextField multiline
│  Tags           [ work ✕ ]  │
│                             │
│  ─────────────              │
│  Done           [ Toggle ]  │
│                             │
│  [ Delete ]      [  Save  ] │ ← destructive + filled
└─────────────────────────────┘
```

Binds: `Todo`.

Presentation: Sheet mode=sheet, detents=['md','lg'], material=thick.

States:
- empty → new todo, fields blank, Save disabled until title.
- loading → fields disabled, smooth fade.
- error → inline TextField error on offending field.
- loaded → fields prefilled from `Todo`.

## Pairing

Apple ref: AirDrop / AppleTV pairing.

```
┌─────────────────────────────┐
│  Pair device                │
│                             │
│  ┌───────────────┐          │
│  │   ▓▓ QR ▓▓    │  ← display PairingPayload as QR
│  │   ▓▓▓▓▓▓▓▓    │
│  └───────────────┘          │
│                             │
│  Expires in 00:54           │ ← 60s ticket countdown
│                             │
│  Fingerprint: a3·f9·7c      │ ← match-confirm
│  [ Confirm match ]          │
│                             │
│  [ Scan QR instead ]        │ ← swap to scanner
└─────────────────────────────┘
```

Binds: `PairingPayload`, `PairingState`.

States:
- empty → "Generate pairing code" Button filled.
- loading → "Generating…" spring fade.
- error → Toast error, "Try again" Button.
- loaded → QR + countdown + fingerprint.
- expired (ticket 60s elapsed) → QR dimmed, "Code expired" red label, "Regenerate" Button.

Critical: CLAUDE.md — tickets single-use, 60s expiry. Show countdown live.

## Settings

Apple ref: iOS Settings grouped list.

```
┌─────────────────────────────┐
│  Settings                   │
│                             │
│  DEVICE                     │ ← section header, footnote uppercase
│ ┌─────────────────────────┐ │
│ │  Name        MacBook  › │ │
│ │  ID          a3f9··  ›  │ │
│ └─────────────────────────┘ │
│                             │
│  SYNC                       │
│ ┌─────────────────────────┐ │
│ │  Paired devices    2  › │ │
│ │  Pair new…            › │ │
│ └─────────────────────────┘ │
│                             │
│  STORAGE                    │
│ ┌─────────────────────────┐ │
│ │  Export backup        › │ │
│ │  Wipe device     [red]› │ │
│ └─────────────────────────┘ │
│                             │
│  ABOUT                      │
│ ┌─────────────────────────┐ │
│ │  Version           1.0  │ │
│ │  Source code          › │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Binds: `DeviceIdentity` (Device section), `PairingState` (Sync section).

Sections: Device / Sync / Storage / About. ListRow grouped on bgL2, separator inset.

## Unsupported

Apple ref: none — required by CLAUDE.md "No silent fallback" for Safari (no WebTransport).

```
┌─────────────────────────────┐
│                             │
│         [ icon ]            │ ← lucide AlertTriangle, size 48, secondaryLabel
│                             │
│   Browser not supported     │ ← title2
│                             │
│   This browser lacks        │ ← body, secondaryLabel
│   WebTransport.             │
│   Use Chrome, Edge, or      │
│   download the desktop app. │
│                             │
│   [ Get desktop app ]       │ ← Button tinted
│                             │
└─────────────────────────────┘
```

Binds: none.

States: single static state. No retry. No silent fallback ever.
