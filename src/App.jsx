import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Statistics from './pages/Statistics';
import Disputes from './pages/Disputes';
import Documents from './pages/Documents';
import Communications from './pages/Communications';
import Messages from './pages/Messages';
import Strategy from './pages/Strategy';
import Billing from './pages/Billing';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted font-mono text-sm tracking-wider">LOADING</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="documents" element={<Documents />} />
        <Route path="evidence" element={<Disputes />} />
        <Route path="communications" element={<Communications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="billing" element={<Billing />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
