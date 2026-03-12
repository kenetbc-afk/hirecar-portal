import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';
import ConfidentialBar from '../components/ConfidentialBar';

const DEFAULT_STRATEGY = {
  summary: 'Your credit repair strategy focuses on identifying and disputing inaccurate, unverified, and fraudulent items across all three credit bureaus. The goal is to restore your credit profile to accurate standing while documenting violations for potential legal action.',
  keyObjective: 'Remove all inaccurate and unverifiable items from credit reports. Document FCRA/FDCPA violations for statutory damages recovery. Achieve target credit score improvement within 6-12 months.',
  timeline: [
    { label: 'Disputes Filed', value: '' },
    { label: 'Response Deadline', value: '30–45 days from filing' },
    { label: 'Escalation', value: 'If violations confirmed' },
    { label: 'Hearing / Action', value: 'TBD' },
  ],
  causeByyCause: [
    { num: 1, name: 'FCRA §611 — Failure to Investigate', argument: 'Bureau may claim investigation was adequate', strategy: 'Show bureau failed 30-day investigation timeline. Document re-insertion without notice. Cite §611 violations.', strength: 'STRONG' },
    { num: 2, name: 'FCRA §623 — Furnisher Violations', argument: 'Furnisher claims data was accurate', strategy: 'Show failure to validate within 5 days. Document continued reporting despite dispute. Cite §1692g and §1692d violations.', strength: 'STRONG' },
    { num: 3, name: 'FDCPA Violations', argument: 'Collector claims debt was valid', strategy: 'Show failure to validate debt. Document harassment patterns. Cite specific FDCPA section violations.', strength: 'MODERATE' },
    { num: 4, name: 'State Consumer Protection', argument: 'May claim practices were standard', strategy: 'Document pattern of deceptive practices. Show willful disregard for consumer rights under state UDAP laws.', strength: 'STRONG' },
    { num: 5, name: 'Breach of Contract', argument: 'May claim terms were met', strategy: 'Show creditor failed to honor agreed terms and conditions. Document specific contractual violations.', strength: 'MODERATE' },
    { num: 6, name: 'Negligence / Defamation', argument: 'May claim qualified privilege', strategy: 'Show continued publication of known false credit information after dispute. Overcome privilege with malice showing.', strength: 'MODERATE' },
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
    { id: 's9', text: 'File regulatory complaints (CFPB, FTC, state AG)' },
    { id: 's10', text: 'Calendar all deadlines: response periods, statute of limitations' },
  ],
  contingency: {
    success: {
      title: 'If Disputes Successful',
      color: 'success',
      items: [
        'Items removed/corrected from all three bureaus',
        'Document all removals for damages calculation',
        'Pursue statutory damages for FCRA violations',
        'File demand letters to furnishers',
        'Negotiate from position of documented violations',
      ],
    },
    partial: {
      title: 'If Partial Success',
      color: 'gold',
      items: [
        'Escalate unresolved disputes to CFPB',
        'File Method of Verification (MOV) requests',
        'Send Intent to Sue letters',
        'Pursue individual furnisher lawsuits',
        'Continue monitoring for re-insertions',
      ],
    },
    denied: {
      title: 'If Disputes Denied',
      color: 'error',
      items: [
        'Request investigation details under FCRA',
        'File CFPB and state AG complaints',
        'Escalate to formal legal action',
        'Evaluate small claims court options',
        'Pursue federal court FCRA lawsuit',
      ],
    },
  },
  damages: [
    { category: 'Actual Damages', amount: 'Varies', basis: 'Documented financial harm (denied credit, lost opportunities)' },
    { category: 'Statutory Damages (FCRA)', amount: '$100 – $1,000/violation', basis: 'Per willful FCRA violation per consumer' },
    { category: 'Statutory Damages (FDCPA)', amount: 'Up to $1,000', basis: 'Per individual action under FDCPA' },
    { category: 'Punitive Damages', amount: 'Court discretion', basis: 'Willful noncompliance, pattern of violations' },
    { category: 'Attorney Fees & Costs', amount: 'Recoverable', basis: 'Successful FCRA/FDCPA actions allow fee shifting' },
  ],
};

export default function Strategy() {
  const { user } = useAuth();
  const [strategyData, setStrategyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        if (dash.strategy) setStrategyData(dash.strategy);
      } catch {
        // defaults
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const strategy = strategyData || DEFAULT_STRATEGY;

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

  const contingency = strategy.contingency || DEFAULT_STRATEGY.contingency;
  const colorMap = { success: 'var(--success)', gold: 'var(--gold)', error: 'var(--error)' };

  return (
    <div>
      <ConfidentialBar label="ATTORNEY-CLIENT WORK PRODUCT — PRIVILEGED & CONFIDENTIAL" />

      <h2 className="text-2xl font-display font-semibold mb-5">Strategy &amp; Action Plan</h2>
      <p className="text-muted text-sm mb-6">
        Prepared by SeedXchange, LLC &mdash; Document Research &amp; Preparation Division
      </p>

      {/* Executive Summary */}
      <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
        <h3 className="font-semibold text-lg font-sans mb-3">Executive Summary</h3>
        <p className="text-sm leading-relaxed mb-3">{strategy.summary}</p>
        <p className="text-sm leading-relaxed">
          <strong>Key Objective:</strong> {strategy.keyObjective}
        </p>
      </div>

      {/* Response Timeline */}
      {strategy.timeline?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg font-sans mb-3">Response Timeline &amp; Deadlines</h3>
          <div className="case-overview">
            {strategy.timeline.map((t, i) => (
              <div key={i} className="case-row">
                <span className="case-label">{t.label}</span>
                <span className={`case-val ${t.highlight ? 'font-bold text-hc-red' : ''}`}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cause-by-Cause Strategy Table */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Cause-by-Cause Defense Strategy</h3>
        <p className="text-sm text-muted mb-4">For each cause of action, the opposition strategy addresses likely defenses.</p>
        <div className="overflow-x-auto">
          <table className="coa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cause of Action</th>
                <th>Likely Defense Argument</th>
                <th>Opposition Strategy</th>
                <th>Strength</th>
              </tr>
            </thead>
            <tbody>
              {strategy.causeByyCause.map((c) => (
                <tr key={c.num}>
                  <td>{c.num}</td>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-sm text-muted">{c.argument}</td>
                  <td className="text-sm">{c.strategy}</td>
                  <td>
                    <span className={`risk-bar ${
                      c.strength === 'STRONG' ? 'risk-strong' : c.strength === 'MODERATE' ? 'risk-moderate' : 'risk-weak'
                    }`}>
                      {c.strength}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Evidence to Compile */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Key Evidence to Compile</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl" style={{ background: 'rgba(184,146,42,.04)', border: '1px solid rgba(184,146,42,.2)' }}>
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--gold)' }}>Documents Needed</h4>
            <ul className="text-sm space-y-1.5 pl-4 list-disc">
              {strategy.documentsNeeded.map((doc, i) => <li key={i}>{doc}</li>)}
            </ul>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'rgba(26,107,60,.04)', border: '1px solid rgba(26,107,60,.2)' }}>
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--success)' }}>Legal Authority to Cite</h4>
            <ul className="text-sm space-y-1.5 pl-4 list-disc">
              {strategy.legalAuthority.map((auth, i) => <li key={i}>{auth}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Action Items Checklist */}
      <div className="card" style={{ border: '1px solid var(--gold)', borderLeft: '4px solid var(--gold)' }}>
        <h3 className="font-semibold text-lg font-sans mb-3">Action Items Checklist</h3>
        <div className="space-y-1">
          {strategy.actionItems.map((item) => (
            <label key={item.id} className="strategy-check">
              <input type="checkbox" checked={checkedItems[item.id] || false} onChange={() => toggleCheck(item.id)} />
              <span className={checkedItems[item.id] ? 'line-through text-muted' : ''}>{item.text}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Contingency Strategy — 3-column cards */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Contingency &amp; Settlement Strategy</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {['success', 'partial', 'denied'].map((key) => {
            const c = contingency[key];
            if (!c) return null;
            return (
              <div key={key} className="p-4 rounded-xl" style={{
                background: `color-mix(in srgb, ${colorMap[c.color] || 'var(--gold)'} 4%, transparent)`,
                border: `1px solid color-mix(in srgb, ${colorMap[c.color] || 'var(--gold)'} 20%, transparent)`,
              }}>
                <h4 className="font-sans font-semibold text-sm mb-2" style={{ color: colorMap[c.color] }}>{c.title}</h4>
                <ul className="text-xs space-y-1.5 pl-4 list-disc text-muted">
                  {c.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Damages Breakdown */}
      {strategy.damages?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg font-sans mb-3">Damages Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="coa-table">
              <thead>
                <tr><th>Category</th><th>Amount</th><th>Basis</th></tr>
              </thead>
              <tbody>
                {strategy.damages.map((d, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{d.category}</td>
                    <td className="font-bold text-gold">{d.amount}</td>
                    <td className="text-sm text-muted">{d.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
