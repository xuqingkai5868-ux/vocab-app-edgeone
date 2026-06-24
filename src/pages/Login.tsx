import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const USERS = [
  { id: 'di', label: '薯条', icon: '🐯', desc: 'PET 备考' },
  { id: 'kiki', label: 'Kiki', icon: '🐱', desc: 'PET 备考' },
];

export function Login() {
  const { login } = useAuth();
  const [selected, setSelected] = useState('di');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(selected, pin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center text-gray-800 mb-6">选择学习者</h1>

        <div className="flex gap-3 mb-6">
          {USERS.map(u => (
            <button key={u.id} type="button" onClick={() => { setSelected(u.id); setPin(''); }}
              className={`flex-1 py-4 rounded-xl text-center transition-colors ${
                selected === u.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <div className="text-2xl mb-1">{u.icon}</div>
              <div className="text-sm font-medium">{u.label}</div>
              <div className="text-xs opacity-70">{u.desc}</div>
            </button>
          ))}
        </div>

        <input
          type="password" inputMode="numeric" maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 位数字密码"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-[0.5em] mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">{error}</div>}

        <button type="submit" disabled={loading || pin.length < 4}
          className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-lg disabled:opacity-50"
        >
          {loading ? '登录中...' : '进入学习 🚀'}
        </button>
      </form>
    </div>
  );
}
