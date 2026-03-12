import { useState } from 'react';

const GOAL_OPTIONS = [
  'Full Refund',
  'Settlement',
  'Maximum Recovery',
  'Credit Repair',
  'Debt Resolution',
];

const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];

const SETTLEMENT_RANGES = [
  'Under $1,000',
  '$1,000 - $5,000',
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000+',
];

export default function GoalsTemperature({ data, onUpdate }) {
  const [goals, setGoals] = useState(data?.goals || []);
  const [temperature, setTemperature] = useState(data?.temperature || 50);
  const [priority, setPriority] = useState(data?.priority || 'Medium');
  const [settlementRange, setSettlementRange] = useState(data?.settlementRange || '');
  const [notes, setNotes] = useState(data?.notes || '');

  function toggleGoal(goal) {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  const tempColor =
    temperature <= 30 ? 'text-hc-blue' :
    temperature <= 60 ? 'text-gold' :
    temperature <= 80 ? 'text-orange-500' :
    'text-hc-red';

  const tempLabel =
    temperature <= 20 ? 'Cold' :
    temperature <= 40 ? 'Cool' :
    temperature <= 60 ? 'Warm' :
    temperature <= 80 ? 'Hot' :
    'Critical';

  return (
    <div className="card mb-6">
      <div className="sec-header !mb-4 !pb-2">
        <div className="accent-bar" />
        <h2 className="text-lg">Goals & Temperature Check</h2>
      </div>

      {/* Goal Chips */}
      <div className="mb-5">
        <p className="text-xs font-mono text-muted/60 uppercase tracking-wider mb-2">Primary Goals</p>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((goal) => (
            <button
              key={goal}
              onClick={() => toggleGoal(goal)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                goals.includes(goal)
                  ? 'bg-gold text-white border-gold shadow-sm'
                  : 'bg-white text-ink border-rule hover:border-gold'
              }`}
            >
              {goals.includes(goal) && '✓ '}{goal}
            </button>
          ))}
        </div>
      </div>

      {/* Settlement Range */}
      <div className="mb-5">
        <p className="text-xs font-mono text-muted/60 uppercase tracking-wider mb-2">Settlement Range</p>
        <select
          value={settlementRange}
          onChange={(e) => setSettlementRange(e.target.value)}
          className="input !py-2 !text-sm"
        >
          <option value="">Select range...</option>
          {SETTLEMENT_RANGES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Temperature Slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-muted/60 uppercase tracking-wider">Case Temperature</p>
          <span className={`text-sm font-bold ${tempColor}`}>{temperature}% &mdash; {tempLabel}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="w-full h-2 bg-cream rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:shadow-md
                     [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted/40 mt-1">
          <span>Cold</span>
          <span>Cool</span>
          <span>Warm</span>
          <span>Hot</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Priority Chips */}
      <div className="mb-5">
        <p className="text-xs font-mono text-muted/60 uppercase tracking-wider mb-2">Priority Level</p>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                priority === p
                  ? p === 'Critical' ? 'bg-hc-red text-white border-hc-red'
                    : p === 'High' ? 'bg-gold text-white border-gold'
                    : p === 'Medium' ? 'bg-hc-blue text-white border-hc-blue'
                    : 'bg-muted text-white border-muted'
                  : 'bg-white text-ink border-rule hover:border-gold'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs font-mono text-muted/60 uppercase tracking-wider mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context or notes..."
          rows={3}
          className="input !py-2 !text-sm resize-none"
        />
      </div>
    </div>
  );
}
