import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboard, uploadDocument } from '../api/client';

const DOC_ICONS = {
  Identity: '🪪', Financial: '💰', Legal: '⚖️', Correspondence: '📬',
  Credit: '📊', Evidence: '🔍', Other: '📎',
};

const COA_OPTIONS = [
  'General',
  'COA 1 — FCRA Violation',
  'COA 2 — FDCPA Violation',
  'COA 3 — FCBA Violation',
  'COA 4 — State UDAP',
  'COA 5 — Negligence',
  'COA 6 — Defamation',
  'Correspondence',
  'Service',
];

const CATEGORY_OPTIONS = ['Identity', 'Financial', 'Legal', 'Credit', 'Evidence', 'Correspondence', 'Other'];

export default function Documents() {
  const { user } = useAuth();
  const [templateDocs, setTemplateDocs] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ category: '', section: '', description: '', date: '' });
  const fileRef = useRef();
  const modalFileRef = useRef();

  useEffect(() => {
    async function load() {
      try {
        const dash = await getDashboard(user.clientId);
        setTemplateDocs(dash.documents || []);
        setUploadedFiles(dash.uploadedFiles || []);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) load();
  }, [user?.clientId]);

  const allDocs = [...templateDocs, ...uploadedFiles.map((f) => ({ ...f, isUploaded: true }))];
  const needed = templateDocs.filter((d) => d.status === 'NEEDED');
  const onFile = templateDocs.filter((d) => d.status === 'ON FILE' || d.status === 'RECEIVED' || d.status === 'UPLOADED');

  const filteredDocs = (() => {
    let docs = activeTab === 'all' ? allDocs
      : activeTab === 'needed' ? needed
      : activeTab === 'onfile' ? onFile
      : activeTab === 'uploaded' ? uploadedFiles
      : allDocs;
    if (search.trim()) {
      const q = search.toLowerCase();
      docs = docs.filter((d) => (d.name || '').toLowerCase().includes(q) || (d.category || '').toLowerCase().includes(q));
    }
    return docs;
  })();

  async function handleUpload(category) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      await uploadDocument(user.clientId, file, category);
      setUploadMsg('Document uploaded successfully!');
      fileRef.current.value = '';
      const dash = await getDashboard(user.clientId);
      setTemplateDocs(dash.documents || []);
      setUploadedFiles(dash.uploadedFiles || []);
    } catch (err) {
      setUploadMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleModalUpload(e) {
    e.preventDefault();
    const file = modalFileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(user.clientId, file, modalData.category || 'Other');
      setUploadMsg('Document uploaded successfully!');
      setShowModal(false);
      setModalData({ category: '', section: '', description: '', date: '' });
      const dash = await getDashboard(user.clientId);
      setTemplateDocs(dash.documents || []);
      setUploadedFiles(dash.uploadedFiles || []);
    } catch (err) {
      setUploadMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
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
        <h2 className="text-2xl">Documents</h2>
      </div>

      {/* Search + Upload Button Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="input !py-2 !pl-10 !text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40 text-sm">🔍</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary !py-2 !px-5 !text-sm flex items-center gap-2"
        >
          <span>+</span> Upload Document
        </button>
      </div>

      {/* Tabs */}
      <div className="doc-tabs">
        {[
          { key: 'all', label: `All (${allDocs.length})` },
          { key: 'needed', label: `Needed (${needed.length})` },
          { key: 'onfile', label: `On File (${onFile.length})` },
          { key: 'uploaded', label: `My Uploads (${uploadedFiles.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`doc-tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-muted">{search ? 'No documents match your search.' : 'No documents in this category.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map((doc, i) => (
            <div key={doc.id || i} className={`doc-card ${doc.status === 'NEEDED' ? 'pending-doc' : ''}`}>
              <div className="w-11 h-11 rounded-xl bg-cream flex items-center justify-center text-xl flex-shrink-0">
                {DOC_ICONS[doc.category] || '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{doc.name}</h4>
                <p className="text-xs text-muted mt-0.5">{doc.description || doc.category}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-cream text-muted">{doc.category}</span>
                  {doc.status && (
                    <span className={`badge badge-${doc.status === 'NEEDED' ? 'gold' : doc.status === 'ON FILE' ? 'green' : 'blue'} !text-[10px]`}>
                      {doc.status}
                    </span>
                  )}
                  {doc.priority === 'high' && <span className="text-xs font-semibold text-hc-red">PRIORITY HIGH</span>}
                  {doc.size && <span className="text-xs text-muted/50">{(doc.size / 1024).toFixed(0)} KB</span>}
                  {doc.uploadedAt && <span className="text-xs text-muted/50">{new Date(doc.uploadedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              {doc.status === 'NEEDED' && (
                <label className="btn-primary !text-xs !px-4 !py-2 cursor-pointer flex-shrink-0">
                  Upload
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={() => handleUpload(doc.category)}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadMsg && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${uploadMsg.includes('fail') ? 'bg-hc-red/10 text-hc-red' : 'bg-hc-success/10 text-hc-success'}`}>
          {uploadMsg}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl">Upload Document</h3>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-ink text-xl">✕</button>
            </div>
            <form onSubmit={handleModalUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted/60 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={modalData.category}
                  onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                  className="input !py-2 !text-sm"
                  required
                >
                  <option value="">Select category...</option>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted/60 uppercase tracking-wider mb-1">Complaint Section</label>
                <select
                  value={modalData.section}
                  onChange={(e) => setModalData({ ...modalData, section: e.target.value })}
                  className="input !py-2 !text-sm"
                >
                  <option value="">Select section (optional)...</option>
                  {COA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted/60 uppercase tracking-wider mb-1">Document Date</label>
                <input
                  type="date"
                  value={modalData.date}
                  onChange={(e) => setModalData({ ...modalData, date: e.target.value })}
                  className="input !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted/60 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={modalData.description}
                  onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                  className="input !py-2 !text-sm resize-none"
                  rows={2}
                  placeholder="Brief description of the document..."
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted/60 uppercase tracking-wider mb-1">File</label>
                <div
                  className="upload-zone"
                  onClick={() => modalFileRef.current?.click()}
                >
                  <input ref={modalFileRef} type="file" className="hidden" required />
                  <p className="text-muted text-sm">
                    Drop file here or <span className="text-gold font-semibold">click to select</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 !py-2 !text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn-primary flex-1 !py-2 !text-sm">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E-Filing Panel */}
      <div className="efile-panel">
        <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginBottom: 8 }}>Electronic Filing</h4>
        <p style={{ fontSize: 13, color: '#7a7068', marginBottom: 12 }}>
          Submit documents electronically to the court system. Ensure all documents are properly formatted before filing.
        </p>
        <button className="efile-btn">Submit E-Filing</button>
      </div>
    </div>
  );
}
