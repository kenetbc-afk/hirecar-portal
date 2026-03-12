import { useAuth } from '../context/AuthContext';

export default function ConfidentialBar({ label, caseRef }) {
  const { user } = useAuth();

  return (
    <div className="conf-header">
      <span className="conf-label">{label || 'Confidential \u2014 Client Portal'}</span>
      <span className="conf-case">{caseRef || user?.program || ''}</span>
    </div>
  );
}
