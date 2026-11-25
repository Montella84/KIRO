/**
 * Property-based tests for the BeepBack policy engine and page formatter.
 * Uses fast-check to verify universal properties across arbitrary inputs.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { evaluate } from '../src/core/policyEngine';
import { formatPage, sanitize } from '../src/core/pageFormatter';
import type { IncomingEvent, InterruptionContract, SessionState } from '../src/core/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbEventType = fc.constantFrom('message', 'incident', 'calendar' as const);

const arbEvent: fc.Arbitrary<IncomingEvent> = fc
  .record({
    id: fc.uuid(),
    source: fc.string({ minLength: 1, maxLength: 50 }),
    sender: fc.string({ minLength: 1, maxLength: 50 }),
    type: arbEventType,
    body: fc.string({ minLength: 0, maxLength: 200 }),
    timestamp: fc.constant(new Date().toISOString()),
    minutesUntilStart: fc.option(fc.integer({ min: 0, max: 120 }), { nil: undefined }),
  })
  .map((e) => ({
    ...e,
    // minutesUntilStart is only semantically relevant for calendar events,
    // but we include it on all types to maximize test coverage
  }));

const arbContract: fc.Arbitrary<InterruptionContract> = fc.record({
  vipSenders: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
  incidentSources: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
  calendarWindowMinutes: fc.integer({ min: 0, max: 60 }),
});

const arbSessionState: fc.Arbitrary<SessionState> = fc.constantFrom(
  'idle',
  'active',
  'paused',
  'ended'
);

// ---------------------------------------------------------------------------
// Property 1: Prompt-Injection Immunity
// Validates: Requirements 4.7
// ---------------------------------------------------------------------------

describe('Property 1 — Prompt-Injection Immunity', () => {
  it('body content never affects the decision outcome', () => {
    fc.assert(
      fc.property(arbEvent, arbContract, arbSessionState, fc.string(), (event, contract, state, altBody) => {
        const e1 = { ...event };
        const e2 = { ...event, body: altBody };

        const r1 = evaluate(e1, contract, state);
        const r2 = evaluate(e2, contract, state);

        expect(r1.decision).toBe(r2.decision);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: 80-Character LCD Invariant
// Validates: Requirements 5.2, 5.5
// ---------------------------------------------------------------------------

describe('Property 2 — 80-Character LCD Invariant', () => {
  it('formatPage always returns a string of length 1–80', () => {
    fc.assert(
      fc.property(arbEvent, (event) => {
        const text = formatPage(event);
        expect(text.length).toBeGreaterThanOrEqual(1);
        expect(text.length).toBeLessThanOrEqual(80);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Complete Event Accounting
// Validates: Requirements 9.1, 4.4, 4.5
// ---------------------------------------------------------------------------

describe('Property 3 — Complete Event Accounting', () => {
  it('every event produces a valid decision with non-empty matchedRuleId and explanation', () => {
    fc.assert(
      fc.property(arbEvent, arbContract, arbSessionState, (event, contract, state) => {
        const d = evaluate(event, contract, state);

        expect(['interrupt', 'hold', 'discard']).toContain(d.decision);
        expect(d.matchedRuleId.length).toBeGreaterThan(0);
        expect(d.explanation.length).toBeGreaterThan(0);
        expect(d.eventId.length).toBeGreaterThan(0);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Printable ASCII Invariant
// Validates: Requirements 5.6, 11.4
// ---------------------------------------------------------------------------

describe('Property 4 — Printable ASCII Invariant', () => {
  it('sanitize output contains only characters with code point 32–126', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitize(input);
        const allPrintable = [...result].every((ch) => {
          const cp = ch.codePointAt(0)!;
          return cp >= 32 && cp <= 126;
        });
        expect(allPrintable).toBe(true);
      })
    );
  });
});
