import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { useLedger } from '../context/LedgerContext';
import { NAV_ITEMS } from '../constants';

export default function NotFound() {
  const { db } = useLedger();

  return (
    <div className="page" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 'var(--spacing-xl)' }}>
      <span className="sidebar-brand-mark" style={{ width: 56, height: 56, fontSize: 26 }} aria-hidden="true">
        404
      </span>
      <h1 style={{ fontSize: 'var(--text-xl)' }}>Page not found</h1>
      <p className="muted" style={{ maxWidth: 460 }}>
        The page you are looking for does not exist or has moved. Here are the real sections of Sakura Ledger:
      </p>
      <nav aria-label="Available sections">
        <ul className="chip-list" style={{ justifyContent: 'center' }}>
          {NAV_ITEMS.map((item) => (
            <li key={item.link}>
              <Link className="chip" to={item.link}>
                <Compass size={13} aria-hidden="true" /> {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="muted text-sm">Signed in as {db.profile.email}</p>
    </div>
  );
}
