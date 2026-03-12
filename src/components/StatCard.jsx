const colorMap = {
  gold: 'text-gold',
  green: 'text-hc-success',
  red: 'text-hc-red',
  blue: 'text-hc-blue',
};

export default function StatCard({ label, value, color = 'gold' }) {
  return (
    <div className="stat-card">
      <div className={`stat-num ${colorMap[color] || colorMap.gold}`}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
