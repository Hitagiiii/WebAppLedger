import { Outlet } from 'react-router-dom';

import './AuthLayout.css';

/** Centered shell for /login and /register — no app sidebar or navbar. */
export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-petals" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <main className="auth-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            桜
          </span>
          <div>
            <h1>Sakura Ledger</h1>
            <p>静かに、着実に — peaceful personal finance</p>
          </div>
        </div>
        <Outlet />
      </main>

      <footer className="auth-footer">
        <p>Demo mode: accounts are stored only in this browser. Not production authentication.</p>
      </footer>
    </div>
  );
}
