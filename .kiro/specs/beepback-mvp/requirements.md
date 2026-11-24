# Requirements Document

## Introduction

BeepBack is a full-stack retro pager application that acts as an auditable interruption firewall for deep work. During a user-configured focus session, only events that satisfy the user's explicit **Interruption Contract** trigger an interrupt and an audible piezo beep. Everything else is silently held or discarded, with no events ever silently dropped. At session end, a grouped digest surfaces every held message so nothing important is lost.

The system consists of a React 18 + TypeScript frontend, a Node.js + Express webhook ingestion server, a pure deterministic policy engine, a bounded AI page formatter with deterministic offline fallback, and a synthesized Web Audio API piezo beeper—all launchable with a single `npm run dev` command.

## Glossary

- **BeepBack**: The complete application described in this document.
- **Focus_Session**: A user-initiated timed interval during which the Interruption Contract is active. States: `idle`, `active`, `paused`, `ended`.
- **Interruption_Contract**: The set of user-configured rules that determine which incoming events are permitted to interrupt. Contains three rule categories: VIP_Senders, Incident_Sources, and Calendar_Window.
- **VIP_Senders**: A list of approved sender identifiers whose events always result in an `interrupt` decision.
- **Incident_Sources**: A list of approved webhook source identifiers whose events always result in an `interrupt` decision.
- **Calendar_Window**: A configured lead-time in minutes; calendar events with `minutesUntilStart` less than or equal to this threshold result in an `interrupt` decision.
- **Incoming_Event**: A payload submitted via Event Simulator or `POST /api/events`. Fields: `id` (UUID), `source`, `sender`, `type` (`"message"` | `"incident"` | `"calendar"`), `body`, `minutesUntilStart` (optional), `timestamp` (ISO 8601).
- **Policy_Decision**: The result of evaluating one Incoming_Event. Fields: `eventId`, `decision` (`"interrupt"` | `"hold"` | `"discard"`), `matchedRuleId`, `explanation`, `pageText` (string, only for interrupt decisions).
- **Policy_Engine**: The pure synchronous deterministic TypeScript module that maps an Incoming_Event and an Interruption_Contract to a Policy_Decision.
- **Page_Text**: A formatted string of 1–80 printable ASCII characters with no newlines or control characters, displayed on the LCD for interrupt events.
- **Pager_Device**: The virtual 1990s LCD pager UI component on the left side of the screen.
- **Dispatch_Console**: The right-side panel containing the Policy Editor, Event Simulator, Decision Inspector, and Session Digest.
- **Piezo_Synth**: The Web Audio API module that synthesizes classic pager beep tones without external audio files.
- **Summarizer**: The server-side service that compresses an authorized event body into a Page_Text using an LLM or deterministic fallback.
- **Decision_Inspector**: The audit log UI showing every processed event with raw payload, matched rule, decision badge, and explanation.
- **Session_Digest**: The end-of-session view surfacing all held events grouped by sender or source.
- **Event_Simulator**: The in-app UI for sending preset and custom test events and toggling AI Offline mode.
- **Webhook_Server**: The Express server process that hosts `POST /api/events` and `GET /api/state`.

---

## Requirements

### Requirement 1: Focus Session Lifecycle

**User Story:** As a knowledge worker, I want to start, pause, and end a timed focus session, so that I know exactly when my Interruption Contract is active and when to review held messages.

#### Acceptance Criteria

1. THE Focus_Session SHALL support four states: `idle`, `active`, `paused`, and `ended`.
2. WHEN the user starts a Focus_Session with a configured duration in minutes, THE Focus_Session SHALL transition from `idle` to `active` and begin counting down.
3. WHILE the Focus_Session is `active`, THE Pager_Device SHALL display the remaining time in `MM:SS` format, updating every second.
4. WHEN the user pauses a Focus_Session, THE Focus_Session SHALL transition from `active` to `paused` and the countdown SHALL freeze.
5. WHEN the user resumes a paused Focus_Session, THE Focus_Session SHALL transition from `paused` to `active` and the countdown SHALL continue from the frozen value.
6. WHEN the focus countdown reaches zero, THE Focus_Session SHALL transition from `active` to `ended` and the Session_Digest SHALL become visible.
7. WHEN the user clicks "End Session" while the Focus_Session is `active` or `paused`, THE Focus_Session SHALL transition to `ended` and the Session_Digest SHALL become visible immediately.
8. WHEN the Focus_Session is `idle` or `ended`, THE Policy_Engine SHALL treat all Incoming_Events as `discard` with `matchedRuleId` `"no-active-session"`.
9. THE Focus_Session SHALL accept a configurable duration between 1 and 480 minutes inclusive.
10. WHEN the user resets the application, THE Focus_Session SHALL return to `idle` state and all event history SHALL be cleared.

---

### Requirement 2: Interruption Contract Configuration

**User Story:** As a knowledge worker, I want to configure which senders, incident sources, and calendar lead times are permitted to interrupt me, so that I control exactly who and what can reach me during deep work.

#### Acceptance Criteria

1. THE Interruption_Contract SHALL contain three independently configurable rule categories: VIP_Senders, Incident_Sources, and Calendar_Window.
2. THE Policy_Editor SHALL allow the user to add and remove individual entries in the VIP_Senders list.
3. THE Policy_Editor SHALL allow the user to add and remove individual entries in the Incident_Sources list.
4. THE Policy_Editor SHALL allow the user to set the Calendar_Window lead-time to a whole number of minutes between 0 and 60 inclusive.
5. WHEN the user modifies the Interruption_Contract, THE Policy_Editor SHALL persist the updated configuration in browser session state so changes survive component re-renders.
6. WHILE the Focus_Session is `active` or `paused`, THE Policy_Editor SHALL display the current contract as read-only and prevent modification.
7. THE Policy_Editor SHALL display a summary of all active rules so the user can verify the contract before starting a session.

---

### Requirement 3: Event Ingestion

**User Story:** As a developer integrating external tools, I want to submit events via a REST webhook endpoint, so that real monitoring systems and calendar services can feed into BeepBack.

#### Acceptance Criteria

1. THE Webhook_Server SHALL expose a `POST /api/events` HTTP endpoint accepting JSON payloads conforming to the Incoming_Event schema.
2. WHEN a valid Incoming_Event payload is received, THE Webhook_Server SHALL assign a UUID `id` (or preserve a submitted one), record a server-side `timestamp`, and return the Policy_Decision as JSON with HTTP 200 within 2 000 milliseconds.
3. WHEN an invalid JSON payload is submitted to `POST /api/events`, THE Webhook_Server SHALL respond with HTTP 400 and a descriptive error message.
4. THE Webhook_Server SHALL expose a `GET /api/state` endpoint returning the current Focus_Session state, active Interruption_Contract, and all Policy_Decisions for the current session.
5. THE Event_Simulator SHALL provide at least five preset event buttons: a VIP sender message, a non-VIP sender message, an approved incident, an unapproved incident, and a calendar event within the Calendar_Window threshold.
6. THE Event_Simulator SHALL allow the user to compose and submit a custom Incoming_Event with configurable `source`, `sender`, `type`, `body`, and `minutesUntilStart` fields.
7. WHEN the user submits an event via the Event_Simulator, THE Event_Simulator SHALL POST to `/api/events` and display the resulting Policy_Decision immediately in the Decision_Inspector.

---

### Requirement 4: Deterministic Policy Evaluation

**User Story:** As a knowledge worker, I need every incoming event evaluated instantly and impartially by rules I set, so that body text—including adversarial overrides—can never bypass my Interruption Contract.

#### Acceptance Criteria

1. THE Policy_Engine SHALL be a pure synchronous TypeScript function with zero network calls, zero file I/O, and zero non-deterministic operations.
2. WHEN evaluating an Incoming_Event while a Focus_Session is `active`, THE Policy_Engine SHALL apply rules in this order: (a) sender matches a VIP_Senders entry → `interrupt`; (b) source matches an Incident_Sources entry → `interrupt`; (c) type is `"calendar"` and `minutesUntilStart` is less than or equal to Calendar_Window → `interrupt`; (d) otherwise → `hold`.
3. WHEN evaluating an Incoming_Event while a Focus_Session is `idle` or `ended`, THE Policy_Engine SHALL return `discard` with `matchedRuleId` `"no-active-session"` regardless of event content.
4. THE Policy_Engine SHALL set `matchedRuleId` to the identifier of the first matching rule, `"default-hold"` for hold decisions, or `"no-active-session"` for discard-due-to-no-session decisions.
5. THE Policy_Engine SHALL set `explanation` to a non-empty human-readable string describing why the decision was made.
6. THE Policy_Engine SHALL evaluate each event in under 10 milliseconds on standard hardware.
7. FOR ALL Incoming_Events, the `body` field SHALL have no effect on whether the Policy_Engine returns `interrupt` or `hold`; only `sender`, `source`, `type`, and `minutesUntilStart` are evaluated against the Interruption_Contract.
8. THE Policy_Engine SHALL assign a unique `eventId` to every processed event and ensure no two events share the same `eventId` within a session.

---

### Requirement 5: Page Text Formatting

**User Story:** As a knowledge worker, I want every authorized interrupt displayed as a concise pager message, so that I can read it at a glance on the 80-character LCD screen.

#### Acceptance Criteria

1. THE Summarizer SHALL produce a Page_Text string for every `interrupt` decision.
2. THE Page_Text SHALL contain between 1 and 80 printable ASCII characters inclusive and SHALL contain no newline or control characters.
3. WHEN the AI summarizer is available, THE Summarizer SHALL use an LLM to compress the event body into a Page_Text incorporating the sender, source, and body of the event.
4. WHEN the AI Offline toggle is active or the LLM call fails or times out, THE Summarizer SHALL fall back to deterministic truncation: construct `"[CODE] SENDER: BODY"` and truncate to 80 characters, where CODE is `911` for incident type, `143` for VIP message, and `411` for calendar type.
5. IF the Summarizer fallback produces a string longer than 80 characters, THEN THE Summarizer SHALL truncate the string to exactly 80 characters.
6. THE Page_Formatter SHALL sanitize the Page_Text by replacing any non-printable ASCII character (code point below 32 or above 126) with a space before display.
7. FOR ALL valid Incoming_Events resulting in `interrupt`, THE Summarizer SHALL produce a Page_Text satisfying the 80-character constraint regardless of event body length or content.

---

### Requirement 6: Pager Device UI

**User Story:** As a knowledge worker, I want a tactile 1990s pager interface, so that the experience of receiving authorized interrupts feels distinct and deliberate.

#### Acceptance Criteria

1. THE Pager_Device SHALL render a monochrome green-on-dark LCD panel displaying the current Page_Text or session status.
2. THE Pager_Device SHALL display a status badge: `PAGED` for the most recent `interrupt`, `HELD` when the last event was `hold`, or `DISCARDED` when the last event was `discard`.
3. THE Pager_Device SHALL provide Prev and Next buttons to scroll through all interrupt messages received during the current session.
4. THE Pager_Device SHALL provide a Mute toggle that suppresses future piezo beeps without affecting policy decisions.
5. THE Pager_Device SHALL provide a backlight toggle that switches the LCD between its active green-on-dark and an off (dim) state.
6. THE Pager_Device SHALL provide an "End Session" button that triggers the Focus_Session `ended` transition.
7. WHEN an `interrupt` decision is received and Mute is off, THE Piezo_Synth SHALL play a synthesized piezo beep using the Web Audio API with no external audio file dependencies.
8. THE Pager_Device SHALL display the focus countdown timer in `MM:SS` format while the Focus_Session is `active` or `paused`.
9. WHILE the Focus_Session is `idle`, THE Pager_Device SHALL display a prompt to configure the Interruption_Contract and start a session.

---

### Requirement 7: Decision Inspector and Audit Log

**User Story:** As a knowledge worker, I want a full audit log of every processed event, so that I can verify the policy engine behaved correctly and understand why each message was interrupted, held, or discarded.

#### Acceptance Criteria

1. THE Decision_Inspector SHALL display every Incoming_Event processed during the current session in reverse-chronological order.
2. FOR EACH entry in the Decision_Inspector, THE Decision_Inspector SHALL show: the event `id`, `timestamp`, `sender`, `source`, `type`, `body`, the `decision` badge (`PAGED`, `HELD`, or `DISCARDED`), the `matchedRuleId`, and the `explanation`.
3. THE Decision_Inspector SHALL update in real time within 500 milliseconds of an event being processed.
4. THE Decision_Inspector SHALL be scrollable to accommodate any number of entries.
5. WHEN the user resets the application, THE Decision_Inspector SHALL clear all entries.

---

### Requirement 8: End-of-Session Digest

**User Story:** As a knowledge worker, I want a grouped summary of all held messages when my session ends, so that I can review everything I deliberately deferred without losing any context.

#### Acceptance Criteria

1. THE Session_Digest SHALL become visible when the Focus_Session transitions to `ended`.
2. THE Session_Digest SHALL list all events with `decision` `"hold"` from the completed session.
3. THE Session_Digest SHALL group held events by `sender` or `source` so related messages appear together.
4. WHEN the AI summarizer is available and AI Offline is not toggled, THE Session_Digest SHALL display an AI-generated cluster summary for each group.
5. WHEN the AI summarizer is unavailable or AI Offline is toggled, THE Session_Digest SHALL display a plain grouped list of held event senders, sources, and body excerpts truncated to 80 characters each.
6. THE Session_Digest SHALL display the total count of held events at the top of the view.
7. WHEN the Focus_Session is not `ended`, THE Session_Digest SHALL not be visible.

---

### Requirement 9: Complete Event Accounting

**User Story:** As a knowledge worker, I need every ingested event to have a traceable final state, so that nothing is ever silently dropped or lost.

#### Acceptance Criteria

1. THE Policy_Engine SHALL assign every Incoming_Event exactly one terminal decision: `interrupt`, `hold`, or `discard`.
2. THE Policy_Engine SHALL never assign `interrupt` to an event whose `sender`, `source`, and `type`/`minutesUntilStart` combination does not match any rule in the active Interruption_Contract.
3. FOR ALL Incoming_Events processed in a session, THE Webhook_Server SHALL retain all Policy_Decisions in memory and return them via `GET /api/state`.
4. WHEN the application is reset, THE Webhook_Server SHALL clear all stored Policy_Decisions and reinitialize session state.

---

### Requirement 10: Single-Command Local Run and AI Offline Toggle

**User Story:** As a developer, I want to start the full application with one command and test it completely without API keys, so that onboarding and demos require zero external service configuration.

#### Acceptance Criteria

1. WHEN the developer runs `npm run dev`, THE BeepBack application SHALL start both the Vite frontend dev server and the Express Webhook_Server concurrently.
2. THE Event_Simulator SHALL provide an "AI Offline" toggle that, when active, causes the Summarizer to use deterministic fallback formatting for all subsequent events.
3. WHEN the AI Offline toggle is active, THE Pager_Device SHALL display a visible indicator that AI formatting is disabled.
4. THE BeepBack application SHALL function correctly with zero API keys configured in deterministic fallback mode without errors.
5. WHEN LLM API credentials are present in a `.env` file, THE Summarizer SHALL use them; WHEN they are absent, THE Summarizer SHALL automatically apply deterministic fallback without throwing errors.

---

### Requirement 11: Property-Based Test Coverage

**User Story:** As a developer, I want automated property-based tests that prove key invariants hold for all possible inputs, so that regressions in policy correctness or LCD safety are caught automatically.

#### Acceptance Criteria

1. THE test suite SHALL include a property-based test using fast-check that verifies: for all Incoming_Events with any `body` content, the Policy_Engine decision is determined solely by `sender`, `source`, `type`, and `minutesUntilStart`.
2. THE test suite SHALL include a property-based test verifying that for all `interrupt` decisions, the resulting Page_Text satisfies `pageText.length >= 1 && pageText.length <= 80`.
3. THE test suite SHALL include a property-based test verifying that every Incoming_Event submitted to the Policy_Engine receives exactly one terminal decision (`interrupt`, `hold`, or `discard`) with a non-empty `explanation` and `matchedRuleId`.
4. THE test suite SHALL include a property-based test verifying that the Page_Formatter produces only printable ASCII characters (code points 32–126) in the output Page_Text.
5. THE test suite SHALL run via `npx vitest --run` without requiring a running server or API keys.
