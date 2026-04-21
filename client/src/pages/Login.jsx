import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { user } = await login(email, password);
      onLogin?.(user);
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(e2.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">InFocus Lead Bridge</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="input" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input className="input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
