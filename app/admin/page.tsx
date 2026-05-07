'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldown, setCooldown] = useState(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        const data = await res.json();
        const next = failCount + 1;
        setFailCount(next);
        setError(data.error ?? 'Invalid credentials');
        setPassword('');

        if (next >= 3) {
          setCooldown(true);
          timerRef.current = setTimeout(() => {
            setCooldown(false);
            setFailCount(0);
          }, 30000);
        }
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paragon-surface-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-sm bg-paragon-sidebar flex items-center justify-center">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <div className="text-base font-medium text-paragon-text-primary">Paragon Admin</div>
            <div className="text-xs text-paragon-text-muted">Powered by Hitch Partners</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={14} className="text-paragon-text-muted" />
            <span className="text-sm text-paragon-text-secondary">Admin Access</span>
          </div>

          <div>
            <label className="label-caps block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading || cooldown}
              placeholder="Enter admin password"
              className="w-full px-3 py-2 text-sm border border-paragon-border rounded-sm bg-white text-paragon-text-primary placeholder-paragon-text-muted focus:outline-none focus:border-paragon-accent-primary transition-colors disabled:opacity-50"
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-paragon-danger">{error}</p>
          )}

          {cooldown && (
            <p className="text-xs text-paragon-warning">
              Too many failed attempts. Please wait 30 seconds before trying again.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || cooldown || !password}
            className="w-full py-2 px-4 bg-paragon-accent-primary hover:bg-paragon-accent-hover active:scale-[0.98] text-white text-sm font-medium rounded-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
