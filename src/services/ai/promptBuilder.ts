import { AIMessage } from './types';

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  daily: '日常对话（日常生活、兴趣爱好、天气、食物等）',
  campus: '校园场景（课堂讨论、图书馆、社团活动、考试）',
  interview: '面试场景（自我介绍、职业规划、技能展示）',
  travel: '旅行场景（订酒店、问路、点餐、购物）',
  shopping: '购物场景（挑选商品、询价、退换货）',
};

export function buildSystemPrompt(
  targetWords: string[],
  scenario: string,
  knownWords: string[],
  userLevel?: string
): string {
  const scenarioDesc = SCENARIO_DESCRIPTIONS[scenario] || SCENARIO_DESCRIPTIONS.daily;
  const levelHint = userLevel ? `用户当前英语水平：${getLevelDescription(userLevel)}。` : '';

  const targetWordsSection = targetWords.length > 0
    ? `\n请在对话中自然地引入以下目标单词，每次回复引入 1-2 个，确保在上下文中使用：\n${targetWords.map((w) => `- ${w}`).join('\n')}`
    : '';

  const knownWordsSection = knownWords.length > 0
    ? `\n以下单词用户已掌握，请避免重复介绍：\n${knownWords.join(', ')}`
    : '';

  return `你是"单词盒子"AI英语学习助手，正在与用户进行${scenarioDesc}。

## 核心任务
1. **自然对话**：用英语与用户进行自然、有趣的${scenarioDesc}对话
2. **引入单词**：在对话中自然引入今日目标单词
3. **纠正错误**：发现用户表达有误时，温和地纠正
4. **难度适配**：根据用户水平调整语言复杂度

${levelHint}

## 对话规则
- 优先使用英语回复，必要时可用中文解释
- 每次回复控制在 3-5 句
- 当引入新单词时，在回复后附加标记：
  <introduced_words>
  {"word": "单词", "meaning": "中文释义", "phonetic": "/音标/", "partOfSpeech": "词性", "example": "例句", "isTargetWord": true/false}
  </introduced_words>
- 当纠正用户表达时，附加标记：
  <correction>
  {"original": "用户原文", "corrected": "纠正后文本", "explanation": "解释为什么这样改"}
  </correction>
- 如果用户用中文回复，可以先用中文回应，再引导用户尝试用英语表达

${targetWordsSection}
${knownWordsSection}

记住：你是友好、耐心的英语学习伙伴，让学习过程轻松愉快！`;
}

function getLevelDescription(level: string): string {
  switch (level) {
    case 'beginner':
      return '初级，仅掌握基础词汇和简单句型';
    case 'intermediate':
      return '中级，能进行日常对话，需要扩展词汇量';
    case 'advanced':
      return '高级，能流利交流，需要精炼表达';
    default:
      return '中级';
  }
}

export function buildPrompt(
  messages: AIMessage[],
  targetWords: string[],
  knownWords: string[],
  scenario: string,
  userLevel?: string
): AIMessage[] {
  const systemPrompt = buildSystemPrompt(targetWords, scenario, knownWords, userLevel);
  return [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
}
