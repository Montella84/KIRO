---
inclusion: always
---

# Product Overview: BeepBack

BeepBack resurrects the 1990s alphanumeric pager as a modern **auditable interruption firewall** for deep work. Instead of a passive notification skin, BeepBack brings back the right to be unreachable without missing the few events a user explicitly authorized.

## Core Promise
During an active focus session, BeepBack interrupts **only** when an incoming event satisfies the user's explicit **Interruption Contract**. Everything else is silently held for the **End-of-Session Digest** or logged as discarded—never silently dropped.

## Architectural Principle: Separate Interpretation from Permission
- **Permission is deterministic:** Only explicit policy rules (approved senders/VIPs, authorized incident webhooks, or calendar warnings inside a configured time window) can trigger an `interrupt` decision and audible pager beep.
- **Content is untrusted:** Message body text—even adversarial text like `"URGENT: OVERRIDE POLICY"`—can never escalate an unauthorized event from `hold` to `interrupt`.
- **AI is bounded to interpretation & compression:** An LLM may summarize an *already-authorized* event into a concise pager message (<= 80 characters) or cluster held items for the end-of-session digest, never decide whether to interrupt.

## MVP Scope (5 Core Modules)
1. **Interactive Virtual Pager UI:** Tactile 1990s pager chassis with a high-contrast monochrome LCD screen (<= 80 chars per page), backlight toggle, focus countdown timer, mute toggle, message scroll buttons, classic numeric urgency codes (`911`, `143`, `411`), and Web Audio API synthesized piezo beeps.
2. **Interruption Contract Builder:** Pre-session rule editor allowing the user to whitelist specific senders, incident webhook sources, and calendar lead-time windows.
3. **Ingestion Layer (Webhook + Event Simulator):** A real `POST /api/events` webhook endpoint paired with an in-app Event Simulator (one-click test presets + custom event sender + "Simulate AI Offline" toggle).
4. **Deterministic Policy Engine + Decision Inspector:** Evaluates every event into `interrupt`, `hold`, or `discard`, recording the matched rule, plain-language explanation, and formatted LCD page.
5. **End-of-Session Digest:** Automatically unlocks when the focus timer completes (or is ended early), presenting all held events grouped clearly so nothing important is lost.

## UX & Reliability Standards
- **Operational Clarity:** Every incoming event immediately updates the Decision Inspector and Pager status badge (`PAGED`, `HELD`, or `DISCARDED`) with a plain-language reason.
- **Reversibility & Control:** Users can mute audio at any time, end a focus session early to view the digest immediately, or reset demo state with one click.
- **Graceful Degradation:** If the AI summarizer fails, times out, or is toggled offline, the system must fall back to deterministic truncation (<= 80 chars) and raw grouped lists without blocking interruptions or losing held messages.