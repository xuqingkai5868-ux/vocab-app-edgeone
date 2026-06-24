// 语音朗读工具 — 使用浏览器 Web Speech API
// 所有页面统一使用此函数，避免重复代码

// 常见英文缩写 → 完整发音映射
// TTS 引擎遇到 "Mr" 会逐字母读成 "M R"，需要先展开为 "Mister"
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

// 缓存已加载的英语语音，避免每次重新查找
let cachedEnglishVoice: SpeechSynthesisVoice | null = null;
let voiceLoadAttempted = false;

/** 尝试加载并缓存一个英语语音 */
function ensureEnglishVoice(): void {
  if (!window.speechSynthesis || voiceLoadAttempted) return;
  voiceLoadAttempted = true;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedEnglishVoice =
      voices.find(v => v.lang.startsWith('en') && v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];
  }
}

/** 展开文本中的缩写，确保 TTS 正确发音 */
function normalizeForTTS(text: string): string {
  // 按单词拆分，保留空格和标点
  return text.replace(/\b\w+(\.)?\b/g, (match) => {
    const key = match.toLowerCase().replace(/\.$/, '');
    if (ABBREVIATION_MAP[key]) {
      // 保持原大小写风格
      const expanded = ABBREVIATION_MAP[key];
      // 如果原词是大写开头，用展开词的原文
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return expanded;
      }
      return expanded.toLowerCase();
    }
    return match;
  });
}

// 保持 utterance 引用，防止移动端浏览器 GC 回收导致无法发音
let lastUtterance: SpeechSynthesisUtterance | null = null;

/**
 * 语音朗读
 * 兼容 Android Chrome 的方案：
 * 1. 预加载语音列表 & 选中英语语音（Android 上语音列表是异步加载的）
 * 2. speak() 前先 cancel() 清空队列，避免冲突
 * 3. 保持 utterance 引用防止 GC
 * 4. 在首次用户交互时主动"唤醒" TTS 引擎
 */
export function speakWord(word: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // 1. 尝试加载英语语音（如果还没加载过）
  if (!cachedEnglishVoice) {
    ensureEnglishVoice();
    // 如果还没加载到，绑定 voiceschanged 事件
    if (!cachedEnglishVoice && !voiceLoadAttempted) {
      voiceLoadAttempted = true;
      window.speechSynthesis.onvoiceschanged = () => {
        ensureEnglishVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }

  // 2. 清空之前的语音队列
  window.speechSynthesis.cancel();

  // 3. 展开缩写并创建 utterance
  const normalized = normalizeForTTS(word);
  const utterance = new SpeechSynthesisUtterance(normalized);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  // 4. 显式设置语音（Android 上关键：默认语音可能不支持英语）
  if (cachedEnglishVoice) {
    utterance.voice = cachedEnglishVoice;
  }

  // 5. 保持引用，防止 GC（Android Chrome 已知 bug）
  lastUtterance = utterance;
  utterance.onend = () => { lastUtterance = null; };
  utterance.onerror = () => { lastUtterance = null; };

  // 6. 发音
  window.speechSynthesis.speak(utterance);
}

/**
 * 唤醒 TTS 引擎（在页面首次用户交互时调用一次即可）
 * 部分 Android 设备需要先"暖机"才能正常发音
 */
let ttsWarmedUp = false;
export function warmUpTTS(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis || ttsWarmedUp) return;
  ttsWarmedUp = true;

  // 先尝试加载语音列表
  ensureEnglishVoice();
  if (!window.speechSynthesis.onvoiceschanged) {
    window.speechSynthesis.onvoiceschanged = () => {
      ensureEnglishVoice();
      // 用空字符唤醒引擎
      const wake = new SpeechSynthesisUtterance(' ');
      if (cachedEnglishVoice) wake.voice = cachedEnglishVoice;
      wake.volume = 0;  // 静音唤醒，用户无感知
      window.speechSynthesis.speak(wake);
      window.speechSynthesis.onvoiceschanged = null;
    };
    // 部分浏览器 onvoiceschanged 不会触发，手动触发一次
    setTimeout(() => {
      ensureEnglishVoice();
      if (window.speechSynthesis.onvoiceschanged) {
        (window.speechSynthesis.onvoiceschanged as () => void)();
      }
    }, 100);
  }
}
