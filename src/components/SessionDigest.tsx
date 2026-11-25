import type { PolicyDecision, FocusSession } from '../core/types';

interface SessionDigestProps {
  decisions: PolicyDecision[];
  session: FocusSession;
}

export default function SessionDigest({ decisions, session }: SessionDigestProps) {
  if (session.state !== 'ended') {
    return null;
  }

  const held = decisions.filter((d) => d.decision === 'hold');

  // Group by eventId — we need sender from the decision, but PolicyDecision doesn't
  // carry sender directly. The matchedRuleId is "default-hold". We'll group by
  // the explanation text prefix as a proxy. However, the design says "group by sender"
  // which requires sender on the decision. We store pageText only for interrupts.
  //
  // Since the design spec doesn't add sender to PolicyDecision, we parse sender
  // from the explanation field's pattern or fall back to grouping by matchedRuleId.
  //
  // Better approach: App.tsx passes full decisions enriched with event data.
  // For now we group held events under a single "Held Messages" group since
  // PolicyDecision intentionally omits sender (it's in IncomingEvent on the server).
  // The server GET /api/state could be extended, but per the current type spec
  // we work with what we have and show individual entries.

  if (held.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-100 mb-2">Session Digest</h2>
        <p className="text-gray-500 text-sm">No held messages this session.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-1">Session Digest</h2>
      <p className="text-sm text-gray-400 mb-3">
        {held.length} message{held.length !== 1 ? 's' : ''} held during your focus session.
      </p>

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {held.map((d) => (
          <div
            key={d.eventId}
            className="bg-gray-800 rounded border border-yellow-800 p-3 text-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-mono">
                {new Date(d.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded font-bold">
                HELD
              </span>
            </div>
            <p className="text-gray-300 text-xs leading-snug break-words">
              {d.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
