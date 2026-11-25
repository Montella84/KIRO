import { useState, KeyboardEvent } from 'react';
import type { InterruptionContract, SessionState } from '../core/types';

interface PolicyEditorProps {
  contract: InterruptionContract;
  sessionState: SessionState;
  onContractChange: (contract: InterruptionContract) => void;
}

interface TagInputProps {
  label: string;
  tags: string[];
  disabled: boolean;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}

function TagInput({ label, tags, disabled, onAdd, onRemove, placeholder }: TagInputProps) {
  const [input, setInput] = useState('');

  const commit = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) {
      onAdd(v);
    }
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-300 mb-1">{label}</label>
      <div
        className={`flex flex-wrap gap-1 p-2 rounded bg-gray-800 border ${
          disabled ? 'border-gray-700 opacity-60' : 'border-gray-600'
        } min-h-[40px]`}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="flex items-center bg-indigo-700 text-indigo-100 text-xs px-2 py-0.5 rounded"
          >
            {tag}
            {!disabled && (
              <button
                onClick={() => onRemove(i)}
                className="ml-1 text-indigo-300 hover:text-white leading-none"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            className="flex-1 min-w-[120px] bg-transparent text-gray-100 text-xs outline-none placeholder-gray-500"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onBlur={commit}
          />
        )}
      </div>
    </div>
  );
}

export default function PolicyEditor({
  contract,
  sessionState,
  onContractChange,
}: PolicyEditorProps) {
  const isLocked = sessionState === 'active' || sessionState === 'paused';

  const updateVip = (senders: string[]) =>
    onContractChange({ ...contract, vipSenders: senders });

  const updateSources = (sources: string[]) =>
    onContractChange({ ...contract, incidentSources: sources });

  const updateWindow = (minutes: number) =>
    onContractChange({ ...contract, calendarWindowMinutes: minutes });

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-100 mb-1">Interruption Contract</h2>

      {isLocked && (
        <div className="mb-3 bg-yellow-900 border border-yellow-700 text-yellow-200 text-xs px-3 py-2 rounded">
          🔒 Session in progress — contract is read-only. End the session to edit rules.
        </div>
      )}

      {/* Rule summary */}
      <div className="mb-4 bg-gray-800 rounded p-2 text-xs text-gray-400 border border-gray-700">
        <span className="font-semibold text-gray-200">Active rules: </span>
        {contract.vipSenders.length} VIP sender{contract.vipSenders.length !== 1 ? 's' : ''},{' '}
        {contract.incidentSources.length} incident source
        {contract.incidentSources.length !== 1 ? 's' : ''},{' '}
        calendar window {contract.calendarWindowMinutes} min
      </div>

      <TagInput
        label="VIP Senders"
        tags={contract.vipSenders}
        disabled={isLocked}
        placeholder="Type a sender name and press Enter"
        onAdd={(v) => updateVip([...contract.vipSenders, v])}
        onRemove={(i) =>
          updateVip(contract.vipSenders.filter((_, idx) => idx !== i))
        }
      />

      <TagInput
        label="Incident Sources"
        tags={contract.incidentSources}
        disabled={isLocked}
        placeholder="Type a source name and press Enter"
        onAdd={(v) => updateSources([...contract.incidentSources, v])}
        onRemove={(i) =>
          updateSources(contract.incidentSources.filter((_, idx) => idx !== i))
        }
      />

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          Calendar Lead-Time Window (minutes)
        </label>
        <input
          type="number"
          min={0}
          max={60}
          disabled={isLocked}
          value={contract.calendarWindowMinutes}
          onChange={(e) => updateWindow(Number(e.target.value))}
          className={`w-24 bg-gray-800 border ${
            isLocked ? 'border-gray-700 opacity-60' : 'border-gray-600'
          } text-gray-100 text-sm rounded px-2 py-1 outline-none`}
        />
        <span className="ml-2 text-xs text-gray-500">0 = disabled, max 60</span>
      </div>
    </div>
  );
}
