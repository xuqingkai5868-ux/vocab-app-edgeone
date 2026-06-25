// ===== 混合语音朗读服务 =====
// 策略（方案 D）：
//   1. 优先调用 EdgeOne Function TTS 代理（Google TTS → 高音质）
//   2. 失败后降级到浏览器 Web Speech API（离线可用）
//
// speakWord() 对外接口不变，所有使用者无需修改

import { fetchTtsAudio, playAudioBuffer } from '../../api/tts';

// ========== Web Speech API 降级层 ==========

// 常见英文缩写 → 完整发音映射
const ABBREVIATION_MAP: Record<string, string> = {
  'mr': 'Mister',
  'mrs': 'Missus',
  'ms': 'Miz',
  'dr': 'Doctor',
  'st': 'Saint',
  'dept': 'Department',
  'apt': 'Apartment',
  'vs': 'versus',
  'etc': 'et cetera',
  'e.g.': 'for example',
  'i.e.': 'that is',
};

// 语音优先级列表（按自然度从高到低）
// Windows 10/11 如果安装了"Microsoft 简宁自然"或"Microsoft Mark Natural"等神经语音，优先使用
// macOS: Samantha, Karen, Daniel 等比较自然
// 通用: Google UK English Female, Google US English
const VOICE_PRIORITY_PATTERNS = [
  // Windows 神经语音（最自然）
  /Microsoft.*(?:Natural|Neural|Online)/i,
  /Microsoft.*(?:David|Zira|Mark)/i,
  // macOS 优质语音
  /Samantha/i,
  /Karen/i,
  /Daniel/i,
  /Moira/i,
  // Google 语音（Android）
  /Google UK English/i,
  /Google US English/i,
  /Google.*English/i,
  // 任意英语语音兜底
  /en[-_]?(?:US|GB|AU|CA|IN)/i,
];

let cachedEnglishVoice: SpeechSynthesisVoice | null = null;
let voiceLoadAttempted = false;

function ensureEnglishVoice(): void {
  if (!window.speechSynthesis || voiceLoadAttempted) return;
  voiceLoadAttempted = true;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;

  // 按优先级找到第一个匹配的英语语音
  for (const pattern of VOICE_PRIORITY_PATTERNS) {
    const found = voices.find(v => v.lang.startsWith('en') && pattern.test(v.name));
    if (found) {
      cachedEnglishVoice = found;
      return;
    }
  }

  // 兜底：任何本地英语语音
  cachedEnglishVoice =
    voices.find(v => v.lang.startsWith('en') && v.localService) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0];
}

function normalizeForTTS(text: string): string {
  return text.replace(/\b\w+(\.)?\b/g, (match) => {
    const key = match.toLowerCase().replace(/\.$/, '');
    if (ABBREVIATION_MAP[key]) {
      const expanded = ABBREVIATION_MAP[key];
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return expanded;
      }
      return expanded.toLowerCase();
    }
    return match;
  });
}

let lastUtterance: SpeechSynthesisUtterance | null = null;

function speakWithWebSpeech(word: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Web Speech API 不可用'));
      return;
    }

    if (!cachedEnglishVoice) {
      ensureEnglishVoice();
      if (!cachedEnglishVoice && !voiceLoadAttempted) {
        voiceLoadAttempted = true;
        window.speechSynthesis.onvoiceschanged = () => {
          ensureEnglishVoice();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }

    window.speechSynthesis.cancel();

    const normalized = normalizeForTTS(word);
    const utterance = new SpeechSynthesisUtterance(normalized);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (cachedEnglishVoice) {
      utterance.voice = cachedEnglishVoice;
    }

    lastUtterance = utterance;
    utterance.onend = () => { lastUtterance = null; resolve(); };
    utterance.onerror = (e) => { lastUtterance = null; reject(e); };

    window.speechSynthesis.speak(utterance);
  });
}

// ========== 混合语音播放 ==========

// 统计：记录不同路径的使用次数，方便后续优化决策
const stats = { api: 0, fallback: 0, failed: 0 };

/**
 * 朗读单词（混合模式）
 * 1. 尝试 EdgeOne TTS 代理（Google TTS）
 * 2. 失败或超时 → 降级到 Web Speech API
 * 3. 再失败 → 静默忽略（不抛异常到 UI 层）
 */
export async function speakWord(word: string): Promise<void> {
  if (!word || typeof window === 'undefined') return;

  // 先尝试 API TTS（高音质）
  const result = await fetchTtsAudio(word, 'en');
  if (result.success && result.audio) {
    try {
      await playAudioBuffer(result.audio);
      stats.api++;
      return;
    } catch {
      // 播放失败，走降级
      stats.failed++;
    }
  }

  // 降级到 Web Speech API
  stats.fallback++;
  try {
    await speakWithWebSpeech(word);
  } catch {
    // 静默忽略，毕竟学单词 app 不能因为发音问题打断学习流程
    console.warn(`[speak] Web Speech 也失败了: "${word}"`);
  }
}

// ========== 兼容原接口（warmUpTTS）==========

let ttsWarmedUp = false;
export function warmUpTTS(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis || ttsWarmedUp) return;
  ttsWarmedUp = true;

  // 优先尝试 API TTS 暖机（发个空请求预热缓存）
  fetchTtsAudio('hello', 'en').catch(() => {});

  // 同时预热 Web Speech 作为降级
  ensureEnglishVoice();
  if (!window.speechSynthesis.onvoiceschanged) {
    window.speechSynthesis.onvoiceschanged = () => {
      ensureEnglishVoice();
      const wake = new SpeechSynthesisUtterance(' ');
      if (cachedEnglishVoice) wake.voice = cachedEnglishVoice;
      wake.volume = 0;
      window.speechSynthesis.speak(wake);
      window.speechSynthesis.onvoiceschanged = null;
    };
    setTimeout(() => {
      ensureEnglishVoice();
      if (window.speechSynthesis.onvoiceschanged) {
        (window.speechSynthesis.onvoiceschanged as () => void)();
      }
    }, 100);
  }
}

/** 获取发音统计（调试用） */
export function getSpeakStats() {
  return { ...stats };
}
