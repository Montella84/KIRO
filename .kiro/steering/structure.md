---
inclusion: always
---

# Project Structure & Conventions

## Directory Layout
```text
D:\KIRO\
├── .kiro/
│   ├── steering/          # Always-included product, tech, and structure rules
│   ├── specs/             # Kiro feature specs (requirements.md, design.md, tasks.md)
│   └── hooks/             # Automated Kiro agent hooks for test & constraint checks
├── server/
│   ├── index.ts           # Express server: POST /api/events, GET /api/state, session routes
│   └── summarizer.ts      # Bounded AI page compressor & digest generator with offline fallback
├── src/
│   ├── core/
│   │   ├── types.ts       # Shared domain models (FocusPolicy, IncomingEvent, PolicyDecision, PagerPage)
│   │   ├── policyEngine.ts# Pure deterministic Interruption Contract evaluator
│   │   └── pageFormatter.ts# Strict <= 80-char LCD sanitizer and deterministic fallback formatter
│   ├── audio/
│   │   └── piezoSynth.ts  # Web Audio API 90s pager beep/chirp synthesizer
│   ├── components/
│   │   ├── PagerDevice.tsx      # Tactile 90s LCD pager hardware UI + buttons + timer
│   │   ├── PolicyEditor.tsx     # Interruption Contract rule configuration panel
│   │   ├── EventSimulator.tsx   # Preset & custom event sender + AI Offline toggle
│   │   ├── DecisionInspector.tsx# Audit log showing raw event, matched rule, decision & explanation
│   │   └── SessionDigest.tsx    # End-of-session held messages summary view
│   ├── App.tsx            # Split-screen layout: Virtual Pager (left) + Dispatch Console (right)
│   └── main.tsx
├── tests/
│   ├── policyEngine.test.ts     # Unit tests for rule matching & edge cases
│   └── policyProperties.test.ts # fast-check property-based tests (prompt injection, <=80 chars, zero drops)
├── LICENSE
└── package.json