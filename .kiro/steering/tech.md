---
inclusion: always
---

# Technology Stack & Constraints

## Core Stack
- **Frontend:** React 18+, TypeScript (strict mode), Vite, Tailwind CSS
- **Backend API:** Node.js + Express + TypeScript (lightweight local REST server for `POST /api/events` webhook ingestion, session state, and optional LLM proxy)
- **Audio Synthesis:** Browser-native Web Audio API (`AudioContext` oscillator piezo tones—no external `.mp3`/`.wav` file dependencies)
- **AI Compression & Digest:** Pluggable summarizer service supporting OpenAI-compatible / Bedrock API keys via `.env`, with a built-in deterministic fallback mode that works 100% offline with zero API keys required
- **Testing & Property-Based Testing:** Vitest + `fast-check`

## Technical Constraints & Invariants
1. **Zero LLM Imports in Policy Engine:** `src/core/policyEngine.ts` must remain 100% pure, synchronous, deterministic TypeScript with zero network or AI dependencies.
2. **80-Character Hardware Limit:** Every emitted pager display string must satisfy `pageText.length <= 80` and contain only printable ASCII/LCD-safe characters (no newlines or control characters).
3. **Complete Event Accounting:** Every ingested event must be assigned a unique ID and persisted in exactly one terminal state (`interrupt`, `hold`, or `discard`) with a non-empty `explanation` and `matchedRuleId`.
4. **Single-Command Local Run:** Running `npm run dev` must start both the Vite frontend and Express webhook server concurrently so the app and webhook work immediately out of the box.