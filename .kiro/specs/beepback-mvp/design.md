# Design Document


## Overview

BeepBack is a split-screen React 18 + Express TypeScript application. The left panel renders the virtual Pager_Device; the right Dispatch_Console panel hosts tabbed views for the Policy_Editor, Event_Simulator, Decision_Inspector, and Session_Digest. An Express server on port 3001 handles webhook ingestion and serves session state. All policy logic runs in a single pure TypeScript function with no network dependencies. The Vite dev server proxies `/api` requests to the Express server so the frontend never hard-codes a port.

## Architecture

### High-Level Component Map

```
Browser
  App.tsx
  ├── PagerDevice.tsx          (left panel)
  │   └── piezoSynth.ts        (Web Audio beep)
  └── DispatchConsole
      ├── PolicyEditor.tsx
      ├── EventSimulator.tsx
      ├── DecisionInspector.tsx
      └── SessionDigest.tsx

Node.js Process (port 3001)
  server/index.ts
  ├── POST /api/events          (webhook ingestion)
  ├── GET  /api/state           (session snapshot)
  ├── POST /api/session         (start/pause/end/reset)
  └── server/summarizer.ts      (LLM + fallback formatter)

Shared (imported by both)
  src/core/types.ts
  src/core/policyEngine.ts
  src/core/pageFormatter.ts
```

### Request Flow

1. Event arrives at `POST /api/events` (from webhook or EventSimulator fetch).
2. `server/index.ts` validates the payload, stamps a UUID and timestamp.
3. `policyEngine.evaluate(event, contract, sessionState)` returns a `PolicyDecision` synchronously.
4. If decision is `interrupt`, `summarizer.formatPage(event)` produces a `pageText`.
5. The decision is stored in the server-side `decisions[]` array and returned as JSON.
6. The frontend polls `GET /api/state` every 500 ms (or uses a local optimistic update after simulator POSTs) to refresh the UI.

## Data Models

All shared types live in `src/core/types.ts`.

```typescript
// Event types
export type EventType = 'message' | 'incident' | 'calendar';

export interface IncomingEvent {
  id: string;                    // UUID
  source: string;
  sender: string;
  type: EventType;
  body: string;
  minutesUntilStart?: number;    // only for calendar type
  timestamp: string;             // ISO 8601
}

// Interruption Contract
export interface InterruptionContract {
  vipSenders: string[];          // exact-match sender list
  incidentSources: string[];     // exact-match source list
  calendarWindowMinutes: number; // 0–60
}

// Policy result
export type DecisionType = 'interrupt' | 'hold' | 'discard';

export interface PolicyDecision {
  eventId: string;
  decision: DecisionType;
  matchedRuleId: string;
  explanation: string;
  pageText?: string;             // only present when decision === 'interrupt'
  timestamp: string;
}

// Session state
export type SessionState = 'idle' | 'active' | 'paused' | 'ended';

export interface FocusSession {
  state: SessionState;
  durationMinutes: number;
  remainingSeconds: number;
  startedAt?: string;
}

// Server state snapshot (GET /api/state)
export interface AppState {
  session: FocusSession;
  contract: InterruptionContract;
  decisions: PolicyDecision[];
  aiOffline: boolean;
}
```

## Components and Interfaces

### Module Boundaries

| Module | Type | Exports |
|--------|------|---------|
| `src/core/types.ts` | Shared types | `IncomingEvent`, `InterruptionContract`, `PolicyDecision`, `FocusSession`, `AppState`, `SessionState`, `DecisionType`, `EventType` |
| `src/core/policyEngine.ts` | Pure function | `evaluate(event, contract, state): PolicyDecision` |
| `src/core/pageFormatter.ts` | Pure function | `formatPage(event): string`, `sanitize(text): string` |
| `server/summarizer.ts` | Async service | `formatPage(event, aiOffline): Promise<string>` |
| `server/index.ts` | Express server | REST routes |
| `src/audio/piezoSynth.ts` | Side-effect | `playBeep(): void` |
| `src/components/PagerDevice.tsx` | React component | Props: `{ session, decisions, aiOffline, muted, onMuteToggle, onBacklightToggle, onEndSession }` |
| `src/components/PolicyEditor.tsx` | React component | Props: `{ contract, sessionState, onContractChange }` |
| `src/components/EventSimulator.tsx` | React component | Props: `{ aiOffline, onAiOfflineToggle, onEventResult }` |
| `src/components/DecisionInspector.tsx` | React component | Props: `{ decisions }` |
| `src/components/SessionDigest.tsx` | React component | Props: `{ decisions, session }` |

## Component Design

### `src/core/policyEngine.ts`

Pure function with this signature:

```typescript
export function evaluate(
  event: IncomingEvent,
  contract: InterruptionContract,
  sessionState: SessionState
): PolicyDecision
```

**Evaluation logic (strict precedence):**

1. If `sessionState` is `idle` or `ended`: return `discard`, `matchedRuleId: "no-active-session"`.
2. If `event.sender` is in `contract.vipSenders`: return `interrupt`, `matchedRuleId: "vip-sender"`.
3. If `event.source` is in `contract.incidentSources`: return `interrupt`, `matchedRuleId: "incident-source"`.
4. If `event.type === "calendar"` and `event.minutesUntilStart !== undefined` and `event.minutesUntilStart <= contract.calendarWindowMinutes`: return `interrupt`, `matchedRuleId: "calendar-window"`.
5. Otherwise: return `hold`, `matchedRuleId: "default-hold"`.

The `body` field is never read during evaluation. The function is synchronous and has no imports outside `src/core/types.ts`.

---

### `src/core/pageFormatter.ts`

```typescript
export function formatPage(event: IncomingEvent): string
```

Deterministic fallback logic:
- Select numeric code: `"911"` for `incident`, `"143"` for `message`, `"411"` for `calendar`.
- Build candidate: `` `[${code}] ${event.sender}: ${event.body}` ``
- Sanitize: replace any character with code point < 32 or > 126 with a space.
- Truncate to 80 characters.
- Return result (guaranteed 1–80 chars for any non-empty event).

---

### `server/summarizer.ts`

```typescript
export async function formatPage(
  event: IncomingEvent,
  aiOffline: boolean
): Promise<string>
```

- If `aiOffline` is true or no API key is configured: delegate to `pageFormatter.formatPage(event)`.
- Otherwise: call the configured LLM with a system prompt instructing it to produce a pager message under 80 characters.
- If the LLM call throws or times out (2 000 ms timeout): fall back to `pageFormatter.formatPage(event)`.
- Always run the result through `pageFormatter.sanitize` and `str.slice(0, 80)` before returning.

### `server/index.ts`

Express server on port 3001. In-memory state:

```typescript
let session: FocusSession = { state: 'idle', durationMinutes: 25, remainingSeconds: 1500 };
let contract: InterruptionContract = { vipSenders: [], incidentSources: [], calendarWindowMinutes: 10 };
let decisions: PolicyDecision[] = [];
let aiOffline = false;
```

**Routes:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/events` | Validate, stamp, evaluate, format, store, return PolicyDecision |
| GET | `/api/state` | Return full AppState snapshot |
| POST | `/api/session` | Accept `{ action: 'start' \| 'pause' \| 'resume' \| 'end' \| 'reset', durationMinutes? }` |
| POST | `/api/contract` | Replace the active InterruptionContract |
| POST | `/api/settings` | Toggle `aiOffline` |

CORS is enabled for `http://localhost:5173` (Vite dev origin). The Vite config proxies `/api` to `http://localhost:3001`.

---

### `src/audio/piezoSynth.ts`

```typescript
export function playBeep(): void
```

Creates a short `AudioContext` → `OscillatorNode` → `GainNode` → `destination` chain:
- Oscillator type: `"square"`.
- Frequency sweep: 1 800 Hz → 900 Hz over 80 ms, then 1 800 Hz again for 40 ms (classic two-tone pager chirp).
- Gain envelope: attack 5 ms, sustain, release 20 ms to avoid clicks.
- Total duration: ~200 ms.
- No external file dependencies.

---

### `src/components/PagerDevice.tsx`

Props: `{ session, decisions, aiOffline, onMuteToggle, onBacklightToggle, onEndSession }`

Renders:
- Pager chassis with Tailwind CSS (dark charcoal body, green LCD panel).
- LCD area: current Page_Text (most recent interrupt) or status message, countdown timer, status badge.
- Buttons: Prev, Next (scroll interrupt messages), Mute toggle, Backlight toggle, End Session.
- AI Offline indicator badge when `aiOffline` is true.
- Calls `playBeep()` when a new interrupt decision arrives and mute is off.

---

### `src/components/PolicyEditor.tsx`

Props: `{ contract, sessionState, onContractChange }`

- Disabled (read-only) when `sessionState` is `active` or `paused`.
- Three sections: VIP Senders (tag input), Incident Sources (tag input), Calendar Window (number input 0–60).
- Displays active rule count summary.
- Emits `onContractChange(newContract)` on every change; parent POSTs to `/api/contract`.

---

### `src/components/EventSimulator.tsx`

Props: `{ aiOffline, onAiOfflineToggle, onEventResult }`

- AI Offline toggle switch.
- Five preset buttons, each hard-coded with a representative IncomingEvent payload.
- Custom event form with fields: sender, source, type (select), body, minutesUntilStart.
- On submit: POST to `/api/events`, call `onEventResult(decision)`.

---

### `src/components/DecisionInspector.tsx`

Props: `{ decisions }`

- Scrollable list of all PolicyDecisions, newest first.
- Each row: timestamp, sender, source, type, body excerpt, decision badge (color-coded: green=PAGED, yellow=HELD, gray=DISCARDED), matchedRuleId, explanation.

---

### `src/components/SessionDigest.tsx`

Props: `{ decisions, session }`

- Only visible when `session.state === 'ended'`.
- Filters decisions to `hold` only, groups by `sender`.
- Displays total held count, then one card per group with sender name, event count, and body excerpts.

## State Management

All mutable state lives in `App.tsx` via `useState` and `useEffect`. No external state library is used.

```typescript
const [appState, setAppState] = useState<AppState>(initialState);
```

`App.tsx` polls `GET /api/state` every 500 ms using `useEffect` with a `setInterval`. On each poll it replaces `appState` with the server snapshot. This keeps the browser in sync with webhook events that arrive outside the Event_Simulator.

The countdown timer ticks client-side via a separate `useEffect` interval when `session.state === 'active'`, decrementing `remainingSeconds` locally and POSTing `{ action: 'end' }` when it reaches zero.

---

## Build and Dev Configuration

### `package.json` scripts

```json
{
  "dev": "concurrently \"vite\" \"ts-node server/index.ts\"",
  "build": "vite build && tsc -p tsconfig.server.json",
  "test": "vitest --run"
}
```

`concurrently` starts Vite (port 5173) and the Express server (port 3001) in one terminal.

### `vite.config.ts` proxy

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

### `tsconfig.json`

Strict mode enabled: `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`.

### Environment Variables (`.env`)

```
OPENAI_API_KEY=        # optional; enables AI summarization
OPENAI_BASE_URL=       # optional; for Bedrock-compatible endpoint
SESSION_PORT=3001      # optional override
```

---

## Correctness Properties

The following properties are verified by the fast-check test suite in `tests/policyProperties.test.ts`:

### Property 1: Prompt-Injection Immunity

**Validates: Requirements 4.7**

For all Incoming_Events `e1` and `e2` where `e1.sender === e2.sender`, `e1.source === e2.source`, `e1.type === e2.type`, and `e1.minutesUntilStart === e2.minutesUntilStart` (but `e1.body !== e2.body`), and for all `InterruptionContract` values `c` and `SessionState` values `s`:

```
evaluate(e1, c, s).decision === evaluate(e2, c, s).decision
```

This proves body content cannot change the interrupt/hold/discard outcome.

### Property 2: 80-Character LCD Invariant

**Validates: Requirements 5.2, 5.5**

For all Incoming_Events `e`:

```
const text = formatPage(e);
text.length >= 1 && text.length <= 80
```

### Property 3: Complete Event Accounting

**Validates: Requirements 9.1, 4.4, 4.5**

For all Incoming_Events `e`, contracts `c`, and session states `s`:

```
const d = evaluate(e, c, s);
['interrupt', 'hold', 'discard'].includes(d.decision)
  && d.matchedRuleId.length > 0
  && d.explanation.length > 0
  && d.eventId.length > 0
```

### Property 4: Printable ASCII Invariant

**Validates: Requirements 5.6, 11.4**

For all strings `text` produced by `pageFormatter.sanitize(input)`:

```
[...text].every(ch => ch.codePointAt(0)! >= 32 && ch.codePointAt(0)! <= 126)
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Malformed JSON at `POST /api/events` | Respond HTTP 400 with `{ error: "Invalid payload" }` |
| Missing required event fields | Respond HTTP 400 listing the missing fields |
| LLM call timeout or error | Fall back to `pageFormatter.formatPage(event)`, log to stderr |
| `playBeep()` without user gesture | Catch `NotAllowedError`, suppress silently |
| `minutesUntilStart` absent on calendar event | Treat as no match (safe default: hold) |
| Page_Text longer than 80 chars | Slice to 80 before storing or displaying |
| LLM returns non-ASCII characters | Run through `pageFormatter.sanitize` before use |
| Poll failure (`GET /api/state`) | Log to console, retain previous state, retry next interval |

## Testing Strategy

### Unit Tests (`tests/policyEngine.test.ts`)

Cover six distinct outcomes with concrete example events:
- Sender in VIP list while active → `interrupt`, `matchedRuleId: "vip-sender"`
- Source in Incident list while active → `interrupt`, `matchedRuleId: "incident-source"`
- Calendar event within window → `interrupt`, `matchedRuleId: "calendar-window"`
- Calendar event outside window → `hold`
- Event while session idle → `discard`, `matchedRuleId: "no-active-session"`
- Event matching no rule while active → `hold`, `matchedRuleId: "default-hold"`

### Property-Based Tests (`tests/policyProperties.test.ts`)

Four fast-check properties covering all input spaces. Tests run via `npx vitest --run` with no server and no API keys.
