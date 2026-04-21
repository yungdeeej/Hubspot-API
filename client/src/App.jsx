import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EnrollmentDetail from './pages/EnrollmentDetail.jsx';
import Mappings from './pages/Mappings.jsx';
import Providers from './pages/Providers.jsx';
import Aliases from './pages/Aliases.jsx';
import ManualEnroll from './pages/ManualEnroll.jsx';
import AuditLog from './pages/AuditLog.jsx';
import { getMe } from './lib/api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await getMe();
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (loading) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enrollments/:id" element={<EnrollmentDetail />} />
        <Route path="/mappings" element={<Mappings />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/aliases" element={<Aliases />} />
        <Route path="/manual" element={<ManualEnroll />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
