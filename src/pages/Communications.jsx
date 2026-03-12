import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/client';

const AVATAR_MAP = {
  legal: { bg: 'bg-gold', text: 'text-ink', icon: 'SX' },
  opp: { bg: 'bg-hc-red', text: 'text-white', icon: 'OC' },
  court: { bg: 'bg-hc-blue', text: 'text-white', icon: 'CC' },
  admin: { bg: 'bg-gold', text: 'text-ink', icon: 'HC' },
  system: { bg: 'bg-cream', text: 'text-ink', icon: 'SY' },
};

const DEFAULT_COMMS = [
  {
    id: 'c1', from: 'legal', sender: 'HIRECAR Legal Team', role: 'Service Provider',
    date: 'Engagement Start', preview: 'Engagement confirmed. Legal research and document preparation underway.',
  },
  {
    id: 'c2', from: 'admin', sender: 'HIRECAR Team', role: 'Case Management',
    date: 'Case Setup', preview: 'Case file created. All initial documentation received and logged.',
  },
  {
    id: 'c3', from: 'legal', sender: 'HIRECAR Legal Team', role: 'Service Provider',
    date: 'Dispute Phase', preview: 'Dispute letters drafted and sent to all three bureaus via certified mail.',
  },
  {
    id: 'c4', from: 'system', sender: 'System Notification', role: 'Automated',
    date: 'Processing', preview: 'Bureau response window opened. Monitoring for responses within 30-45 day statutory period.',
  },
];

export default function Communications() {
  const { user } = useAuth();
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        if (dash.communications?.length) setComms(dash.communications);
      } catch {
        // defaults
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const data = comms.length ? comms : DEFAULT_COMMS;

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
        <h2 className="text-2xl">Counsel Communications</h2>
      </div>

      <p className="text-sm text-muted mb-3">
        Upload emails and documents for each communication entry. Click the download button to save any attachment.
      </p>

      <div className="text-right mb-4">
        <button className="btn-primary px-6 py-2.5 text-sm" onClick={() => setShowUpload(true)}>
          + Add Communication
        </button>
      </div>

      <div className="comm-thread">
        {data.map((comm) => {
          const avatar = AVATAR_MAP[comm.from] || AVATAR_MAP.admin;
          return (
            <div key={comm.id} className="comm-card">
              <div className={`comm-avatar ${avatar.bg} ${avatar.text}`}>
                {avatar.icon}
              </div>
              <div className="comm-body">
                <span className="comm-date">{comm.date}</span>
                <div className="comm-sender">
                  {comm.sender} <span className="comm-role">&mdash; {comm.role}</span>
                </div>
                <p className="comm-preview">{comm.preview}</p>
                {comm.files?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comm.files.map((f, i) => (
                      <span key={i} className="text-xs bg-cream rounded px-2 py-1 border border-rule">
                        📎 {f.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2 flex-wrap">
                  <label className="goal-chip cursor-pointer text-[11px] px-2.5 py-1">
                    <input type="file" className="hidden" multiple />
                    + Attach File
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Communication Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">Add Communication</h3>
              <button onClick={() => setShowUpload(false)} className="text-muted hover:text-ink text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">From / Sender <span className="text-hc-red">*</span></label>
                <input type="text" className="input w-full" placeholder="e.g., SeedXchange Legal Team" />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Role</label>
                <select className="input w-full">
                  <option value="legal">Service Provider</option>
                  <option value="opp">Opposing Counsel / Defense</option>
                  <option value="court">Court Clerk</option>
                  <option value="admin">HIRECAR Team</option>
                  <option value="system">System / Automated</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Date <span className="text-hc-red">*</span></label>
                <input type="date" className="input w-full" />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Summary <span className="text-hc-red">*</span></label>
                <textarea className="input w-full min-h-[80px] resize-y" placeholder="Brief description of this communication..." />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Attach Files</label>
                <div className="upload-zone">
                  <div className="uz-icon">📤</div>
                  <p>Drag & drop files or click to upload</p>
                  <input type="file" multiple className="hidden" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                className="px-5 py-2.5 bg-cream border border-rule rounded-lg text-sm cursor-pointer"
                onClick={() => setShowUpload(false)}
              >
                Cancel
              </button>
              <button className="btn-primary px-6 py-2.5" onClick={() => setShowUpload(false)}>
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
