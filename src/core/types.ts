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
