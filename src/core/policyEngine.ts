import type { IncomingEvent, InterruptionContract, SessionState, PolicyDecision } from './types';

/**
 * Pure, synchronous, deterministic policy evaluator.
 * No network calls, no async, no imports outside src/core/types.ts.
 */
export function evaluate(
  event: IncomingEvent,
  contract: InterruptionContract,
  sessionState: SessionState
): PolicyDecision {
  const base = {
    eventId: event.id,
    timestamp: new Date().toISOString(),
  };

  // Step 1 — no active session
  if (sessionState === 'idle' || sessionState === 'ended') {
    return {
      ...base,
      decision: 'discard',
      matchedRuleId: 'no-active-session',
      explanation: `Session is ${sessionState}. Events are discarded when no focus session is running.`,
    };
  }

  // Step 2 — VIP sender
  if (contract.vipSenders.includes(event.sender)) {
    return {
      ...base,
      decision: 'interrupt',
      matchedRuleId: 'vip-sender',
      explanation: `Sender "${event.sender}" is on the VIP list and is always allowed to interrupt.`,
    };
  }

  // Step 3 — authorized incident source
  if (contract.incidentSources.includes(event.source)) {
    return {
      ...base,
      decision: 'interrupt',
      matchedRuleId: 'incident-source',
      explanation: `Source "${event.source}" is an authorized incident source and is allowed to interrupt.`,
    };
  }

  // Step 4 — calendar event within the configured lead-time window
  if (
    event.type === 'calendar' &&
    event.minutesUntilStart !== undefined &&
    event.minutesUntilStart <= contract.calendarWindowMinutes
  ) {
    return {
      ...base,
      decision: 'interrupt',
      matchedRuleId: 'calendar-window',
      explanation: `Calendar event starts in ${event.minutesUntilStart} min, within the ${contract.calendarWindowMinutes}-min lead-time window.`,
    };
  }

  // Step 5 — default: hold for end-of-session digest
  return {
    ...base,
    decision: 'hold',
    matchedRuleId: 'default-hold',
    explanation: 'No interruption rule matched. Event held for the end-of-session digest.',
  };
}
