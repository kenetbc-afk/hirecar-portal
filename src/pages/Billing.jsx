import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';
import ConfidentialBar from '../components/ConfidentialBar';
import DamagesTable from '../components/DamagesTable';

const DEFAULT_BILLING = {
  agreement: {
    serviceProvider: 'SeedXchange, LLC / CreditWithKen',
    serviceType: 'Consumer Law Research & Document Preparation + Credit Clean Up',
    engagementDate: '',
    totalFee: '',
    downPayment: '',
    remainingBalance: '',
  },
  payments: [],
  bestCase: {
    amount: '$120,000+',
    items: [
      'Full deposit/debt return',
      'Statutory penalties (2x bad faith)',
      'Fraud / concealment damages',
      'Conversion damages + interest',
      'Constructive trust on proceeds',
      'Breach of fiduciary duty damages',
      'Fees, costs, and interest recovery',
    ],
  },
  worstCase: {
    amount: '$0 – $7,500',
    items: [
      'Weaker claims dismissed on demurrer',
      'Partial return only',
      'Deductions partially upheld',
      'Service delays on pending defendants',
      'Insufficient evidence for some claims',
      'Settlement below full recovery',
    ],
  },
};

export default function Billing() {
  const { user } = useAuth();
  const [billing, setBilling] = useState(null);
  const [damages, setDamages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsEmail, setSmsEmail] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        setBilling(dash.billing || null);
        setDamages(dash.damages || null);
      } catch (err) {
        console.error('Failed to load billing:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const data = billing || {};
  const agreement = { ...DEFAULT_BILLING.agreement, ...data.agreement };
  const payments = data.payments?.length ? data.payments : DEFAULT_BILLING.payments;
  const bestCase = data.bestCase || DEFAULT_BILLING.bestCase;
  const worstCase = data.worstCase || DEFAULT_BILLING.worstCase;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <ConfidentialBar label="Confidential — Billing & Agreement" caseRef="SeedXchange, LLC / CreditWithKen" />

      <div className="sec-header">
        <div className="accent-bar" />
        <h2 className="text-2xl">Billing &amp; Service Agreement</h2>
      </div>

      {/* Damages Table (if data) */}
      <DamagesTable damages={damages} />

      {/* Service Agreement Summary */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Service Agreement Summary</h3>
        <div className="case-overview">
          <div className="case-row"><span className="case-label">Service Provider</span><span className="case-val">{agreement.serviceProvider}</span></div>
          <div className="case-row"><span className="case-label">Client</span><span className="case-val">{user?.fullName || 'Member'}</span></div>
          <div className="case-row"><span className="case-label">Service Type</span><span className="case-val">{agreement.serviceType}</span></div>
          {agreement.engagementDate && (
            <div className="case-row"><span className="case-label">Engagement Date</span><span className="case-val">{agreement.engagementDate}</span></div>
          )}
          {agreement.totalFee && (
            <div className="case-row"><span className="case-label">Total Service Fee</span><span className="case-val font-bold text-gold">{agreement.totalFee}</span></div>
          )}
          {agreement.downPayment && (
            <div className="case-row"><span className="case-label">Down Payment</span><span className="case-val">{agreement.downPayment}</span></div>
          )}
          {agreement.remainingBalance && (
            <div className="case-row"><span className="case-label">Remaining Balance</span><span className="case-val font-bold text-hc-red">{agreement.remainingBalance}</span></div>
          )}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg font-sans mb-3">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="coa-table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td>{p.date ? new Date(p.date).toLocaleDateString() : p.dateLabel || ''}</td>
                    <td>{p.description || 'Payment'}</td>
                    <td className="font-bold">{typeof p.amount === 'number' ? `$${Number(p.amount).toLocaleString()}` : p.amount}</td>
                    <td>
                      <span className={`badge ${p.status === 'paid' ? 'badge-green' : p.status === 'outstanding' ? 'badge-gold' : 'badge-muted'}`}>
                        {(p.status || 'paid').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan Info (fallback for when no detailed billing) */}
      {data.plan && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg font-sans">{data.plan || user?.program}</h3>
              <p className="text-sm text-muted">{data.description || 'Current subscription'}</p>
            </div>
            <span className={`badge ${data.status === 'active' ? 'badge-green' : 'badge-muted'}`}>
              {data.status || 'Active'}
            </span>
          </div>
          {data.amount && (
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-3xl font-display font-bold text-gold">
                ${Number(data.amount).toLocaleString()}
              </span>
              <span className="text-muted text-sm">/{data.interval || 'month'}</span>
            </div>
          )}
          {data.nextPayment && (
            <p className="text-sm text-muted">
              Next payment: {new Date(data.nextPayment).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Case Outcome Projections — Best / Worst */}
      <div className="card" style={{ border: '1px solid var(--gold)', borderLeft: '4px solid var(--gold)' }}>
        <h3 className="font-semibold text-lg font-sans mb-3">Case Outcome Projections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl" style={{ background: 'rgba(26,107,60,.04)', border: '1px solid rgba(26,107,60,.2)' }}>
            <h4 className="font-sans font-semibold mb-2" style={{ color: 'var(--success)' }}>Best Case Scenario</h4>
            <div className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--success)' }}>
              {bestCase.amount}
            </div>
            <ul className="text-sm text-muted list-disc pl-5 space-y-1">
              {bestCase.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="p-5 rounded-xl" style={{ background: 'rgba(192,57,43,.04)', border: '1px solid rgba(192,57,43,.2)' }}>
            <h4 className="font-sans font-semibold mb-2" style={{ color: 'var(--error)' }}>Worst Case Scenario</h4>
            <div className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--error)' }}>
              {worstCase.amount}
            </div>
            <ul className="text-sm text-muted list-disc pl-5 space-y-1">
              {worstCase.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">Terms &amp; Conditions</h3>
        <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '16px', border: '1px solid var(--rule)', borderRadius: '10px', background: 'var(--cream)', fontSize: '13px', lineHeight: '1.7', color: 'var(--muted)' }}>
          <p style={{ marginBottom: '12px' }}><strong>1. Scope of Services</strong> — SeedXchange, LLC / CreditWithKen ("Provider") agrees to provide Consumer Law Research, Document Preparation, and Credit Clean Up services as outlined in the Service Agreement.</p>
          <p style={{ marginBottom: '12px' }}><strong>2. Client Responsibilities</strong> — Client agrees to provide accurate and complete information as required. Client is responsible for reviewing all prepared documents before submission.</p>
          <p style={{ marginBottom: '12px' }}><strong>3. Payment Terms</strong> — Fees are due as outlined in the engagement agreement. Late payments may result in suspension of services until balance is resolved.</p>
          <p style={{ marginBottom: '12px' }}><strong>4. Confidentiality</strong> — All client information is treated as confidential. Provider will not share client data with unauthorized third parties.</p>
          <p style={{ marginBottom: '12px' }}><strong>5. No Legal Representation</strong> — Provider is not a law firm and does not provide legal advice. Services are limited to research, document preparation, and credit education.</p>
          <p style={{ marginBottom: '12px' }}><strong>6. Results Disclaimer</strong> — Provider does not guarantee specific outcomes. Credit improvement depends on individual circumstances, creditor responses, and bureau compliance.</p>
          <p style={{ marginBottom: '12px' }}><strong>7. Cancellation Policy</strong> — Client may cancel services with 30 days written notice. Fees for completed work are non-refundable.</p>
          <p style={{ marginBottom: '12px' }}><strong>8. Dispute Resolution</strong> — Any disputes arising from this agreement shall be resolved through mediation before pursuing other remedies.</p>
          <p><strong>9. Governing Law</strong> — This agreement is governed by the laws of the state in which services are primarily rendered.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', fontSize: '14px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            style={{ accentColor: 'var(--gold)', width: '18px', height: '18px' }}
          />
          I have read and agree to the Terms &amp; Conditions
        </label>
      </div>

      {/* SMS Notification Settings */}
      <div className="card">
        <h3 className="font-semibold text-lg font-sans mb-3">SMS Notification Settings</h3>
        <p className="text-sm text-muted mb-4">
          Receive real-time updates about your case via text message and email. Powered by Twilio.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold block mb-1">Phone Number</label>
            <input
              type="tel"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="ev-input"
            />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Email Address</label>
            <input
              type="email"
              value={smsEmail}
              onChange={(e) => setSmsEmail(e.target.value)}
              placeholder="client@email.com"
              className="ev-input"
            />
          </div>
        </div>
        <div className="mt-4">
          <button className="efile-btn">Save Notification Preferences</button>
        </div>
      </div>

      {/* No billing fallback */}
      {!billing && !damages && payments.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-3xl mb-2">💳</p>
          <p className="text-muted">Detailed billing information will appear here once your case is active.</p>
        </div>
      )}
    </div>
  );
}
