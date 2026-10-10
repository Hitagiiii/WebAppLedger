// ============================================
// App.tsx — providers + router
// ============================================
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './app/router';
import ErrorBoundary from './app/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LedgerProvider } from './context/LedgerContext';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <LedgerProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </LedgerProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
