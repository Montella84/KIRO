import type { PolicyDecision } from '../core/types';

interface DecisionInspectorProps {
  decisions: PolicyDecision[];
}

const BADGE: Record<string, { label: string; className: string }> = {
  interrupt: { label: 'PAGED',     className: 'bg-green-800 text-green-200' },
  hold:      { label: 'HELD',      className: 'bg-yellow-800 text-yellow-200' },
  discard:   { label: 'DISCARDED', className: 'bg-gray-700 text-gray-400' },
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

export default function DecisionInspector({ decisions }: DecisionInspectorProps) {
  if (decisions.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No events yet. Send an event using the Event Simulator.
      </div>
    );
  }

  const sorted = [...decisions].reverse();

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-3">
        Decision Inspector
        <span className="ml-2 text-sm font-normal text-gray-400">
          ({decisions.length} event{decisions.length !== 1 ? 's' : ''})
        </span>
      </h2>

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {sorted.map((d) => {
          const badge = BADGE[d.decision] ?? BADGE.discard;
          return (
            <div
              key={d.eventId}
              className="bg-gray-800 rounded border border-gray-700 p-3 text-xs font-mono"
            >
              {/* Row 1: time + badge */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">{formatTs(d.timestamp)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* Row 2: rule */}
              <div className="text-indigo-400 mb-1">rule: {d.matchedRuleId}</div>

              {/* Row 3: explanation */}
              <div className="text-gray-300 mb-1 leading-snug">{d.explanation}</div>

              {/* Row 4: page text if present */}
              {d.pageText && (
                <div className="text-green-400 mt-1 border-t border-gray-700 pt-1">
                  📟 {d.pageText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
