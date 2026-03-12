import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import Footer from './Footer';
import Chatbot from './Chatbot';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊', badge: 0 },
  { path: '/statistics', label: 'Statistics', icon: '📈', module: 'evidence', badge: 0 },
  { path: '/documents', label: 'Documents', icon: '📄', module: 'documents', badge: 0 },
  { path: '/evidence', label: 'Evidence', icon: '⚖️', module: 'evidence', badge: 0 },
  { path: '/communications', label: 'Comms', icon: '📨', module: 'messages', badge: 0 },
  { path: '/messages', label: 'Messages', icon: '💬', module: 'messages', badge: 0 },
  { path: '/strategy', label: 'Strategy', icon: '🎯', module: 'evidence', badge: 0 },
  { path: '/billing', label: 'Billing', icon: '💳', module: 'billing', badge: 0 },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const modules = new Set(user?.modules || ['dashboard']);
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.module || modules.has(item.module)
  );

  const initials = (user?.fullName || 'HC')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-ink z-50 flex items-center justify-between px-6 border-b border-gold/20">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden text-cream text-xl mr-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center text-[11px] text-ink font-bold">
            HC
          </div>
          <span className="font-display text-gold text-base tracking-widest hidden sm:block">
            HIRECAR
          </span>
          <span className="hidden sm:block text-muted/30 mx-1">|</span>
          <span className="hidden sm:block font-mono text-hc-red text-[10px] tracking-wider">
            CWK
          </span>
        </div>

        {/* Desktop nav tabs */}
        <nav className="hidden lg:flex gap-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `px-4 py-2 text-sm rounded-md transition-colors relative ${
                  isActive ? 'text-gold' : 'text-muted hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {item.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-hc-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gold rounded" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-cream text-sm hidden sm:block">
            {user?.nickname || user?.fullName}
          </span>
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-ink">
            {initials}
          </div>
          <button
            onClick={logout}
            className="text-muted hover:text-hc-red text-xs ml-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="absolute left-0 top-[60px] bottom-0 w-64 bg-ink p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-1">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors relative ${
                      isActive
                        ? 'bg-gold/10 text-gold'
                        : 'text-cream/60 hover:text-cream hover:bg-white/5'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto w-5 h-5 bg-hc-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="mt-8 px-4">
              <div className="text-xs text-muted/40 uppercase tracking-wider mb-2">Program</div>
              <div className="badge badge-gold text-xs">{user?.program || 'Member'}</div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-[80px] max-w-6xl mx-auto px-5 pb-8 flex-1 w-full">
        <Outlet />
        <Footer />
      </main>

      {/* Chatbot */}
      <Chatbot />
    </div>
  );
}
