// ============================================
// ProtectedRoute
// Path: src/routes/ProtectedRoute.tsx
// ============================================

import { Outlet } from 'react-router-dom';

// TODO (Phase 3): Replace with real auth check.
// When backend is wired, check for a valid session token here.
// If no token, redirect to /login using <Navigate to="/login" replace />.
export default function ProtectedRoute() {
  return <Outlet />;
}
