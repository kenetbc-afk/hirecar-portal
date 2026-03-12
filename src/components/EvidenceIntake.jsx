import { useState, useRef } from 'react';

const SECTIONS = [
  {
    id: 'account-history',
    title: 'Account History & Activity',
    questions: [
      { id: 'q1', text: 'Have you noticed any unauthorized charges on your accounts?', type: 'radio' },
      { id: 'q2', text: 'Were there any accounts opened without your consent?', type: 'radio' },
      { id: 'q3', text: 'Have you disputed any charges with your bank or credit card company?', type: 'radio' },
    ],
  },
  {
    id: 'creditor-conduct',
    title: 'Creditor Conduct & Communications',
    questions: [
      { id: 'q4', text: 'Have any creditors contacted you about debts you don\'t recognize?', type: 'radio' },
      { id: 'q5', text: 'Have you received threatening or harassing collection calls?', type: 'radio' },
      { id: 'q6', text: 'Did any collector contact you at unreasonable hours?', type: 'radio' },
    ],
  },
  {
    id: 'credit-reporting',
    title: 'Credit Reporting Issues',
    questions: [
      { id: 'q7', text: 'Have you found inaccurate information on your credit reports?', type: 'radio' },
      { id: 'q8', text: 'Did a credit bureau fail to investigate your dispute within 30 days?', type: 'radio' },
      { id: 'q9', text: 'Were any items re-inserted on your report after being removed?', type: 'radio' },
    ],
  },
  {
    id: 'identity-theft',
    title: 'Identity Theft & Fraud',
    questions: [
      { id: 'q10', text: 'Have you been a victim of identity theft?', type: 'radio' },
      { id: 'q11', text: 'Were fraudulent accounts opened in your name?', type: 'radio' },
      { id: 'q12', text: 'Did you file a police report or FTC identity theft report?', type: 'radio' },
    ],
  },
  {
    id: 'damages',
    title: 'Damages & Impact',
    questions: [
      { id: 'q13', text: 'Were you denied credit due to inaccurate reporting?', type: 'radio' },
      { id: 'q14', text: 'Did you lose employment opportunities due to credit issues?', type: 'radio' },
      { id: 'q15', text: 'Have you experienced emotional distress from these issues?', type: 'radio' },
      { id: 'q16', text: 'Did you incur legal or professional fees addressing these issues?', type: 'radio' },
      { id: 'q17', text: 'Were you charged higher interest rates due to inaccurate reporting?', type: 'radio' },
      { id: 'q18', text: 'Did you have to pay additional deposits due to credit issues?', type: 'radio' },
    ],
  },
];

const ANSWER_OPTIONS = ['Yes', 'No', 'Unsure', 'Confirmed'];

function getBadge(answer) {
  if (!answer) return null;
  if (answer === 'Confirmed' || answer === 'Yes') {
    return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-hc-red/10 text-hc-red border border-hc-red/30 uppercase">Exposed</span>;
  }
  if (answer === 'No') {
    return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-hc-success/10 text-hc-success border border-hc-success/30 uppercase">Confirmed</span>;
  }
  return <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-gold/10 text-gold border border-gold/30 uppercase">Pending</span>;
}

export default function EvidenceIntake({ existingAnswers = {}, onSave }) {
  const [answers, setAnswers] = useState(existingAnswers);
  const [expanded, setExpanded] = useState({});
  const [uploads, setUploads] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef({});

  const totalQuestions = SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);
  const answered = Object.keys(answers).filter((k) => answers[k]).length;
  const pct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

  function toggleSection(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setAnswer(qId, value) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function handleDrop(e, qId) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      setUploads((prev) => ({ ...prev, [qId]: [...(prev[qId] || []), ...files] }));
    }
  }

  function handleFileSelect(qId) {
    const files = Array.from(fileRefs.current[qId]?.files || []);
    if (files.length > 0) {
      setUploads((prev) => ({ ...prev, [qId]: [...(prev[qId] || []), ...files] }));
    }
  }

  function removeFile(qId, idx) {
    setUploads((prev) => ({
      ...prev,
      [qId]: prev[qId].filter((_, i) => i !== idx),
    }));
  }

  function getSectionStats(section) {
    const total = section.questions.length;
    const done = section.questions.filter((q) => answers[q.id]).length;
    return { total, done };
  }

  return (
    <div className="card mb-6">
      <div className="sec-header !mb-4 !pb-2">
        <div className="accent-bar" />
        <h2 className="text-lg">Evidence Intake</h2>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{answered} of {totalQuestions} completed</span>
          <span className="text-sm text-gold font-bold">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-cream rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-hc-success rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {saving && (
          <p className="text-[10px] font-mono text-hc-success mt-1 animate-pulse">Autosaving...</p>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = expanded[section.id];
          const stats = getSectionStats(section);

          return (
            <div key={section.id} className="border border-rule rounded-lg overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-cream/50 hover:bg-cream transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    stats.done === stats.total && stats.total > 0
                      ? 'bg-hc-success text-white'
                      : stats.done > 0
                        ? 'bg-gold text-white'
                        : 'bg-muted/20 text-muted'
                  }`}>
                    {stats.done === stats.total && stats.total > 0 ? '✓' : stats.done}
                  </span>
                  <span className="font-semibold text-sm">{section.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{stats.done}/{stats.total}</span>
                  <span className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>

              {/* Questions */}
              {isOpen && (
                <div className="p-4 space-y-5 border-t border-rule/50">
                  {section.questions.map((q, qi) => (
                    <div key={q.id} className="relative">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="w-5 h-5 rounded-full bg-gold/10 text-gold text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {qi + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {q.text}
                            {getBadge(answers[q.id])}
                          </p>

                          {/* Radio Options */}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {ANSWER_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setAnswer(q.id, opt)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                  answers[q.id] === opt
                                    ? opt === 'Yes' || opt === 'Confirmed'
                                      ? 'bg-hc-red text-white border-hc-red'
                                      : opt === 'No'
                                        ? 'bg-hc-success text-white border-hc-success'
                                        : 'bg-gold text-white border-gold'
                                    : 'bg-white text-ink border-rule hover:border-gold'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>

                          {/* Upload Zone */}
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, q.id)}
                            className="mt-3 border-2 border-dashed border-rule/40 rounded-lg p-3 text-center hover:border-gold/40 transition cursor-pointer"
                            onClick={() => fileRefs.current[q.id]?.click()}
                          >
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              ref={(el) => (fileRefs.current[q.id] = el)}
                              onChange={() => handleFileSelect(q.id)}
                            />
                            <p className="text-xs text-muted">
                              Drop files here or <span className="text-gold font-semibold">click to upload</span>
                            </p>
                          </div>

                          {/* Uploaded Files */}
                          {uploads[q.id]?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {uploads[q.id].map((file, fi) => (
                                <div key={fi} className="flex items-center gap-2 text-xs text-muted bg-cream/50 rounded px-2 py-1">
                                  <span>📎</span>
                                  <span className="truncate flex-1">{file.name}</span>
                                  <span className="text-muted/40">{(file.size / 1024).toFixed(0)} KB</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeFile(q.id, fi); }}
                                    className="text-hc-red hover:text-hc-red/80"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
