import { useEffect, useRef, useState } from 'react';
import type { FocusSession, PolicyDecision } from '../core/types';
import { playBeep } from '../audio/piezoSynth';

interface PagerDeviceProps {
  session: FocusSession;
  decisions: PolicyDecision[];
  aiOffline: boolean;
  muted: boolean;
  onMuteToggle: () => void;
  onBacklightToggle: () => void;
  onEndSession: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PagerDevice({
  session,
  decisions,
  aiOffline,
  muted,
  onMuteToggle,
  onBacklightToggle,
  onEndSession,
}: PagerDeviceProps) {
  const interrupts = decisions.filter((d) => d.decision === 'interrupt');
  const [pageIndex, setPageIndex] = useState(0);
  const prevInterruptCount = useRef(0);
  const [backlightOn, setBacklightOn] = useState(true);

  // Jump to latest interrupt and beep when a new one arrives
  useEffect(() => {
    if (interrupts.length > prevInterruptCount.current) {
      setPageIndex(interrupts.length - 1);
      if (!muted) playBeep();
    }
    prevInterruptCount.current = interrupts.length;
  }, [interrupts.length, muted]);

  const handleBacklight = () => {
    setBacklightOn((v) => !v);
    onBacklightToggle();
  };

  const latestDecision = decisions[decisions.length - 1];
  const currentPage = interrupts[pageIndex];

  // LCD content
  let lcdText = '';
  if (session.state === 'idle') lcdText = 'BEEPBACK READY';
  else if (session.state === 'paused') lcdText = '-- PAUSED --';
  else if (session.state === 'ended') lcdText = 'SESSION ENDED';
  else if (currentPage?.pageText) lcdText = currentPage.pageText;
  else lcdText = 'FOCUS MODE ACTIVE';

  // Status badge
  let badge = '';
  let badgeColor = '';
  if (latestDecision) {
    if (latestDecision.decision === 'interrupt') {
      badge = 'PAGED';
      badgeColor = 'text-green-400';
    } else if (latestDecision.decision === 'hold') {
      badge = 'HELD';
      badgeColor = 'text-yellow-400';
    } else {
      badge = 'DISCARDED';
      badgeColor = 'text-gray-400';
    }
  }

  const lcdBg = backlightOn ? 'bg-green-900' : 'bg-gray-900';
  const lcdText_ = backlightOn ? 'text-green-300' : 'text-green-900';

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 select-none">
      {/* Pager chassis */}
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-5 w-72 border-2 border-gray-600">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
            BeepBack
          </span>
          {aiOffline && (
            <span className="text-xs bg-orange-700 text-orange-200 px-2 py-0.5 rounded font-mono">
              AI OFFLINE
            </span>
          )}
        </div>

        {/* LCD screen */}
        <div
          className={`${lcdBg} rounded-lg p-4 mb-4 min-h-[80px] border border-gray-600 relative`}
        >
          {/* Status badge */}
          {badge && (
            <span className={`absolute top-1 right-2 text-xs font-mono font-bold ${badgeColor}`}>
              {badge}
            </span>
          )}

          {/* Page text */}
          <p
            className={`${lcdText_} font-mono text-sm leading-snug break-words`}
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {lcdText}
          </p>

          {/* Timer */}
          {(session.state === 'active' || session.state === 'paused') && (
            <p className={`${lcdText_} font-mono text-xs mt-2 opacity-70`}>
              {formatTime(session.remainingSeconds)}
            </p>
          )}
        </div>

        {/* Scroll buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex <= 0}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs py-1.5 rounded font-mono transition"
          >
            ◀ PREV
          </button>
          <span className="text-gray-500 text-xs self-center font-mono">
            {interrupts.length > 0 ? `${pageIndex + 1}/${interrupts.length}` : '0/0'}
          </span>
          <button
            onClick={() => setPageIndex((i) => Math.min(interrupts.length - 1, i + 1))}
            disabled={pageIndex >= interrupts.length - 1}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-xs py-1.5 rounded font-mono transition"
          >
            NEXT ▶
          </button>
        </div>

        {/* Control buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={onMuteToggle}
            className={`flex-1 text-xs py-1.5 rounded font-mono transition ${
              muted
                ? 'bg-red-800 text-red-200 hover:bg-red-700'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {muted ? '🔇 MUTED' : '🔔 SOUND'}
          </button>
          <button
            onClick={handleBacklight}
            className={`flex-1 text-xs py-1.5 rounded font-mono transition ${
              backlightOn
                ? 'bg-green-800 text-green-200 hover:bg-green-700'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {backlightOn ? '💡 LIT' : '🌑 DIM'}
          </button>
        </div>

        <button
          onClick={onEndSession}
          disabled={session.state === 'idle' || session.state === 'ended'}
          className="w-full bg-red-900 hover:bg-red-800 disabled:opacity-30 text-red-200 text-xs py-1.5 rounded font-mono transition"
        >
          END SESSION
        </button>
      </div>
    </div>
  );
}
