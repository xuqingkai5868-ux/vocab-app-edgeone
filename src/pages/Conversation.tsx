import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { sendMessage } from '../services/ai/aiService';
import { AIMessage } from '../services/ai/types';

const SCENARIOS = [
  { id: 'daily', label: '日常对话' },
  { id: 'campus', label: '校园场景' },
  { id: 'interview', label: '面试场景' },
  { id: 'travel', label: '旅行场景' },
  { id: 'shopping', label: '购物场景' },
];

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  introducedWords?: { word: string; meaning: string }[];
}

export function Conversation() {
  const navigate = useNavigate();
  const { todayNewWords } = useApp();
  const [scenario, setScenario] = useState('daily');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState<{ apiKey: string; model: string; endpoint: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // 从 localStorage 尝试读取 AI 配置
    const saved = localStorage.getItem('vocab_ai_config');
    if (saved) {
      try {
        setAiConfig(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const startConversation = async () => {
    if (!aiConfig?.apiKey) {
      navigate('/settings');
      return;
    }
    setLoading(true);
    const targetWords = todayNewWords.map((w) => w.word);
    try {
      const result = await sendMessage(
        {
          messages: [],
          scenario,
          targetWords,
          knownWords: [],
          userLevel: 'beginner',
        },
        aiConfig
      );
      setMessages([{ role: 'ai', content: result.content, introducedWords: result.introducedWords }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 响应失败';
      setMessages([{ role: 'ai', content: `错误: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendUserMessage = async () => {
    if (!input.trim() || !aiConfig) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const aiMessages: AIMessage[] = updatedMessages.map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    try {
      const result = await sendMessage(
        {
          messages: aiMessages,
          scenario,
          targetWords: todayNewWords.map((w) => w.word),
          knownWords: [],
          userLevel: 'beginner',
        },
        aiConfig
      );
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: result.content, introducedWords: result.introducedWords },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 响应失败';
      setMessages((prev) => [...prev, { role: 'ai', content: `错误: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!aiConfig) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-gray-800">AI 对话</h1>
        <Card>
          <p className="text-gray-500 text-center py-8">
            请先在设置页面配置 API Key
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-2.5 bg-primary-500 text-white rounded-lg"
          >
            前往设置
          </button>
        </Card>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-gray-800">AI 对话</h1>
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-2">选择场景</label>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`py-2 px-3 rounded-lg text-sm ${
                  scenario === s.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={startConversation}
            disabled={loading}
            className="mt-4 w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? 'AI 回复中...' : '开始对话'}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate('/home')} className="text-primary-500 mr-3 text-sm">
          &larr; 返回
        </button>
        <h1 className="text-lg font-bold text-gray-800">
          {SCENARIOS.find((s) => s.id === scenario)?.label || '对话'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.introducedWords && msg.introducedWords.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-1">新词:</p>
                  {msg.introducedWords.map((w, j) => (
                    <span
                      key={j}
                      className="inline-block mr-1 mb-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                      title={w.meaning}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入栏 */}
      <div className="flex gap-2 bg-white p-2 rounded-xl border border-gray-200">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendUserMessage()}
          placeholder="输入你的回复..."
          className="flex-1 px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={sendUserMessage}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
