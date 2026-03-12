export default function DamagesTable({ damages }) {
  const rows = damages || [
    { category: 'Actual Damages', description: 'Direct financial losses incurred', amount: null },
    { category: 'Statutory Penalties', description: 'Per-violation statutory damages', amount: null },
    { category: 'General Damages', description: 'Emotional distress and inconvenience', amount: null },
    { category: 'Punitive Damages', description: 'Additional penalties for willful violation', amount: null },
    { category: 'Attorney Fees', description: 'Legal representation costs', amount: null },
    { category: 'Court Costs', description: 'Filing and administrative fees', amount: null },
  ];

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="card mb-6">
      <div className="sec-header !mb-4 !pb-2">
        <div className="accent-bar" />
        <h2 className="text-lg">Damages Assessment</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-rule">
              <th className="text-left py-2 px-3 text-xs font-mono text-muted/60 uppercase tracking-wider">Category</th>
              <th className="text-left py-2 px-3 text-xs font-mono text-muted/60 uppercase tracking-wider hidden sm:table-cell">Description</th>
              <th className="text-right py-2 px-3 text-xs font-mono text-muted/60 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-rule/30 hover:bg-cream/30 transition-colors">
                <td className="py-3 px-3 font-semibold">{r.category}</td>
                <td className="py-3 px-3 text-muted hidden sm:table-cell">{r.description}</td>
                <td className="py-3 px-3 text-right font-mono font-semibold">
                  {r.amount != null ? `$${Number(r.amount).toLocaleString()}` : <span className="text-muted/40">TBD</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gold">
              <td className="py-3 px-3 font-bold text-gold font-display" colSpan={2}>Total Estimated Damages</td>
              <td className="py-3 px-3 text-right font-display font-bold text-gold text-lg">
                {total > 0 ? `$${total.toLocaleString()}` : 'TBD'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
