import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';

// 模拟复习单词列表（后续从状态计算艾宾浩斯复习列表）
const MOCK_REVIEW_WORDS = [
  { word: 'mother', meaning: '母亲' },
  { word: 'father', meaning: '父亲' },
  { word: 'brother', meaning: '兄弟' },
  { word: 'sister', meaning: '姐妹' },
  { word: 'friend', meaning: '朋友' },
];

type SelfAssessment = 'forgot' | 'vague' | 'known';

export function Review() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [results, setResults] = useState<SelfAssessment[]>([]);

  const word = MOCK_REVIEW_WORDS[currentIndex];
  const total = MOCK_REVIEW_WORDS.length;

  const handleAssessment = (assessment: SelfAssessment) => {
    setResults((prev) => [...prev, assessment]);
    setShowMeaning(false);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // 复习完成
      alert('复习完成！');
      navigate('/home');
    }
  };

  if (total === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-gray-800">复习</h1>
        <Card>
          <p className="text-gray-500 text-center py-8">今天没有需要复习的单词</p>
          <button onClick={() => navigate('/home')} className="w-full py-2.5 bg-primary-500 text-white rounded-lg">
            返回首页
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <button onClick={() => navigate('/home')} className="text-primary-500 mr-3 text-sm">
          &larr; 返回
        </button>
        <h1 className="text-lg font-bold text-gray-800">复习</h1>
      </div>

      <ProgressBar value={currentIndex} max={total} label="复习进度" />

      <Card className="text-center py-8">
        <p className="text-xs text-gray-400 mb-4">
          第 {currentIndex + 1}/{total} 个
        </p>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">{word.word}</h2>

        {!showMeaning ? (
          <button
            onClick={() => setShowMeaning(true)}
            className="px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm"
          >
            查看释义
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-lg text-gray-600">{word.meaning}</p>
            <p className="text-xs text-gray-400">自评：这个词你记住了吗？</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAssessment('forgot')}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm"
              >
                忘记
              </button>
              <button
                onClick={() => handleAssessment('vague')}
                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-lg text-sm"
              >
                模糊
              </button>
              <button
                onClick={() => handleAssessment('known')}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm"
              >
                认识
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
