import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';
import ConfidentialBar from '../components/ConfidentialBar';

const DEFAULT_STATS = {
  keyFigures: [
    { label: 'Total Debt in Dispute', value: '$47,832', color: 'stat-gold' },
    { label: 'Accounts Under Review', value: '14', color: 'stat-blue' },
    { label: 'Successful Removals', value: '6', color: 'stat-green' },
    { label: 'Active Disputes', value: '8', color: 'stat-red' },
  ],
  plaintiff: {
    name: 'Client',
    status: 'Active Member',
    program: '',
    caseRef: '',
    serviceProvider: 'SeedXchange, LLC / CREDITWITHKEN',
  },
  defendants: [
    { name: 'Equifax', type: 'Credit Bureau', served: true, serviceDate: 'Dispute Filed', badge: 'FILED' },
    { name: 'Experian', type: 'Credit Bureau', served: true, serviceDate: 'Dispute Filed', badge: 'FILED' },
    { name: 'TransUnion', type: 'Credit Bureau', served: true, serviceDate: 'Dispute Filed', badge: 'FILED' },
  ],
  causesOfAction: [
    { num: 1, name: 'FCRA §611 — Failure to Investigate', riskLevel: 'strong', riskLabel: 'STRONG', desc: 'Bureau failed to conduct reasonable investigation of disputed items' },
    { num: 2, name: 'FCRA §623 — Furnisher Violations', riskLevel: 'strong', riskLabel: 'STRONG', desc: 'Data furnishers reported inaccurate information after notice' },
    { num: 3, name: 'FDCPA Violations', riskLevel: 'moderate', riskLabel: 'MODERATE', desc: 'Debt collectors used deceptive practices in collection attempts' },
    { num: 4, name: 'State Consumer Protection', riskLevel: 'moderate', riskLabel: 'MODERATE', desc: 'Violations of state UDAP / consumer credit statutes' },
    { num: 5, name: 'Breach of Contract', riskLevel: 'strong', riskLabel: 'STRONG', desc: 'Creditors failed to honor agreed terms and conditions' },
    { num: 6, name: 'Negligence / Defamation', riskLevel: 'weak', riskLabel: 'DEVELOPING', desc: 'Publication of false credit information causing reputational harm' },
  ],
  projectedTimelines: [
    { label: 'Dispute Letters Sent', value: 'Completed' },
    { label: 'Bureau Response Deadline', value: '30–45 days from filing' },
    { label: 'Follow-Up Disputes', value: 'As needed per response' },
    { label: 'Escalation / Legal Action', value: 'If violations confirmed' },
  ],
  keyIssues: [
    { type: 'warn', text: 'Multiple accounts reporting inconsistent balances across bureaus — potential FCRA violation.' },
    { type: 'info', text: 'Awaiting response from Equifax on Round 2 dispute. Statutory deadline approaching.' },
    { type: 'ok', text: '6 items successfully removed or corrected. Score improvement of 45+ points documented.' },
  ],
};

export default function Statistics() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        if (dash.statistics) setStats(dash.statistics);
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const data = stats || DEFAULT_STATS;
  const plaintiff = { ...DEFAULT_STATS.plaintiff, ...data.plaintiff, name: data.plaintiff?.name || user?.fullName || 'Client', program: data.plaintiff?.program || user?.program || 'Credit Warrior' };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <ConfidentialBar />
      <div className="sec-header">
        <div className="accent-bar" />
        <h2 className="text-2xl">Case Statistics</h2>
      </div>

      {/* Key Figures */}
      <div className="stat-overview">
        {(data.keyFigures || DEFAULT_STATS.keyFigures).map((fig, i) => (
          <div key={i} className={`stat-block ${fig.color || ''}`}>
            <h4 className="stat-block-value">{fig.value}</h4>
            <span className="stat-block-label">{fig.label}</span>
          </div>
        ))}
      </div>

      {/* Plaintiff / Client Information */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Client Information</h3>
        <div className="case-overview">
          <div className="case-row"><span className="case-label">Name</span><span className="case-val">{plaintiff.name}</span></div>
          <div className="case-row"><span className="case-label">Status</span><span className="case-val"><span className="badge badge-green">{plaintiff.status}</span></span></div>
          <div className="case-row"><span className="case-label">Program</span><span className="case-val font-semibold text-gold">{plaintiff.program}</span></div>
          {plaintiff.caseRef && <div className="case-row"><span className="case-label">Case Ref</span><span className="case-val">{plaintiff.caseRef}</span></div>}
          <div className="case-row"><span className="case-label">Service Provider</span><span className="case-val">{plaintiff.serviceProvider}</span></div>
        </div>
      </div>

      {/* Defendants / Respondents & Service Status */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Respondents &amp; Service Status</h3>
        <div className="defendant-grid">
          {(data.defendants || DEFAULT_STATS.defendants).map((d, i) => (
            <div key={i} className="def-card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-base">{d.name}</h4>
                  <p className="text-xs text-muted">{d.type}</p>
                </div>
                <span className={`badge text-[10px] ${d.served ? 'badge-green' : 'badge-red'}`}>
                  {d.badge || (d.served ? 'SERVED' : 'NOT YET SERVED')}
                </span>
              </div>
              <p className="text-xs text-muted">{d.serviceDate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Causes of Action Table */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Causes of Action &amp; Risk Assessment</h3>
        <div className="overflow-x-auto">
          <table className="coa-table">
            <thead>
              <tr><th>#</th><th>Cause of Action</th><th>Description</th><th>Strength</th></tr>
            </thead>
            <tbody>
              {(data.causesOfAction || DEFAULT_STATS.causesOfAction).map((coa) => (
                <tr key={coa.num}>
                  <td>{coa.num}</td>
                  <td className="font-semibold">{coa.name}</td>
                  <td className="text-muted text-sm">{coa.desc}</td>
                  <td><span className={`risk-bar risk-${coa.riskLevel}`}>{coa.riskLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projected Timelines */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Projected Timelines</h3>
        <div className="case-overview">
          {(data.projectedTimelines || DEFAULT_STATS.projectedTimelines).map((t, i) => (
            <div key={i} className="case-row">
              <span className="case-label">{t.label}</span>
              <span className="case-val">{t.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Issues */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Key Issues &amp; Alerts</h3>
        <div className="space-y-3">
          {(data.keyIssues || DEFAULT_STATS.keyIssues).map((issue, i) => (
            <div key={i} className={`ev-note ${issue.type}`}>
              {issue.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
