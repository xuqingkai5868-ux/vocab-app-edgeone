import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import type { GrammarCard, GrammarStage as StageData } from '../types/study';

export function Grammar() {
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();
  const [stages, setStages] = useState<StageData[]>([]);
  const [current, setCurrent] = useState<GrammarCard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setFetchError(false);
    setCardIdx(0);
    setShowAnswer(false);
    fetch('/grammar_cards.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setStages(d.stages);
        const s = d.stages.find((s: StageData) => s.stage === Number(stageId));
        if (s && s.cards.length > 0) setCurrent(s.cards[0]);
      })
      .catch(e => {
        console.error('Failed to load grammar cards:', e);
        setFetchError(true);
      });
  }, [stageId]);

  // cardIdx 变化时同步 current
  useEffect(() => {
    const stage = stages.find(s => s.stage === Number(stageId));
    if (stage && stage.cards[cardIdx]) {
      setCurrent(stage.cards[cardIdx]);
    }
  }, [cardIdx, stages, stageId]);

  const handleNext = useCallback(() => {
    setShowAnswer(false);
    setCardIdx(prevIdx => prevIdx + 1);
  }, []);

  if (fetchError) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-3">语法卡片加载失败</p>
        <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">返回首页</button>
      </div>
    );
  }
  if (!stages.length || !current) return <Loading text="加载语法卡片..." />;

  const stage = stages.find(s => s.stage === Number(stageId));
  if (!stage) return <div className="p-4">阶段不存在</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-primary-500 text-sm">&larr; 返回</button>
        <div className="text-sm text-gray-500">阶段 {stage.stage} · {stage.name}</div>
        <div className="text-xs text-gray-400">{cardIdx + 1}/{stage.cards.length}</div>
      </div>

      <Card className="min-h-[300px]">
        <div className="text-center mb-4">
          <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
            {stage.level} · {stage.name}
          </span>
        </div>

        {!showAnswer ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{current.title}</h2>
            <button
              onClick={() => setShowAnswer(true)}
              className="px-6 py-2.5 bg-primary-500 text-white rounded-lg"
            >
              查看语法规则 📖
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{current.title}</h2>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-line">{current.rule}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">例句：</p>
              {current.examples.map((ex, i) => (
                <p key={i} className="text-sm text-gray-700 mb-1">• {ex}</p>
              ))}
            </div>
            {current.note && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs text-yellow-700">💡 {current.note}</p>
              </div>
            )}
            <div className="text-xs text-gray-400">
              📘 参考：{current.pdf_ref}
            </div>
          </div>
        )}
      </Card>

      {showAnswer && (
        <button onClick={handleNext} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium">
          {cardIdx < stage.cards.length - 1 ? '下一个语法点 →' : '完成 ✓'}
        </button>
      )}
    </div>
  );
}
