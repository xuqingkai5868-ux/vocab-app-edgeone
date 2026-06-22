import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const USERS = [
  { id: 'gao', label: '哥哥' },
  { id: 'di', label: '弟弟' },
  { id: 'admin', label: '管理员' },
];

export function Login() {
  const { login } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState('gao');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(selectedUserId, pin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">暑假共学背单词</h1>
        <p className="text-center text-gray-500 text-sm mb-6">选择用户并输入 PIN 码登录</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择用户</label>
          <div className="flex gap-2">
            {USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedUserId === u.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">PIN 码</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="输入4位数字"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || pin.length < 4}
          className="w-full py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
