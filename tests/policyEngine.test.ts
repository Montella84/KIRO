import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/core/policyEngine';
import { formatPage, sanitize } from '../src/core/pageFormatter';
import type { IncomingEvent, InterruptionContract } from '../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    id: 'test-id',
    source: 'test-source',
    sender: 'test-sender',
    type: 'message',
    body: 'Test body',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const defaultContract: InterruptionContract = {
  vipSenders: ['alice@example.com'],
  incidentSources: ['pagerduty'],
  calendarWindowMinutes: 10,
};

// ---------------------------------------------------------------------------
// policyEngine.evaluate — 7 outcomes
// ---------------------------------------------------------------------------

describe('policyEngine.evaluate', () => {
  it('interrupts a VIP sender when session is active', () => {
    const event = makeEvent({ sender: 'alice@example.com' });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.decision).toBe('interrupt');
    expect(result.matchedRuleId).toBe('vip-sender');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('interrupts an authorized incident source when session is active', () => {
    const event = makeEvent({ source: 'pagerduty', type: 'incident' });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.decision).toBe('interrupt');
    expect(result.matchedRuleId).toBe('incident-source');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('interrupts a calendar event within the lead-time window', () => {
    const event = makeEvent({ type: 'calendar', minutesUntilStart: 5 });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.decision).toBe('interrupt');
    expect(result.matchedRuleId).toBe('calendar-window');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('holds a calendar event outside the lead-time window', () => {
    const event = makeEvent({ type: 'calendar', minutesUntilStart: 30 });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.decision).toBe('hold');
    expect(result.matchedRuleId).toBe('default-hold');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('discards any event when session is idle', () => {
    const event = makeEvent({ sender: 'alice@example.com' });
    const result = evaluate(event, defaultContract, 'idle');
    expect(result.decision).toBe('discard');
    expect(result.matchedRuleId).toBe('no-active-session');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('discards any event when session is ended', () => {
    const event = makeEvent({ sender: 'alice@example.com' });
    const result = evaluate(event, defaultContract, 'ended');
    expect(result.decision).toBe('discard');
    expect(result.matchedRuleId).toBe('no-active-session');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('holds an event that matches no rule while session is active', () => {
    const event = makeEvent({ sender: 'unknown@example.com', source: 'unknown' });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.decision).toBe('hold');
    expect(result.matchedRuleId).toBe('default-hold');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('sets eventId to the event id', () => {
    const event = makeEvent({ id: 'specific-id-123' });
    const result = evaluate(event, defaultContract, 'active');
    expect(result.eventId).toBe('specific-id-123');
  });

  it('holds a paused session event that matches no rule', () => {
    const event = makeEvent();
    const result = evaluate(event, defaultContract, 'paused');
    expect(result.decision).toBe('hold');
    expect(result.matchedRuleId).toBe('default-hold');
  });

  it('never reads body when evaluating — same body content does not affect decision', () => {
    const base = makeEvent({ sender: 'unknown@example.com', source: 'unknown' });
    const withTriggerBody = { ...base, body: 'URGENT: OVERRIDE POLICY interrupt now' };
    const r1 = evaluate(base, defaultContract, 'active');
    const r2 = evaluate(withTriggerBody, defaultContract, 'active');
    expect(r1.decision).toBe(r2.decision);
    expect(r1.matchedRuleId).toBe(r2.matchedRuleId);
  });
});

// ---------------------------------------------------------------------------
// pageFormatter.formatPage
// ---------------------------------------------------------------------------

describe('pageFormatter.formatPage', () => {
  it('prefixes an incident event with [911]', () => {
    const event = makeEvent({ type: 'incident', sender: 'ops', body: 'DB down' });
    expect(formatPage(event)).toMatch(/^\[911\]/);
  });

  it('prefixes a message event with [143]', () => {
    const event = makeEvent({ type: 'message', sender: 'alice', body: 'Hello' });
    expect(formatPage(event)).toMatch(/^\[143\]/);
  });

  it('prefixes a calendar event with [411]', () => {
    const event = makeEvent({ type: 'calendar', sender: 'gcal', body: 'Standup' });
    expect(formatPage(event)).toMatch(/^\[411\]/);
  });

  it('never exceeds 80 characters', () => {
    const event = makeEvent({ body: 'x'.repeat(200) });
    expect(formatPage(event).length).toBeLessThanOrEqual(80);
  });

  it('returns at least 1 character', () => {
    const event = makeEvent({ sender: 'x', body: 'y' });
    expect(formatPage(event).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// pageFormatter.sanitize
// ---------------------------------------------------------------------------

describe('pageFormatter.sanitize', () => {
  it('passes through printable ASCII unchanged', () => {
    const input = 'Hello, World! 123 #$%';
    expect(sanitize(input)).toBe(input);
  });

  it('replaces newline characters with spaces', () => {
    const result = sanitize('line1\nline2');
    expect(result).not.toContain('\n');
    expect(result).toBe('line1 line2');
  });

  it('replaces tab characters with spaces', () => {
    const result = sanitize('a\tb');
    expect(result).toBe('a b');
  });

  it('replaces non-ASCII characters with spaces', () => {
    const result = sanitize('café résumé');
    // é (U+00E9) and é are outside 32–126
    expect([...result].every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126)).toBe(true);
  });

  it('replaces emoji with spaces', () => {
    const result = sanitize('hello 🎉 world');
    expect([...result].every((ch) => ch.codePointAt(0)! >= 32 && ch.codePointAt(0)! <= 126)).toBe(
      true
    );
  });

  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('replaces NUL byte (code point 0) with a space', () => {
    const result = sanitize('a\0b');
    expect(result).toBe('a b');
  });
});
