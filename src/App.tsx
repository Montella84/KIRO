import { useState, useEffect, useRef } from 'react';
import type { AppState, InterruptionContract, PolicyDecision, SessionState } from './core/types';
import PagerDevice from './components/PagerDevice';
import PolicyEditor from './components/PolicyEditor';
import EventSimulator from './components/EventSimulator';
import DecisionInspector from './components/DecisionInspector';
import SessionDigest from './components/SessionDigest';

const initialState: AppState = {
  session: { state: 'idle', durationMinutes: 25, remainingSeconds: 1500 },
  contract: { vipSenders: [], incidentSources: [], calendarWindowMinutes: 10 },
  decisions: [],
  aiOffline: false,
};

type Tab = 'policy' | 'simulator' | 'inspector' | 'digest';

async function apiPost(path: string, body: unknown): Promise<void> {
  await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [muted, setMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('policy');

  // ---------------------------------------------------------------------------
  // Poll GET /api/state every 500 ms
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = (await res.json()) as AppState;
          setAppState(data);
        }
      } catch {
        // Retain previous state on poll failure; retry next interval
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Client-side countdown + auto-end when timer reaches zero
  // ---------------------------------------------------------------------------
  const sessionRef = useRef(appState.session);
  sessionRef.current = appState.session;

  useEffect(() => {
    const id = setInterval(() => {
      if (sessionRef.current.state !== 'active') return;
      setAppState((prev) => {
        const newRemaining = Math.max(0, prev.session.remainingSeconds - 1);
        if (newRemaining === 0 && prev.session.state === 'active') {
          // Fire end action — don't await inside setState
          void apiPost('/api/session', { action: 'end' });
        }
        return {
          ...prev,
          session: { ...prev.session, remainingSeconds: newRemaining },
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Session controls
  // ---------------------------------------------------------------------------
  const sessionAction = async (action: string, durationMinutes?: number) => {
    await apiPost('/api/session', { action, ...(durationMinutes ? { durationMinutes } : {}) });
    // State refreshes via poll; no optimistic update needed
  };

  const handleEndSession = () => void sessionAction('end');
  const handleReset = () => void sessionAction('reset');

  const sessionState: SessionState = appState.session.state;
  const canStart = sessionState === 'idle';
  const canPause = sessionState === 'active';
  const canResume = sessionState === 'paused';
  const canEndOrPause = sessionState === 'active' || sessionState === 'paused';

  // ---------------------------------------------------------------------------
  // Contract change
  // ---------------------------------------------------------------------------
  const handleContractChange = async (contract: InterruptionContract) => {
    await apiPost('/api/contract', contract);
  };

  // ---------------------------------------------------------------------------
  // AI toggle
  // ---------------------------------------------------------------------------
  const handleAiOfflineToggle = (_offline: boolean) => {
    // The EventSimulator already POSTs to /api/settings; state refreshes via poll
  };

  // ---------------------------------------------------------------------------
  // Event result (optimistic update from simulator)
  // ---------------------------------------------------------------------------
  const handleEventResult = (decision: PolicyDecision) => {
    setAppState((prev) => ({
      ...prev,
      decisions: [...prev.decisions, decision],
    }));
    // Auto-switch to inspector when a new event arrives
    setActiveTab('inspector');
  };

  // Auto-switch to digest when session ends
  useEffect(() => {
    if (appState.session.state === 'ended') {
      setActiveTab('digest');
    }
  }, [appState.session.state]);

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  const tabs: { id: Tab; label: string }[] = [
    { id: 'policy',    label: 'Policy' },
    { id: 'simulator', label: 'Simulator' },
    { id: 'inspector', label: `Inspector (${appState.decisions.length})` },
    { id: 'digest',    label: 'Digest' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel: Virtual Pager                                           */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-80 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
        <PagerDevice
          session={appState.session}
          decisions={appState.decisions}
          aiOffline={appState.aiOffline}
          muted={muted}
          onMuteToggle={() => setMuted((m) => !m)}
          onBacklightToggle={() => { /* state managed inside PagerDevice */ }}
          onEndSession={handleEndSession}
        />
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel: Dispatch Console                                       */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Console header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <span className="font-bold text-gray-100 tracking-wide mr-2">Dispatch Console</span>

          {/* Session controls */}
          {canStart && (
            <button
              onClick={() => void sessionAction('start', 25)}
              className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1 rounded transition"
            >
              ▶ Start Session
            </button>
          )}
          {canPause && (
            <button
              onClick={() => void sessionAction('pause')}
              className="bg-yellow-700 hover:bg-yellow-600 text-white text-sm px-3 py-1 rounded transition"
            >
              ⏸ Pause
            </button>
          )}
          {canResume && (
            <button
              onClick={() => void sessionAction('resume')}
              className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1 rounded transition"
            >
              ▶ Resume
            </button>
          )}
          {canEndOrPause && (
            <button
              onClick={handleEndSession}
              className="bg-red-800 hover:bg-red-700 text-white text-sm px-3 py-1 rounded transition"
            >
              ⏹ End Session
            </button>
          )}

          <button
            onClick={handleReset}
            className="ml-auto bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-3 py-1 rounded transition"
          >
            ↺ Reset
          </button>
        </header>

        {/* Tab bar */}
        <nav className="bg-gray-900 border-b border-gray-800 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'policy' && (
            <PolicyEditor
              contract={appState.contract}
              sessionState={appState.session.state}
              onContractChange={(c) => void handleContractChange(c)}
            />
          )}
          {activeTab === 'simulator' && (
            <EventSimulator
              aiOffline={appState.aiOffline}
              onAiOfflineToggle={handleAiOfflineToggle}
              onEventResult={handleEventResult}
            />
          )}
          {activeTab === 'inspector' && (
            <DecisionInspector decisions={appState.decisions} />
          )}
          {activeTab === 'digest' && (
            <SessionDigest
              decisions={appState.decisions}
              session={appState.session}
            />
          )}
        </div>
      </main>
    </div>
  );
}
