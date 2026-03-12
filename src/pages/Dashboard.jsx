import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';
import CaseOverview from '../components/CaseOverview';
import GoalsTemperature from '../components/GoalsTemperature';
import ConfidentialBar from '../components/ConfidentialBar';
import EvidenceIntake from '../components/EvidenceIntake';

const DEFAULT_DEFENDANTS = [
  { name: 'Equifax', role: 'Credit Bureau', status: 'Dispute Filed', served: true },
  { name: 'Experian', role: 'Credit Bureau', status: 'Under Investigation', served: true },
  { name: 'TransUnion', role: 'Credit Bureau', status: 'Pending Response', served: true },
];

const DEFAULT_COA = [
  { num: 1, name: 'FCRA Violation', statute: '15 U.S.C. §1681', strength: 'STRONG', issue: 'Failure to conduct reasonable investigation of disputed items within 30 days' },
  { num: 2, name: 'FDCPA Violation', statute: '15 U.S.C. §1692', strength: 'STRONG', issue: 'Debt collector continued collection activity on disputed debt without verification' },
  { num: 3, name: 'FCBA Violation', statute: '15 U.S.C. §1666', strength: 'MODERATE', issue: 'Creditor failed to acknowledge billing dispute within 30 days' },
  { num: 4, name: 'State UDAP', statute: 'State Consumer Protection', strength: 'STRONG', issue: 'Unfair and deceptive practices in credit reporting and collection' },
  { num: 5, name: 'Negligence', statute: 'Common Law', strength: 'MODERATE', issue: 'Failure to maintain accurate records and implement reasonable procedures' },
  { num: 6, name: 'Defamation', statute: 'Common Law', strength: 'MODERATE', issue: 'Publication of false credit information to third parties' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickMsg, setQuickMsg] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        setData(dash);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-hc-red/30">
        <p className="text-hc-red text-sm">{error}</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentMessages = data?.messages || [];
  const disputes = data?.disputes || [];
  const milestones = data?.milestones || [];
  const defendants = data?.defendants || DEFAULT_DEFENDANTS;
  const causesOfAction = data?.causesOfAction || DEFAULT_COA;

  const openDisputes = disputes.filter((d) => d.status !== 'RESOLVED' && d.status !== 'CLOSED').length;
  const completedMilestones = milestones.filter((m) => m.done).length;
  const totalMilestones = milestones.length;
  const progressPct = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  const evidenceAnswers = data?.evidenceAnswers || {};
  const exposedCount = Object.values(evidenceAnswers).filter((a) => a === 'Yes' || a === 'Confirmed').length;
  const confirmedCount = Object.values(evidenceAnswers).filter((a) => a === 'No').length;
  const totalEvidence = 18;

  return (
    <div>
      <ConfidentialBar />

      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl text-ink">
          Welcome back, <span className="text-gold">{user.nickname || user.fullName}</span>
        </h1>
        <p className="text-muted text-sm mt-1">
          <span className="badge badge-gold">{user.program || 'Member'}</span>
          <span className="ml-3">Last updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : '—'}</span>
        </p>
      </div>

      <CaseOverview data={data} user={user} />

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-num text-hc-success">{confirmedCount}</p>
          <p className="stat-label">Evidence Confirmed</p>
        </div>
        <div className="stat-card">
          <p className="stat-num text-hc-red">{exposedCount}</p>
          <p className="stat-label">Exposed</p>
        </div>
        <div className="stat-card">
          <p className="stat-num text-gold">{stats.documentsOnFile || 0}</p>
          <p className="stat-label">Documents on File</p>
        </div>
        <div className="stat-card">
          <p className="stat-num text-muted">{totalEvidence - exposedCount - confirmedCount}</p>
          <p className="stat-label">Pending</p>
        </div>
      </div>

      {/* Respondents / Defendants */}
      <div className="card mb-6">
        <div className="sec-header !mb-4 !pb-2">
          <div className="accent-bar" />
          <h2 className="text-lg">Respondents & Creditors</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {defendants.map((d, i) => (
            <div key={i} className="def-card">
              <p className="def-name">{d.name}</p>
              <div className="def-detail"><span className="dlabel">Role</span><span>{d.role}</span></div>
              <div className="def-detail"><span className="dlabel">Status</span><span>{d.status}</span></div>
              <div className="def-detail">
                <span className="dlabel">Served</span>
                <span className={d.served ? 'text-hc-success font-semibold' : 'text-hc-red font-semibold'}>
                  {d.served ? 'Yes' : 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Causes of Action Table */}
      <div className="card mb-6">
        <div className="sec-header !mb-4 !pb-2">
          <div className="accent-bar" />
          <h2 className="text-lg">Causes of Action</h2>
        </div>
        <p className="text-sm text-muted mb-3">Risk level reflects strength of each cause based on current evidence and legal analysis.</p>
        <div className="overflow-x-auto">
          <table className="coa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cause of Action</th>
                <th>Statute</th>
                <th>Strength</th>
                <th className="hidden sm:table-cell">Key Issue</th>
              </tr>
            </thead>
            <tbody>
              {causesOfAction.map((c) => (
                <tr key={c.num}>
                  <td className="font-bold text-gold">{c.num}</td>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-sm text-muted">{c.statute}</td>
                  <td>
                    <span className={`risk-bar ${c.strength === 'STRONG' ? 'risk-strong' : c.strength === 'MODERATE' ? 'risk-moderate' : 'risk-weak'}`}>
                      {c.strength}
                    </span>
                  </td>
                  <td className="text-sm text-muted hidden sm:table-cell">{c.issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ink">Overall Progress</h3>
          <span className="text-sm text-muted">{completedMilestones}/{totalMilestones} milestones</span>
        </div>
        <div className="w-full h-2.5 bg-cream rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-hc-success rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <GoalsTemperature data={data?.goals} />

      <EvidenceIntake existingAnswers={evidenceAnswers} />

      {/* Two Column: Active Disputes + Quick Message */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="sec-header !mb-4 !pb-2">
            <div className="accent-bar" />
            <h2 className="text-lg">Active Disputes</h2>
          </div>
          {disputes.length === 0 ? (
            <p className="text-muted text-sm">No disputes yet.</p>
          ) : (
            <div className="space-y-3">
              {disputes.slice(0, 4).map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-rule/30 last:border-0">
                  <div>
                    <p className="text-sm font-semibold">{d.bureau || d.creditor || 'Dispute'}</p>
                    <p className="text-xs text-muted">{d.creditor || d.type}</p>
                  </div>
                  <span className={`badge badge-${d.status === 'SENT' ? 'blue' : d.status === 'IN_PROGRESS' ? 'gold' : d.status === 'RESOLVED' ? 'green' : 'muted'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Message Widget */}
        <div className="card">
          <div className="sec-header !mb-4 !pb-2">
            <div className="accent-bar" />
            <h2 className="text-lg">Quick Message</h2>
          </div>

          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
            {recentMessages.length === 0 ? (
              <p className="text-muted text-sm">No messages yet.</p>
            ) : (
              recentMessages.slice(0, 3).map((msg) => (
                <div key={msg.id} className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${
                  msg.from === 'client'
                    ? 'bg-gold text-white ml-auto rounded-br-sm'
                    : 'bg-cream text-ink rounded-bl-sm'
                }`}>
                  {msg.text}
                  <span className="block text-[10px] opacity-60 mt-0.5">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setQuickMsg(''); }}
            className="flex gap-2"
          >
            <input
              value={quickMsg}
              onChange={(e) => setQuickMsg(e.target.value)}
              placeholder="Message your case team..."
              className="flex-1 px-3 py-2 text-sm bg-cream/50 border border-rule rounded-lg focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={!quickMsg.trim()}
              className="px-4 py-2 bg-gold text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gold-light transition"
            >
              Send
            </button>
          </form>
          <p className="text-[10px] text-muted/40 mt-2">Messages are monitored for security purposes.</p>
        </div>
      </div>
    </div>
  );
}
