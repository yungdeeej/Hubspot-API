import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../lib/api.js';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/mappings', label: 'Mappings' },
  { to: '/providers', label: 'Providers' },
  { to: '/aliases', label: 'Aliases' },
  { to: '/manual', label: 'Manual Enroll' },
  { to: '/audit', label: 'Audit Log' }
];

export default function Nav({ user }) {
  const navigate = useNavigate();

  async function handleLogout() {
    try { await logout(); } catch {}
    navigate('/login', { replace: true });
  }

  return (
    <nav className="bg-brand text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <div className="font-semibold tracking-tight">InFocus Lead Bridge</div>
        <div className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm ${
                  isActive ? 'bg-white/15' : 'hover:bg-white/10'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user && <span className="text-slate-300">{user.email} <span className="text-xs text-slate-400">({user.role})</span></span>}
          <button onClick={handleLogout} className="btn bg-white/10 border-white/20 text-white hover:bg-white/20">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
