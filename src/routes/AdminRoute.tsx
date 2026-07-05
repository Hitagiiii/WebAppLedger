// ============================================
// AdminRoute
// Path: src/routes/AdminRoute.tsx
// ============================================
import { Outlet } from 'react-router-dom';

// TODO (Phase 3): Replace with real admin role check.
// When backend is wired, verify the user has alps_superadmin or institutional_admin role.
// If not, redirect to /admin/login using <Navigate to="/admin/login" replace />.
export default function AdminRoute() {
  return <Outlet />;
}
