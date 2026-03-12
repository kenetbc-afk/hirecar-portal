export default function CaseOverview({ data, user }) {
  const fields = [
    { label: 'Client', value: user?.fullName },
    { label: 'Program', value: user?.program || 'Member', accent: true },
    { label: 'Client ID', value: user?.clientId, mono: true },
    { label: 'Status', value: data?.status || 'Active', badge: true },
    { label: 'Start Date', value: data?.startDate ? new Date(data.startDate).toLocaleDateString() : '—' },
    { label: 'Last Updated', value: data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : '—' },
    { label: 'Credit Score', value: data?.stats?.creditScore || '—', highlight: true },
    { label: 'Items Removed', value: data?.stats?.itemsRemoved || 0 },
  ];

  return (
    <div className="card mb-6">
      <div className="sec-header !mb-4 !pb-2">
        <div className="accent-bar" />
        <h2 className="text-lg">Case Overview</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[11px] font-mono text-muted/60 uppercase tracking-wider mb-1">{f.label}</p>
            {f.badge ? (
              <span className="badge badge-green">{f.value}</span>
            ) : f.highlight ? (
              <p className="text-lg font-display font-bold text-gold">{f.value}</p>
            ) : f.accent ? (
              <p className="text-sm font-semibold text-gold">{f.value}</p>
            ) : f.mono ? (
              <p className="text-sm font-mono text-ink/70">{f.value}</p>
            ) : (
              <p className="text-sm font-semibold text-ink">{f.value || '—'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
