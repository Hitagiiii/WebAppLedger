import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Search, Sun, UserCog } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useLedger } from '../../context/LedgerContext';
import { currentMonthKey, monthRange, computeTotals, filterTransactions, totalBalance } from '../../utils/finance';
import { deriveNotifications } from '../../utils/notifications';
import { formatCurrency } from '../../utils/format';
import './Navbar.css';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { db, updateSettings } = useLedger();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const balance = totalBalance(db.accounts, db.transactions);
  const notifications = useMemo(() => deriveNotifications(db), [db]);
  const monthTotals = useMemo(
    () => computeTotals(filterTransactions(db.transactions, {}, monthRange(currentMonthKey()))),
    [db.transactions],
  );
  const theme = db.settings.theme;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions');
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        {onMenuClick && (
          <button type="button" className="icon-btn navbar-menu" onClick={onMenuClick} aria-label="Open navigation">
            <Menu size={18} />
          </button>
        )}
        <form className="navbar-search" role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="nav-search">
            Search transactions
          </label>
          <Search size={16} aria-hidden="true" />
          <input
            id="nav-search"
            type="search"
            placeholder="Search transactions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="navbar-right">
        <div className="navbar-balance" title="Current balance (all tracked transactions)">
          <span className="navbar-balance-label">Balance</span>
          <span className="navbar-balance-value">{formatCurrency(balance, db.settings.currency)}</span>
        </div>

        <div className="navbar-month navbar-month--net" title="Net cash flow this month">
          <span className="navbar-balance-label">This month</span>
          <span className={monthTotals.net >= 0 ? 'is-positive' : 'is-negative'}>
            {formatCurrency(monthTotals.net, db.settings.currency, { showSign: true })}
          </span>
        </div>

        <details className="navbar-pop">
          <summary className="icon-btn" aria-label={`Notifications (${notifications.length} unread)`}>
            <Bell size={17} />
            {notifications.length > 0 && <span className="navbar-dot">{notifications.length}</span>}
          </summary>
          <div className="navbar-pop-panel" role="group" aria-label="Notifications">
            <h3>Notifications</h3>
            {notifications.length === 0 ? (
              <p className="navbar-pop-empty">Nothing needs your attention right now.</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className={`navbar-note navbar-note--${n.tone}`}>
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <button
          type="button"
          className="icon-btn"
          onClick={() => updateSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        <details className="navbar-pop">
          <summary className="icon-btn" aria-label="Account menu">
            <span className="navbar-avatar">{(user?.name ?? db.profile.name).slice(0, 1).toUpperCase()}</span>
          </summary>
          <div className="navbar-pop-panel navbar-pop-panel--right">
            <h3>{user?.name ?? db.profile.name}</h3>
            <p className="navbar-pop-empty">{user?.email ?? db.profile.email}</p>
            <Link to="/settings" className="navbar-menu-link">
              <UserCog size={15} /> Settings
            </Link>
            <button
              type="button"
              className="navbar-menu-link"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
