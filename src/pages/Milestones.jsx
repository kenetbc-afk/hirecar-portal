import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';

const DEFAULT_STRATEGY = {
  summary: 'Your credit repair strategy focuses on identifying and disputing inaccurate, unverified, and fraudulent items across all three credit bureaus. The goal is to restore your credit profile to accurate standing while documenting violations for potential legal action.',
  keyObjective: 'Remove all inaccurate and unverifiable items from credit reports. Document FCRA/FDCPA violations for statutory damages recovery. Achieve target credit score improvement within 6-12 months.',
  causeByyCause: [
    { num: 1, name: 'FCRA Violation', argument: 'Bureau may claim investigation was adequate', strategy: 'Show bureau failed 30-day investigation timeline. Document re-insertion without notice. Cite §611 violations.', strength: 'STRONG' },
    { num: 2, name: 'FDCPA Violation', argument: 'Collector may claim debt was valid', strategy: 'Show failure to validate within 5 days. Document harassment patterns. Cite §1692g and §1692d violations.', strength: 'STRONG' },
    { num: 3, name: 'FCBA Violation', argument: 'Creditor may claim timely response', strategy: 'Show billing dispute was not acknowledged within 30 days per §1666. Document continued collection during dispute.', strength: 'MODERATE' },
    { num: 4, name: 'State UDAP', argument: 'May claim practices were standard', strategy: 'Document pattern of deceptive practices. Show willful disregard for consumer rights under state consumer protection laws.', strength: 'STRONG' },
    { num: 5, name: 'Negligence', argument: 'May claim reasonable procedures existed', strategy: 'Show systemic failures in accuracy procedures. Document repeated errors despite notification.', strength: 'MODERATE' },
    { num: 6, name: 'Defamation', argument: 'May claim qualified privilege', strategy: 'Show continued publication of known false information after dispute. Overcome privilege with malice showing.', strength: 'MODERATE' },
  ],
  documentsNeeded: [
    'All three credit reports (Equifax, Experian, TransUnion)',
    'Dispute correspondence and confirmation numbers',
    'Adverse action notices (denial letters)',
    'Debt validation requests and responses',
    'Collection call logs with dates and details',
    'Identity theft report (if applicable)',
    'Financial impact documentation',
    'Employment/housing denial records',
    'Medical records showing emotional distress',
  ],
  legalAuthority: [
    'FCRA §611 — Investigation procedures',
    'FCRA §605B — Identity theft blocking',
    'FDCPA §1692g — Debt validation',
    'FDCPA §1692d — Harassment prohibition',
    'FCBA §1666 — Billing dispute procedures',
    'State consumer protection statutes',
    'Relevant case law for your jurisdiction',
  ],
  actionItems: [
    { id: 's1', text: 'Pull and review all three credit reports for inaccuracies' },
    { id: 's2', text: 'File formal disputes with each bureau for identified errors' },
    { id: 's3', text: 'Send debt validation letters to all collectors' },
    { id: 's4', text: 'Document all FCRA timeline violations (30-day rule)' },
    { id: 's5', text: 'Compile evidence packet for each disputed item' },
    { id: 's6', text: 'Research applicable case law for your jurisdiction' },
    { id: 's7', text: 'Prepare demand letters citing specific statutory violations' },
    { id: 's8', text: 'Calculate actual and statutory damages for each violation' },
  ],
};

export default function Milestones() {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState([]);
  const [actionPlan, setActionPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});
  const [view, setView] = useState('strategy');

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        setMilestones(dash.milestones || []);
        setActionPlan(dash.actionPlan || null);
      } catch (err) {
        console.error('Failed to load milestones:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const completed = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const strategy = DEFAULT_STRATEGY;

  function toggleCheck(id) {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="sec-header">
        <div className="accent-bar" />
        <h2 className="text-2xl">Milestones & Strategy</h2>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('strategy')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            view === 'strategy' ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-rule hover:border-gold'
          }`}
        >
          Strategy & Action Plan
        </button>
        <button
          onClick={() => setView('milestones')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            view === 'milestones' ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-rule hover:border-gold'
          }`}
        >
          Milestones ({total})
        </button>
      </div>

      {view === 'strategy' && (
        <div className="animate-fadeUp space-y-6">
          {/* Executive Summary */}
          <div className="card">
            <div className="sec-header !mb-4 !pb-2">
              <div className="accent-bar" />
              <h2 className="text-lg">Executive Summary</h2>
            </div>
            <p className="text-sm text-muted leading-relaxed">{strategy.summary}</p>
            <div className="ev-note info mt-4">
              <strong>Key Objective:</strong> {strategy.keyObjective}
            </div>
          </div>

          {/* Cause-by-Cause Strategy Table */}
          <div className="card">
            <div className="sec-header !mb-4 !pb-2">
              <div className="accent-bar" />
              <h2 className="text-lg">Cause-by-Cause Strategy</h2>
            </div>
            <p className="text-sm text-muted mb-3">For each cause of action, the opposition strategy addresses likely defenses.</p>
            <div className="overflow-x-auto">
              <table className="coa-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cause of Action</th>
                    <th className="hidden md:table-cell">Likely Defense</th>
                    <th className="hidden sm:table-cell">Our Strategy</th>
                    <th>Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.causeByyCause.map((c) => (
                    <tr key={c.num}>
                      <td className="font-bold text-gold">{c.num}</td>
                      <td className="font-semibold">{c.name}</td>
                      <td className="text-sm text-muted hidden md:table-cell">{c.argument}</td>
                      <td className="text-sm hidden sm:table-cell">{c.strategy}</td>
                      <td>
                        <span className={`risk-bar ${c.strength === 'STRONG' ? 'risk-strong' : c.strength === 'MODERATE' ? 'risk-moderate' : 'risk-weak'}`}>
                          {c.strength}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Evidence Compilation */}
          <div className="card">
            <div className="sec-header !mb-4 !pb-2">
              <div className="accent-bar" />
              <h2 className="text-lg">Key Evidence Compilation</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-sm text-ink mb-3">Documents Needed</h4>
                <div className="space-y-1">
                  {strategy.documentsNeeded.map((doc, i) => (
                    <label key={i} className="strategy-check">
                      <input type="checkbox" checked={checkedItems[`doc-${i}`] || false} onChange={() => toggleCheck(`doc-${i}`)} />
                      <span className={checkedItems[`doc-${i}`] ? 'line-through text-muted' : ''}>{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-ink mb-3">Legal Authority to Cite</h4>
                <div className="space-y-1">
                  {strategy.legalAuthority.map((auth, i) => (
                    <label key={i} className="strategy-check">
                      <input type="checkbox" checked={checkedItems[`law-${i}`] || false} onChange={() => toggleCheck(`law-${i}`)} />
                      <span className={checkedItems[`law-${i}`] ? 'line-through text-muted' : ''}>{auth}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Items Checklist */}
          <div className="card">
            <div className="sec-header !mb-4 !pb-2">
              <div className="accent-bar" />
              <h2 className="text-lg">Action Items Checklist</h2>
            </div>
            <div className="space-y-1">
              {strategy.actionItems.map((item) => (
                <label key={item.id} className="strategy-check">
                  <input type="checkbox" checked={checkedItems[item.id] || false} onChange={() => toggleCheck(item.id)} />
                  <span className={checkedItems[item.id] ? 'line-through text-muted' : ''}>{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'milestones' && (
        <div className="animate-fadeUp">
          {/* Progress */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{completed} of {total} completed</span>
              <span className="text-sm text-gold font-bold">{pct}%</span>
            </div>
            <div className="w-full h-3 bg-cream rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-hc-success rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Timeline */}
          {milestones.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted">No milestones set up yet.</p>
            </div>
          ) : (
            <div className="timeline">
              {milestones.map((m, i) => {
                const isActive = !m.done && (i === 0 || milestones[i - 1]?.done);
                return (
                  <div key={m.id} className={`tl-item ${m.done ? 'done' : isActive ? 'active' : 'pending'}`}>
                    <div className="tl-date font-semibold text-ink">
                      {m.label || m.name}
                    </div>
                    <div className="tl-desc text-muted text-sm">
                      {m.description || ''}
                      {m.date && (
                        <span className="ml-2 text-xs text-muted/60">
                          ({new Date(m.date).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Plan */}
          {actionPlan && (
            <div className="card mt-8">
              <div className="sec-header !mb-4 !pb-2">
                <div className="accent-bar" />
                <h2 className="text-lg">Action Plan</h2>
              </div>
              {typeof actionPlan === 'string' ? (
                <p className="text-sm text-muted whitespace-pre-wrap">{actionPlan}</p>
              ) : (
                <div className="space-y-3">
                  {(actionPlan.steps || actionPlan.items || []).map((step, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full bg-gold/10 text-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm">{typeof step === 'string' ? step : step.text || step.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
