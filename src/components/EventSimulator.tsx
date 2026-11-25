import { useState } from 'react';
import type { PolicyDecision, EventType } from '../core/types';

interface EventSimulatorProps {
  aiOffline: boolean;
  onAiOfflineToggle: (offline: boolean) => void;
  onEventResult: (decision: PolicyDecision) => void;
}

interface PresetPayload {
  sender: string;
  source: string;
  type: EventType;
  body: string;
  minutesUntilStart?: number;
}

const PRESETS: { label: string; payload: PresetPayload }[] = [
  {
    label: '👑 VIP Message',
    payload: {
      sender: 'alice@example.com',
      source: 'email',
      type: 'message',
      body: 'Hey, are you available for a quick call?',
    },
  },
  {
    label: '📧 Non-VIP Message',
    payload: {
      sender: 'newsletter@promo.example',
      source: 'email',
      type: 'message',
      body: 'You have been selected for an exclusive offer!',
    },
  },
  {
    label: '🚨 Approved Incident',
    payload: {
      sender: 'pagerduty-bot',
      source: 'pagerduty',
      type: 'incident',
      body: 'P1: API latency spike detected — p99 > 5 s',
    },
  },
  {
    label: '⚠️ Unapproved Incident',
    payload: {
      sender: 'unknown-monitor',
      source: 'unknown-source',
      type: 'incident',
      body: 'CPU usage at 92% on web-01',
    },
  },
  {
    label: '📅 Calendar (in window)',
    payload: {
      sender: 'calendar-service',
      source: 'gcal',
      type: 'calendar',
      body: 'Team standup starting soon',
      minutesUntilStart: 5,
    },
  },
];

interface CustomForm {
  sender: string;
  source: string;
  type: EventType;
  body: string;
  minutesUntilStart: string;
}

const defaultForm: CustomForm = {
  sender: '',
  source: '',
  type: 'message',
  body: '',
  minutesUntilStart: '',
};

export default function EventSimulator({
  aiOffline,
  onAiOfflineToggle,
  onEventResult,
}: EventSimulatorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomForm>(defaultForm);

  const postEvent = async (payload: PresetPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const decision = (await res.json()) as PolicyDecision;
      onEventResult(decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAiToggle = async (offline: boolean) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiOffline: offline }),
      });
      onAiOfflineToggle(offline);
    } catch {
      // Ignore toggle errors — state stays consistent via poll
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PresetPayload = {
      sender: form.sender,
      source: form.source,
      type: form.type,
      body: form.body,
      ...(form.minutesUntilStart !== ''
        ? { minutesUntilStart: Number(form.minutesUntilStart) }
        : {}),
    };
    void postEvent(payload);
    setForm(defaultForm);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-3">Event Simulator</h2>

      {/* AI Offline toggle */}
      <div className="flex items-center justify-between mb-4 bg-gray-800 rounded p-3 border border-gray-700">
        <div>
          <span className="text-sm font-semibold text-gray-200">AI Summarizer</span>
          <p className="text-xs text-gray-500 mt-0.5">
            {aiOffline ? 'Using deterministic fallback formatter' : 'LLM compression enabled'}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={aiOffline}
            onChange={(e) => void handleAiToggle(e.target.checked)}
          />
          <div
            className={`w-11 h-6 rounded-full transition-colors ${
              aiOffline ? 'bg-orange-600' : 'bg-indigo-600'
            }`}
          />
          <div
            className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              aiOffline ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </label>
      </div>

      {/* Preset buttons */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Quick Presets
        </p>
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => void postEvent(preset.payload)}
              disabled={loading}
              className="text-left bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-sm px-3 py-2 rounded border border-gray-700 transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom event form */}
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Custom Event
        </p>
        <form onSubmit={handleCustomSubmit} className="space-y-2">
          <input
            required
            placeholder="Sender"
            value={form.sender}
            onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 outline-none placeholder-gray-500"
          />
          <input
            required
            placeholder="Source"
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 outline-none placeholder-gray-500"
          />
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventType }))}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 outline-none"
          >
            <option value="message">message</option>
            <option value="incident">incident</option>
            <option value="calendar">calendar</option>
          </select>
          <textarea
            required
            placeholder="Body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 outline-none placeholder-gray-500 resize-none"
          />
          {form.type === 'calendar' && (
            <input
              type="number"
              placeholder="Minutes until start"
              value={form.minutesUntilStart}
              onChange={(e) =>
                setForm((f) => ({ ...f, minutesUntilStart: e.target.value }))
              }
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 outline-none placeholder-gray-500"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm py-2 rounded transition font-semibold"
          >
            {loading ? 'Sending…' : 'Send Event'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-2 bg-red-900 border border-red-700 text-red-200 text-xs px-3 py-2 rounded">
          Error: {error}
        </div>
      )}
    </div>
  );
}
