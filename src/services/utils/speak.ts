// 语音朗读工具 — 使用浏览器 Web Speech API
// 所有页面统一使用此函数，避免重复代码

export function speakWord(word: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;  // 稍慢，适合小孩
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
