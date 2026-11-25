import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { evaluate } from '../src/core/policyEngine';
import { formatPage as summarizerFormatPage } from './summarizer';
import type {
  IncomingEvent,
  InterruptionContract,
  PolicyDecision,
  FocusSession,
  AppState,
  SessionState,
} from '../src/core/types';

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:5173',
  })
);

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let session: FocusSession = {
  state: 'idle',
  durationMinutes: 25,
  remainingSeconds: 1500,
};

let contract: InterruptionContract = {
  vipSenders: [],
  incidentSources: [],
  calendarWindowMinutes: 10,
};

let decisions: PolicyDecision[] = [];
let aiOffline = false;

// ---------------------------------------------------------------------------
// POST /api/events
// ---------------------------------------------------------------------------

app.post('/api/events', async (req: Request, res: Response) => {
  const body = req.body as Partial<IncomingEvent>;

  // Validate required fields
  const missing: string[] = [];
  if (!body.sender) missing.push('sender');
  if (!body.source) missing.push('source');
  if (!body.type) missing.push('type');
  if (body.body === undefined || body.body === null) missing.push('body');

  if (missing.length > 0) {
    res
      .status(400)
      .json({ error: `Missing required fields: ${missing.join(', ')}` });
    return;
  }

  const validTypes = ['message', 'incident', 'calendar'];
  if (!validTypes.includes(body.type as string)) {
    res.status(400).json({
      error: `Invalid type "${body.type}". Must be one of: ${validTypes.join(', ')}`,
    });
    return;
  }

  // Stamp event
  const event: IncomingEvent = {
    id: uuidv4(),
    source: body.source as string,
    sender: body.sender as string,
    type: body.type as IncomingEvent['type'],
    body: body.body as string,
    timestamp: new Date().toISOString(),
    ...(body.minutesUntilStart !== undefined && {
      minutesUntilStart: body.minutesUntilStart,
    }),
  };

  // Evaluate policy
  const decision = evaluate(event, contract, session.state as SessionState);

  // Format page text for interrupt decisions
  if (decision.decision === 'interrupt') {
    decision.pageText = await summarizerFormatPage(event, aiOffline);
  }

  decisions.push(decision);
  res.json(decision);
});

// ---------------------------------------------------------------------------
// GET /api/state
// ---------------------------------------------------------------------------

app.get('/api/state', (_req: Request, res: Response) => {
  const state: AppState = { session, contract, decisions, aiOffline };
  res.json(state);
});

// ---------------------------------------------------------------------------
// POST /api/session
// ---------------------------------------------------------------------------

type SessionAction = 'start' | 'pause' | 'resume' | 'end' | 'reset';

const validTransitions: Record<SessionState, SessionAction[]> = {
  idle: ['start', 'reset'],
  active: ['pause', 'end', 'reset'],
  paused: ['resume', 'end', 'reset'],
  ended: ['reset'],
};

app.post('/api/session', (req: Request, res: Response) => {
  const { action, durationMinutes } = req.body as {
    action?: SessionAction;
    durationMinutes?: number;
  };

  if (!action) {
    res.status(400).json({ error: 'Missing required field: action' });
    return;
  }

  const allowed = validTransitions[session.state] ?? [];
  if (!allowed.includes(action)) {
    res.status(409).json({
      error: `Action "${action}" is not valid when session is "${session.state}". Allowed: ${allowed.join(', ')}`,
    });
    return;
  }

  switch (action) {
    case 'start': {
      const duration = durationMinutes ?? session.durationMinutes;
      session = {
        state: 'active',
        durationMinutes: duration,
        remainingSeconds: duration * 60,
        startedAt: new Date().toISOString(),
      };
      break;
    }
    case 'pause':
      session = { ...session, state: 'paused' };
      break;
    case 'resume':
      session = { ...session, state: 'active' };
      break;
    case 'end':
      session = { ...session, state: 'ended' };
      break;
    case 'reset':
      session = {
        state: 'idle',
        durationMinutes: 25,
        remainingSeconds: 1500,
      };
      decisions = [];
      break;
  }

  res.json({ session });
});

// ---------------------------------------------------------------------------
// POST /api/contract
// ---------------------------------------------------------------------------

app.post('/api/contract', (req: Request, res: Response) => {
  const incoming = req.body as Partial<InterruptionContract>;

  if (
    !Array.isArray(incoming.vipSenders) ||
    !Array.isArray(incoming.incidentSources) ||
    typeof incoming.calendarWindowMinutes !== 'number'
  ) {
    res.status(400).json({
      error:
        'Invalid contract. Expected { vipSenders: string[], incidentSources: string[], calendarWindowMinutes: number }',
    });
    return;
  }

  contract = {
    vipSenders: incoming.vipSenders,
    incidentSources: incoming.incidentSources,
    calendarWindowMinutes: Math.max(0, Math.min(60, incoming.calendarWindowMinutes)),
  };

  res.json({ contract });
});

// ---------------------------------------------------------------------------
// POST /api/settings
// ---------------------------------------------------------------------------

app.post('/api/settings', (req: Request, res: Response) => {
  const { aiOffline: flag } = req.body as { aiOffline?: boolean };

  if (typeof flag !== 'boolean') {
    res.status(400).json({ error: 'Missing or invalid field: aiOffline (boolean required)' });
    return;
  }

  aiOffline = flag;
  res.json({ aiOffline });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.SESSION_PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[BeepBack] Express server listening on http://localhost:${PORT}`);
});
