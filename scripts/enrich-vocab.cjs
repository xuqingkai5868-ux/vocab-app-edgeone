/**
 * enrich-vocab.cjs
 * 调用 DeepSeek API 批量生成 PET 词汇例句 + 中文翻译
 * 追加到 pet_schedule_v2.json
 *
 * 用法: DEEPSEEK_KEY=sk-xxx node scripts/enrich-vocab.cjs
 * 环境变量: DEEPSEEK_KEY (必填)
 */

const fs = require('fs');
const path = require('path');

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
if (!DEEPSEEK_KEY) {
  console.error('❌ 请设置 DEEPSEEK_KEY 环境变量');
  console.error('   DEEPSEEK_KEY=sk-xxx node scripts/enrich-vocab.cjs');
  process.exit(1);
}
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const BATCH_SIZE = 50;       // 每批 50 词
const DELAY_MS = 800;        // 批间延迟避免限流

// === 读取词库 ===
const srcPath = path.join(__dirname, '..', 'public', 'pet_schedule_v2.json');
const outPath = path.join(__dirname, '..', 'public', 'pet_schedule_v2.json');

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
const schedule = raw.schedule;

// 拉平所有词
const allWords = [];
for (const d of schedule) {
  for (const w of d.words) {
    if (!w.example) { // 只处理没有例句的词
      allWords.push(w);
    }
  }
}

console.log(`总词数: ${allWords.length}，批次大小: ${BATCH_SIZE}，共 ${Math.ceil(allWords.length / BATCH_SIZE)} 批`);

// 分批
function batch(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

const batches = batch(allWords, BATCH_SIZE);
let completed = 0;
let failed = 0;

async function processBatch(words, batchIdx) {
  const wordList = words.map((w, i) => `${i + 1}. "${w.word}" (${w.pos}, 含义: ${w.meaning})`).join('\n');

  const prompt = `你是 PET（Preliminary English Test）英语辅导老师。请为以下每个 PET 词汇生成一个**适合初中生水平的英语例句**及其**中文翻译**。

要求：
- 例句用词简单自然，符合 PET 考试难度（CEFR A2-B1）
- 中文翻译准确通顺
- 每个词只生成一句例句 + 一条翻译
- 不要添加额外说明

词汇列表：
${wordList}

请严格按以下 JSON 格式返回一个数组（不要 Markdown 包裹）：
[
  { "example": "I have a pain in my neck.", "translation": "我脖子疼。" },
  ...
]`;

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON（处理可能的 Markdown 包裹）
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const results = JSON.parse(jsonStr);

    if (!Array.isArray(results) || results.length !== words.length) {
      throw new Error(`返回数量不匹配: 期望 ${words.length}，实际 ${results?.length}`);
    }

    for (let i = 0; i < words.length; i++) {
      words[i].example = results[i].example;
      words[i].translation = results[i].translation;
    }

    completed += words.length;
    const pct = ((completed / allWords.length) * 100).toFixed(1);
    console.log(`[${batchIdx + 1}/${batches.length}] ✅ ${words.length} 词完成 (${completed}/${allWords.length}, ${pct}%)`);
    
    // 每 5 批保存一次
    if ((batchIdx + 1) % 5 === 0 || batchIdx === batches.length - 1) {
      fs.writeFileSync(outPath + '.tmp', JSON.stringify(raw, null, 2), 'utf-8');
      fs.renameSync(outPath + '.tmp', outPath);
      console.log(`  📝 已保存到 ${outPath}`);
    }
  } catch (e) {
    failed += words.length;
    console.error(`[${batchIdx + 1}/${batches.length}] ❌ 批次失败: ${e.message}`);
    // 失败批次的词不做标记，下次运行会重新处理
  }
}

(async () => {
  console.time('总耗时');
  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i);
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
  console.timeEnd('总耗时');
  console.log(`\n完成! 成功: ${completed}, 失败: ${failed}`);
  console.log(`输出文件: ${outPath}`);
})();
