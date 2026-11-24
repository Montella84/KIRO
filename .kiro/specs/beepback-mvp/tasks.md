# Implementation Plan

## Overview

16 task groups implement the BeepBack MVP from project scaffolding through property-based test verification. Each group maps directly to a design module or requirements cluster. Groups 1-6 build the foundation (tooling, types, policy engine, formatter, server, summarizer). Groups 7-13 build the UI layer. Groups 14-15 add test coverage. Group 16 performs end-to-end integration verification.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 1, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "4.4", "6.1", "6.2", "6.3", "6.4", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "9.1", "9.2", "9.3", "9.4", "9.5", "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "11.1", "11.2", "11.3", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "14.1", "14.2", "14.3", "15.1", "15.2", "15.3", "15.4", "15.5", "15.6"] },
    { "id": 7, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6"] }
  ]
}
```

## Tasks

- [x] 1. Project Scaffolding and Tooling
  - [ ] 1.1 Initialize a Vite + React 18 + TypeScript project in the workspace root with `npm create vite@latest . -- --template react-ts`
  - [ ] 1.2 Install dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `concurrently`, `express`, `cors`, `uuid`, `dotenv`, `ts-node`, `vitest`, `fast-check`, `@types/express`, `@types/cors`, `@types/uuid`, `@types/node`
  - [ ] 1.3 Configure Tailwind CSS with `npx tailwindcss init -p` and add `src/**/*.{ts,tsx}` to the content array
  - [ ] 1.4 Add `tsconfig.server.json` targeting Node 18 with `module: "commonjs"` and `outDir: "dist/server"`
  - [ ] 1.5 Configure `vite.config.ts` to proxy `/api` requests to `http://localhost:3001`
  - [ ] 1.6 Add `package.json` scripts: `dev` using `concurrently` to run both Vite and `ts-node server/index.ts`, `test` as `vitest --run`, `build` as `vite build`
  - [ ] 1.7 Create `.env.example` documenting `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `SESSION_PORT`
  - [ ] 1.8 Add a `README.md` with quickstart instructions for `npm install`, `npm run dev`, and `npm test`

- [ ] 2. Core Type Definitions
  - [ ] 2.1 Create `src/core/types.ts` with `EventType`, `IncomingEvent`, `InterruptionContract`, `DecisionType`, `PolicyDecision`, `SessionState`, `FocusSession`, and `AppState` interfaces exactly as specified in the design document
  - [ ] 2.2 Enable TypeScript strict mode in `tsconfig.json` with `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`

- [ ] 3. Policy Engine
  - [ ] 3.1 Create `src/core/policyEngine.ts` exporting `evaluate(event, contract, sessionState): PolicyDecision` with no imports outside `src/core/types.ts`
  - [ ] 3.2 Implement the five-step evaluation logic: no-active-session discard, VIP sender interrupt, incident source interrupt, calendar window interrupt, default hold
  - [ ] 3.3 Ensure `matchedRuleId` is set to one of the five string constants: `"no-active-session"`, `"vip-sender"`, `"incident-source"`, `"calendar-window"`, or `"default-hold"`
  - [ ] 3.4 Ensure `explanation` is a non-empty human-readable string for every code path
  - [ ] 3.5 Confirm the `body` field is never read during evaluation

- [ ] 4. Page Formatter
  - [ ] 4.1 Create `src/core/pageFormatter.ts` exporting `formatPage(event): string` and `sanitize(text): string`
  - [ ] 4.2 Implement `sanitize` to replace any character with code point below 32 or above 126 with a space
  - [ ] 4.3 Implement `formatPage` to build `"[CODE] SENDER: BODY"` with codes `911` for incident, `143` for message, `411` for calendar, then sanitize and slice to 80 characters
  - [ ] 4.4 Add a TypeScript guard ensuring the return value is never an empty string for valid events

- [ ] 5. Express Webhook Server
  - [ ] 5.1 Create `server/index.ts` with Express on `process.env.SESSION_PORT ?? 3001` and CORS enabled for `http://localhost:5173`
  - [ ] 5.2 Initialize in-memory state: `session`, `contract`, `decisions[]`, `aiOffline`
  - [ ] 5.3 Implement `POST /api/events`: validate required fields, stamp UUID and timestamp, call `policyEngine.evaluate`, call `summarizer.formatPage` for interrupt decisions, push to `decisions[]`, return `PolicyDecision` as JSON
  - [ ] 5.4 Return HTTP 400 with a descriptive message for missing or invalid fields
  - [ ] 5.5 Implement `GET /api/state` returning the full `AppState` snapshot as JSON
  - [ ] 5.6 Implement `POST /api/session` accepting `{ action, durationMinutes? }` with actions `start`, `pause`, `resume`, `end`, `reset`; return HTTP 409 for invalid state transitions
  - [ ] 5.7 Implement `POST /api/contract` to replace the active `InterruptionContract`
  - [ ] 5.8 Implement `POST /api/settings` to toggle `aiOffline`

- [ ] 6. Summarizer Service
  - [ ] 6.1 Create `server/summarizer.ts` exporting `formatPage(event, aiOffline): Promise<string>`
  - [ ] 6.2 When `aiOffline` is true or no API key is set, delegate immediately to `pageFormatter.formatPage`
  - [ ] 6.3 When API key is available and `aiOffline` is false, call the OpenAI-compatible endpoint with a 2000 ms timeout; on failure, fall back to `pageFormatter.formatPage`
  - [ ] 6.4 Always run the result through `pageFormatter.sanitize` and `.slice(0, 80)` before returning

- [ ] 7. Piezo Synthesizer
  - [ ] 7.1 Create `src/audio/piezoSynth.ts` exporting `playBeep(): void`
  - [ ] 7.2 Implement the two-tone chirp using `AudioContext`, `OscillatorNode` with type `"square"`, and `GainNode` with frequency sweep 1800 Hz to 900 Hz to 1800 Hz over approximately 200 ms
  - [ ] 7.3 Add a gain envelope with 5 ms attack and 20 ms release to prevent audio clicks
  - [ ] 7.4 Catch and suppress `NotAllowedError` when the AudioContext is blocked by browser policy

- [ ] 8. Pager Device Component
  - [ ] 8.1 Create `src/components/PagerDevice.tsx` with props `{ session, decisions, aiOffline, muted, onMuteToggle, onBacklightToggle, onEndSession }`
  - [ ] 8.2 Render a Tailwind-styled pager chassis with dark charcoal body and a monochrome green LCD panel
  - [ ] 8.3 Display the most recent interrupt Page_Text on the LCD, or an idle/paused/ended status message when no interrupt exists
  - [ ] 8.4 Display the focus countdown timer in `MM:SS` format when session is `active` or `paused`
  - [ ] 8.5 Display the status badge: PAGED, HELD, or DISCARDED based on the most recent decision
  - [ ] 8.6 Implement Prev and Next buttons to scroll through interrupt messages; disable each at boundary
  - [ ] 8.7 Implement the Mute toggle button with visible muted state indicator
  - [ ] 8.8 Implement the Backlight toggle that switches the LCD between active green and dim state
  - [ ] 8.9 Implement the End Session button that calls `onEndSession`
  - [ ] 8.10 Display an AI Offline indicator badge when `aiOffline` is true
  - [ ] 8.11 Call `playBeep()` via a `useEffect` whenever a new interrupt decision arrives and `muted` is false

- [ ] 9. Policy Editor Component
  - [ ] 9.1 Create `src/components/PolicyEditor.tsx` with props `{ contract, sessionState, onContractChange }`
  - [ ] 9.2 Render three sections: VIP Senders tag input, Incident Sources tag input, Calendar Window number input between 0 and 60
  - [ ] 9.3 Disable all inputs and show a read-only banner when `sessionState` is `active` or `paused`
  - [ ] 9.4 Display an active rule count summary listing VIP sender count, incident source count, and calendar window value
  - [ ] 9.5 Call `onContractChange(newContract)` on every change so the parent can POST to `/api/contract`

- [ ] 10. Event Simulator Component
  - [ ] 10.1 Create `src/components/EventSimulator.tsx` with props `{ aiOffline, onAiOfflineToggle, onEventResult }`
  - [ ] 10.2 Add an AI Offline toggle switch that calls `onAiOfflineToggle` and POSTs to `/api/settings`
  - [ ] 10.3 Add five preset event buttons with hard-coded payloads: VIP message, non-VIP message, approved incident, unapproved incident, and calendar event within the window threshold
  - [ ] 10.4 Add a custom event form with fields for sender, source, type (select: message/incident/calendar), body, and minutesUntilStart
  - [ ] 10.5 On preset or custom submit: POST to `/api/events`, call `onEventResult(decision)`, and clear the custom form
  - [ ] 10.6 Display a loading state while the fetch is in-flight and an error message if the fetch fails

- [ ] 11. Decision Inspector Component
  - [ ] 11.1 Create `src/components/DecisionInspector.tsx` with props `{ decisions }`
  - [ ] 11.2 Render a scrollable reverse-chronological list of all policy decisions
  - [ ] 11.3 Each row shows timestamp, sender, source, type, body excerpt truncated to 60 characters, decision badge colored green/yellow/gray for PAGED/HELD/DISCARDED, matchedRuleId, and explanation

- [ ] 12. Session Digest Component
  - [ ] 12.1 Create `src/components/SessionDigest.tsx` with props `{ decisions, session }`
  - [ ] 12.2 Hide the component when `session.state` is not `ended`
  - [ ] 12.3 Filter decisions to `hold` only, group by `sender`, and display the total held count at the top
  - [ ] 12.4 Render one card per sender group with the sender name, event count, and body excerpts each truncated to 80 characters

- [ ] 13. App Root and Layout
  - [ ] 13.1 Rewrite `src/App.tsx` with a split-screen layout: Pager_Device on the left at fixed width, Dispatch_Console on the right flex-grow
  - [ ] 13.2 Add `useState<AppState>` for all mutable state and a `useEffect` polling `GET /api/state` every 500 ms
  - [ ] 13.3 Add a local countdown `useEffect` that decrements `remainingSeconds` each second when session is `active` and POSTs `{ action: 'end' }` when it reaches zero
  - [ ] 13.4 Implement session control buttons (Start, Pause/Resume) in the Dispatch_Console header wired to `POST /api/session`
  - [ ] 13.5 Implement the global Reset button wired to `POST /api/session` with `{ action: 'reset' }`
  - [ ] 13.6 Add tabbed navigation in the Dispatch_Console for Policy Editor, Event Simulator, Decision Inspector, and Session Digest
  - [ ] 13.7 Wire `onContractChange` to POST to `/api/contract`
  - [ ] 13.8 Wire `onAiOfflineToggle` to POST to `/api/settings`

- [ ] 14. Unit Tests
  - [ ] 14.1 Create `tests/policyEngine.test.ts` with Vitest unit tests for all seven policy outcomes: VIP interrupt, incident interrupt, calendar-window interrupt, calendar-outside-window hold, idle-session discard, ended-session discard, and default hold
  - [ ] 14.2 Assert each test verifies `decision`, `matchedRuleId`, and `explanation` fields
  - [ ] 14.3 Add unit tests for `pageFormatter.formatPage` and `pageFormatter.sanitize` covering each event type and non-ASCII input characters

- [ ] 15. Property-Based Tests
  - [ ] 15.1 Create `tests/policyProperties.test.ts` using fast-check
  - [ ] 15.2 Write Property 1 (prompt-injection immunity): generate two events identical in all fields except `body`; assert both produce the same `decision`
  - [ ] 15.3 Write Property 2 (80-character LCD invariant): generate arbitrary events; assert `formatPage(event).length` is between 1 and 80 inclusive
  - [ ] 15.4 Write Property 3 (complete event accounting): generate arbitrary events, contracts, and session states; assert every result has a valid `decision`, non-empty `matchedRuleId`, and non-empty `explanation`
  - [ ] 15.5 Write Property 4 (printable ASCII invariant): generate arbitrary strings; assert every character in `sanitize(input)` has code point between 32 and 126 inclusive
  - [ ] 15.6 Verify all four properties pass via `npx vitest --run`

- [ ] 16. Integration Verification and Polish
  - [ ] 16.1 Run `npm run dev` and verify both the Vite frontend on port 5173 and the Express server on port 3001 start without errors
  - [ ] 16.2 Use the Event Simulator to POST a VIP event and verify the pager beeps, displays Page_Text, and shows the PAGED badge
  - [ ] 16.3 Toggle AI Offline and verify the pager still interrupts using deterministic fallback formatting
  - [ ] 16.4 Run a 1-minute session to completion and verify the Session_Digest appears with all held events grouped by sender
  - [ ] 16.5 Run `npm test` and confirm all unit tests and all four property-based tests pass
  - [ ] 16.6 Verify `GET /api/state` returns all decisions from the session with no events missing from the audit log

## Notes

- The Policy Engine at `src/core/policyEngine.ts` must remain import-free except for `src/core/types.ts`. Any addition of network or async imports is a spec violation.
- All `pageText` values must pass through `pageFormatter.sanitize` and `.slice(0, 80)` before storage or display, including LLM output.
- If `ts-node` startup is slow in the `concurrently` dev setup, `tsx` can serve as a drop-in replacement.
- Property-based tests must pass with `npx vitest --run` with no running server and no API keys.
- Tasks 16.1-16.6 are manual verification steps confirming the full running system works end-to-end.
