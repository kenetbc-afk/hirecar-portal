import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';

const STATUS_COLORS = {
  SENT: 'blue', IN_PROGRESS: 'gold', RESOLVED: 'green', CLOSED: 'muted',
  PENDING: 'gold', OPENED: 'blue', EXPOSED: 'red', CONFIRMED: 'green',
};

const EVIDENCE_SECTIONS = [
  {
    id: 'account-history',
    title: 'Section 1: Account History & Unauthorized Activity',
    questions: [
      { id: 'q1', text: 'Have you identified unauthorized accounts or inquiries on your credit report?',
        note: { type: 'warn', text: 'Unauthorized accounts are a direct FCRA violation. Each unverified item strengthens your dispute claim.' } },
      { id: 'q2', text: 'Were you notified of any new accounts opened without your consent?',
        note: { type: 'info', text: 'Under FCRA §611, bureaus must investigate within 30 days. Failure to notify is a compliance failure.' } },
      { id: 'q3', text: 'Have you disputed these items directly with the credit bureau?',
        note: { type: 'ok', text: 'Documented disputes create a paper trail essential for litigation. Keep all confirmation numbers.' } },
    ],
  },
  {
    id: 'creditor-conduct',
    title: 'Section 2: Creditor & Collector Conduct',
    questions: [
      { id: 'q4', text: 'Have creditors contacted you about debts you do not recognize?',
        note: { type: 'warn', text: 'FDCPA §1692g requires debt validation within 5 days. Failure to validate means the debt cannot be collected.' } },
      { id: 'q5', text: 'Have you received threatening, harassing, or abusive collection calls?',
        note: { type: 'warn', text: 'Harassment violates FDCPA §1692d. Document every call — date, time, caller name, and what was said.' } },
      { id: 'q6', text: 'Did any collector contact you at unreasonable hours or at your workplace?',
        note: { type: 'info', text: 'FDCPA restricts calls to 8am-9pm and prohibits workplace calls if employer disapproves.' } },
    ],
  },
  {
    id: 'credit-reporting',
    title: 'Section 3: Credit Reporting Accuracy',
    questions: [
      { id: 'q7', text: 'Have you found inaccurate balances, dates, or account statuses on your reports?',
        note: { type: 'warn', text: 'Every inaccuracy is a potential FCRA violation. Bureaus must report ONLY verified, accurate information.' } },
      { id: 'q8', text: 'Did a credit bureau fail to investigate your dispute within 30 days?',
        note: { type: 'warn', text: 'The 30-day investigation window is statutory under FCRA §611(a)(1). Non-compliance is per se bad faith.' } },
      { id: 'q9', text: 'Were any items re-inserted on your report after being removed?',
        note: { type: 'warn', text: 'Re-insertion without notice violates FCRA §611(a)(5)(B). Bureau must notify within 5 days of re-insertion.' } },
    ],
  },
  {
    id: 'identity-fraud',
    title: 'Section 4: Identity Theft & Fraud',
    questions: [
      { id: 'q10', text: 'Have you been a victim of identity theft?',
        note: { type: 'info', text: 'Identity theft victims have enhanced rights under FCRA §605B — fraudulent items must be blocked within 4 days.' } },
      { id: 'q11', text: 'Were fraudulent accounts opened in your name?',
        note: { type: 'warn', text: 'Fraudulent accounts that remain after dispute constitute willful non-compliance — statutory damages of $100-$1,000 per violation.' } },
      { id: 'q12', text: 'Did you file a police report or FTC Identity Theft Report?',
        note: { type: 'ok', text: 'Official reports create legal foundation for FCRA blocking rights and strengthen litigation position.' } },
    ],
  },
  {
    id: 'damages-impact',
    title: 'Section 5: Damages & Financial Impact',
    questions: [
      { id: 'q13', text: 'Were you denied credit, housing, or employment due to inaccurate reporting?',
        note: { type: 'warn', text: 'Denial letters are critical evidence of actual damages. Keep every adverse action notice received.' } },
      { id: 'q14', text: 'Did you lose employment or business opportunities due to credit issues?',
        note: { type: 'info', text: 'Employment damages are compensable under FCRA. Document the opportunity, the denial, and the credit pull.' } },
      { id: 'q15', text: 'Have you experienced emotional distress from these credit issues?',
        note: { type: 'info', text: 'Emotional distress is recoverable in FCRA cases. Document symptoms, medical visits, and impact on daily life.' } },
      { id: 'q16', text: 'Were you charged higher interest rates due to inaccurate reporting?',
        note: { type: 'warn', text: 'Rate differentials are measurable actual damages. Compare offered rate vs. rate you would qualify for with accurate reports.' } },
      { id: 'q17', text: 'Did you incur out-of-pocket costs addressing these credit issues?',
        note: { type: 'info', text: 'Legal fees, credit monitoring costs, postage, and time off work are all recoverable actual damages.' } },
      { id: 'q18', text: 'Did you have to pay additional deposits or security due to credit problems?',
        note: { type: 'warn', text: 'Additional deposits caused by inaccurate reporting are direct financial harm — keep all receipts and agreements.' } },
    ],
  },
];

const ANSWER_OPTIONS = ['Yes', 'No', 'Unsure', 'Confirmed'];

function getBadge(answer) {
  if (!answer) return null;
  if (answer === 'Confirmed' || answer === 'Yes')
    return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-hc-red/10 text-hc-red border border-hc-red/30 uppercase">Exposed</span>;
  if (answer === 'No')
    return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-hc-success/10 text-hc-success border border-hc-success/30 uppercase">Confirmed</span>;
  return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-gold/10 text-gold border border-gold/30 uppercase">Pending</span>;
}

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [answers, setAnswers] = useState({});
  const [expanded, setExpanded] = useState({});
  const [view, setView] = useState('evidence');

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        setDisputes(dash.disputes || []);
        setAnswers(dash.evidenceAnswers || {});
      } catch (err) {
        console.error('Failed to load disputes:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const filtered = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter);
  const statuses = ['all', ...new Set(disputes.map((d) => d.status))];

  const totalQ = EVIDENCE_SECTIONS.reduce((s, sec) => s + sec.questions.length, 0);
  const answeredQ = Object.keys(answers).filter((k) => answers[k]).length;
  const pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

  function toggleSection(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setAnswer(qId, value) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function getSectionStats(section) {
    const total = section.questions.length;
    const done = section.questions.filter((q) => answers[q.id]).length;
    return { total, done };
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
        <h2 className="text-2xl">Disputes & Evidence</h2>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('evidence')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            view === 'evidence' ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-rule hover:border-gold'
          }`}
        >
          Critical Evidence Assessment
        </button>
        <button
          onClick={() => setView('disputes')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            view === 'disputes' ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-rule hover:border-gold'
          }`}
        >
          Active Disputes ({disputes.length})
        </button>
      </div>

      {view === 'evidence' && (
        <div className="animate-fadeUp">
          {/* Progress */}
          <p className="ev-progress-text">
            {totalQ} Critical Questions — Confirm, upload, or flag each evidence item.{' '}
            <strong id="ev-count">{answeredQ} / {totalQ} completed</strong>
          </p>
          <div className="ev-progress">
            <div className="ev-progress-bar" style={{ width: `${pct}%` }} />
          </div>

          {/* Evidence info banner */}
          <div className="ev-note info mb-6" style={{ marginBottom: 20 }}>
            Each question targets a specific legal requirement. Your answers directly impact the strength of your case.
            Answer honestly — items marked <strong>EXPOSED</strong> need attention, items marked <strong>CONFIRMED</strong> strengthen your position.
          </div>

          {/* Accordion Sections */}
          <div className="space-y-3">
            {EVIDENCE_SECTIONS.map((section) => {
              const isOpen = expanded[section.id];
              const stats = getSectionStats(section);

              return (
                <div key={section.id} className={`ev-section ${isOpen ? 'open' : ''}`}>
                  <div className="ev-section-head" onClick={() => toggleSection(section.id)}>
                    <h3>{section.title}</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="text-xs text-muted">{stats.done}/{stats.total}</span>
                      <span className="chevron">▾</span>
                    </div>
                  </div>

                  <div className="ev-section-body" style={{ display: isOpen ? 'block' : 'none' }}>
                    {section.questions.map((q, qi) => (
                      <div key={q.id} className="ev-question">
                        <div className="ev-q-header">
                          {getBadge(answers[q.id])}
                          <span className="ev-q-label">Q{qi + 1}: {q.text}</span>
                        </div>

                        {/* Legal Note */}
                        {q.note && (
                          <div className={`ev-note ${q.note.type}`}>
                            {q.note.text}
                          </div>
                        )}

                        {/* Radio Options */}
                        <div className="radio-group">
                          {ANSWER_OPTIONS.map((opt) => (
                            <label key={opt}>
                              <input
                                type="radio"
                                name={q.id}
                                value={opt.toLowerCase()}
                                checked={answers[q.id] === opt}
                                onChange={() => setAnswer(q.id, opt)}
                              />
                              {opt}{opt === 'Confirmed' ? ' — Already Submitted' : ''}
                            </label>
                          ))}
                        </div>

                        {/* Upload Zone */}
                        <div className="upload-zone" onClick={() => {}}>
                          <div className="uz-icon">📤</div>
                          <p>Upload supporting documentation</p>
                          <input type="file" multiple className="hidden" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="submit-row">
            <button className="btn-primary">Submit Evidence Intake</button>
          </div>
        </div>
      )}

      {view === 'disputes' && (
        <div className="animate-fadeUp">
          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  filter === s ? 'bg-gold text-white border-gold' : 'bg-white text-ink border-rule hover:border-gold'
                }`}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-3xl mb-2">⚖️</p>
              <p className="text-muted">No disputes found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((d) => (
                <div key={d.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg font-sans">{d.creditor || d.bureau || 'Dispute'}</h3>
                      <p className="text-sm text-muted">{d.bureau} {d.accountNumber ? `• Acct: ****${d.accountNumber.slice(-4)}` : ''}</p>
                    </div>
                    <span className={`badge badge-${STATUS_COLORS[d.status] || 'muted'}`}>
                      {d.status}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    {d.type && <div className="flex gap-2"><span className="text-muted font-medium min-w-[100px]">Type:</span><span>{d.type}</span></div>}
                    {d.reason && <div className="flex gap-2"><span className="text-muted font-medium min-w-[100px]">Reason:</span><span>{d.reason}</span></div>}
                    {d.amount && <div className="flex gap-2"><span className="text-muted font-medium min-w-[100px]">Amount:</span><span>${Number(d.amount).toLocaleString()}</span></div>}
                    {d.dateOpened && <div className="flex gap-2"><span className="text-muted font-medium min-w-[100px]">Opened:</span><span>{new Date(d.dateOpened).toLocaleDateString()}</span></div>}
                  </div>
                  {d.notes && <p className="mt-3 text-sm text-muted border-t border-rule/30 pt-3">{d.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
