// ============================================
// App.tsx — Main Router
// ============================================
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Import directory entry to allow resolution from index.tsx or homepage.tsx
import ProtectedRoute from './routes/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Homepage from './pages/Homepage';




export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/protected" element={<ProtectedRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
