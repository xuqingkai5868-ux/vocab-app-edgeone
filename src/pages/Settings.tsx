import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPut } from '../api/client';

export function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const resp = await apiGet<{ config: { apiKeyMasked?: string; model: string; endpoint: string } }>('/ai-config');
      setModel(resp.config.model || 'gpt-4o-mini');
      setEndpoint(resp.config.endpoint || 'https://api.openai.com/v1');
    } catch {
      // use defaults
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      await apiPut('/ai-config', { apiKey, model, endpoint });
      // 同时保存到本地
      localStorage.setItem('vocab_ai_config', JSON.stringify({ apiKey, model, endpoint }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">设置</h1>

      {/* AI 配置 */}
      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">AI 配置</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">模型</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="deepseek-chat">DeepSeek Chat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">API 端点</label>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !apiKey.trim()}
            className="w-full py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? '保存中...' : saved ? '已保存!' : '保存配置'}
          </button>
        </div>
      </Card>

      {/* 用户信息 */}
      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">用户信息</h2>
        <p className="text-sm text-gray-600">当前用户：{user?.name} ({user?.id})</p>
        <p className="text-sm text-gray-600">角色：{user?.role}</p>
      </Card>

      {/* 退出登录 */}
      <Card>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
        >
          退出登录
        </button>
      </Card>
    </div>
  );
}
