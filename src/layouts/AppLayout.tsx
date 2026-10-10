import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Navbar from '../components/Navbar/Navbar';
import Sidebar from '../components/Sidebar/Sidebar';
import { ToastRegion } from '../components/ui/ToastRegion';
import './AppLayout.css';

/**
 * Shared application shell: sidebar + sticky navbar + routed content.
 * Mounted once under the protected route group so pages never render
 * their own navigation (no duplicate sidebars/navbars).
 */
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className={`app-sidebar ${drawerOpen ? 'is-open' : ''}`}>
        <Sidebar onClose={() => setDrawerOpen(false)} onNavigate={() => setDrawerOpen(false)} />
      </div>
      {drawerOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <div className="app-main">
        <Navbar onMenuClick={() => setDrawerOpen((open) => !open)} />
        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <ToastRegion />
    </div>
  );
}
