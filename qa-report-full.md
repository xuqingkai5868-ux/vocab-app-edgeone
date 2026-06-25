# PET Vocab App 代码审核报告

> 审核时间：2026-06-25
> 审核范围：前端 17 个核心文件 + 后端 8 个文件 + 页面 10 个 + 组件/配置 8 个
> 共发现问题：**P0 × 3，P1 × 28，P2 × 40+

---

## 一、P0 — 致命问题（必须立即修复）

### P0-1：家长密码硬编码在前端源码
**文件**：`src/pages/Settings.tsx:32`
```js
const PARENT_PASSWORD = 'scdq';
```
密码明文写在客户端 JS bundle 中，任何人 F12 查看源码即可获取。孩子可以直接看到密码绕过家长验证，修改每日学习量、重置进度。"家长管控"功能形同虚设。

**修复方向**：将验证逻辑移至后端 API，前端只发送密码给服务器校验，不存储明文。

---

### P0-2：`updateWordStates` 在 useState updater 中执行副作用 + 非空断言
**文件**：`src/contexts/AppContext.tsx:150-178`
```tsx
let prevForRollback: UserState | null = null;
setUserState(prev => {
  prevForRollback = prev;  // 副作用写在 updater 里
  ...
});
const merged = { ...prevForRollback!.states };  // 非空断言，可能为 null
```
React 的 useState updater 不保证在 `setUserState` 返回前同步执行。`prevForRollback` 极可能仍为 `null`，触发 `TypeError` 崩溃。且项目启用了 `React.StrictMode`，updater 被调用两次，回滚时回滚到错误状态。

**修复方向**：改用 `useRef` 暂存上次 state，或先从 `userState` 闭包值计算 merged 再 `setUserState`。

---

### P0-3：连续打卡（streak）跨月归零
**文件**：`src/api/stats.ts:29-50` + `src/services/checkIn/streakCalculator.ts:4-30`

streak 计算只获取**当月**打卡数据。月初 1 号时 records 只有当月数据，上月累积的连续天数全部丢失。若用户上月 28-30 号连续打卡，1 号查看 → streak = 0 或 1。

**修复方向**：获取上月+本月合并数据计算；起点允许今天或昨天（今天未打卡不立即归零）。

---

## 二、P1 — 重要问题（建议尽快修复）

### P1-1：活动追踪 key 不匹配，三个页面学习时长永远为 0
**文件**：`Study.tsx:67-68`、`Review.tsx:43-45`、`Dictation.tsx:82-84`

| 文件 | startTracking | stopTracking | 结果 |
|------|--------------|--------------|------|
| Study | `startTracking('study')` | `stopTracking('study', ...)` | ❌ 失效 |
| Review | `startTracking('review_definition')` | `stopTracking('review_definition')` | ❌ 失效 |
| Dictation | `startTracking(trackType)` | `stopTracking(trackType)` | ❌ 失效 |

根因：`startTracking(type, key='default')` 第一个参数是 type，key 默认 `'default'`；`stopTracking(key, details)` 第一个参数是 key。调用者误将 type 当作 key 传入，找不到 tracker 直接 return。**学习时长永远不会被上报**，Settings 页面"今日学习报告"永远显示 0。

---

### P1-2：Web Speech 语音永不加载
**文件**：`src/services/utils/speak.ts:49-71`

```ts
function ensureEnglishVoice(): void {
  if (!window.speechSynthesis || voiceLoadAttempted) return;
  voiceLoadAttempted = true;  // 置 true 后永不重试
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;  // Chrome 首次返回空
  ...
}
```
首次调用时 voices 尚未异步加载（Chrome 首次 `getVoices()` 返回空），`voiceLoadAttempted` 被置 true 后永久跳过。**Web Speech 降级路径无语音可用**。

---

### P1-3：调整 `wordsPerDay` 导致用户卡死
**文件**：`src/services/utils/petVocabLoader.ts:53-63` + `AppContext.tsx:180`

用户从 30 词/天学到 Day 80，改成 50 词/天 → `totalDays` 从 90 变为 54 → `currentDay=80 > totalDays=54` → `getDayWords(80, 50)` 越界返回空数组 → `todayNewWords=[]` → `isTodayComplete=false` → **用户永久卡死，无法推进**。

---

### P1-4：登出后旧用户数据残留（跨用户数据泄漏）
**文件**：`src/contexts/AuthContext.tsx:52-56` + `AppContext.tsx`

`logout()` 只清 `user`/`token`，但 `AppContext` 的 `userState`/`checkIns`/`streak` 仍保留用户 A 的值。用户 B 登录后、`loadAll` 完成前会看到用户 A 的学习进度与打卡记录。

---

### P1-5：Token 过期未校验，不自动登出
**文件**：`src/contexts/AuthContext.tsx:25-41` + `src/api/client.ts:51-60`

启动时只检查 token 是否存在，**不检查 `expiresAt`**。过期 token 导致 API 持续 401，但 `isLoggedIn` 仍为 true，用户卡在"已登录但所有请求失败"状态。`client.ts` 收到 401 也不触发登出。

---

### P1-6：`loadAll` 无并发去重，竞态导致旧数据覆盖新数据
**文件**：`src/contexts/AppContext.tsx:63-98`

`visibilitychange`、`setInterval(60s)` 和用户手动调用都会触发 `loadAll`，三者可能并发。两个 `loadAll` 并发返回时，后完成的用陈旧数据覆盖先完成的新数据。

---

### P1-7：Review 页面每次状态变化重新洗牌
**文件**：`src/pages/Review.tsx:26-34`
```js
const reviewWords = useMemo(() => { ...shuffle... }, [state.states]);
```
`updateWordStates` 后 `state.states` 变化 → `reviewWords` 重新洗牌 → `currentIndex` 指向的单词变了。用户可能重复看到已复习的词，或跳过未复习的词。

---

### P1-8：Dictation 恢复进度时不还原 mode
**文件**：`src/pages/Dictation.tsx:45-60`

保存时存了 `mode`（'today'/'past'），恢复时始终初始化为 `'today'`。若保存时 mode='past'，恢复后 words 用 today 的词，但 `currentIdx` 和 `results` 是基于 past 词列表的 → **错位，用户看到的词和已答结果对不上**。

---

### P1-9：活动追踪跨用户泄漏
**文件**：`src/services/activity/activityTracker.ts:6`

用户 A `startTracking` 后未 `stop` 就登出，`trackers.default` 仍存 A 的 `startTime`。用户 B 登录后 `stopTracking` → 用 A 的 `startTime` 计算时长 → **上报到 B 的账户**。

---

### P1-10：页面卸载时活动记录丢失
**文件**：`src/services/activity/activityTracker.ts:23-46`

`stopTracking` 内 `await logActivity`（fetch）在页面卸载时被浏览器取消，**最后一条记录丢失**。应用 `navigator.sendBeacon`。

---

### P1-11：重复打卡未拦截
**文件**：`src/services/checkIn/checkInService.ts:4-17` + `AppContext.tsx:188`

`doCheckIn` 不检查今天是否已打卡。用户一天可多次调用 `createCheckIn`，产生多条当日记录，统计 `totalDays` 虚高。

---

### P1-12：PIN 无暴力破解防护
**文件**：`edge-functions/api/login.js:36`

4 位 PIN 仅 10000 种组合，无登录失败次数限制或锁定。攻击者可在数秒内暴力破解。

---

### P1-13：TTS 端点完全开放
**文件**：`edge-functions/api/tts.js` + `middleware.js:33`

`/api/tts` 无需认证，任何人可调用。这是一个开放代理，可被滥用消耗 EdgeOne 配额，或用于 DDoS Google TTS。

---

### P1-14：TTS `lang` 参数未 URL 编码
**文件**：`edge-functions/api/tts.js:51`
```js
const url = `...&tl=${lang}&client=tw-ob`;
```
若 `lang='en&client=attacker'`，注入额外查询参数。应改为 `encodeURIComponent(lang)` + 白名单校验。

---

### P1-15：state.js 字符串数字值被错误归零
**文件**：`edge-functions/api/state.js:62-74`

前端若传入字符串 `"3"`（序列化误差），落入 `else` 分支变成 `0`，**丢失用户学习进度**。应增加字符串数字转换分支。

---

### P1-16：Grammar 页面 fetch 无错误处理
**文件**：`src/pages/Grammar.tsx:15-23`

fetch 无 `.catch()`，网络失败或 JSON 解析错误时 `stages` 永远为空 → **永久 Loading，用户卡死**。

---

### P1-17：local-server summary 使用过时字符串状态比较
**文件**：`local-server.js:227-228`
```js
const mastered = Object.values(state.states).filter(v => v === 'mastered').length;
```
应用已迁移为数字等级，但这里仍比较字符串。本地开发 summary 接口永远返回 0。

---

### P1-18：`speakWithWebSpeech` 连续调用 Promise 永不 resolve
**文件**：`src/services/utils/speak.ts:87,107`

连续调用 `speakWord`：第二次 `cancel()` 打断第一次的 utterance，被打断的 `onend` 不触发，第一次的 `Promise` **永久挂起**，`await` 泄漏。

---

### P1-19：`onvoiceschanged` 多处直接赋值互相覆盖
**文件**：`src/services/utils/speak.ts:100-103,177-185`

`speakWithWebSpeech` 与 `warmUpTTS` 都直接赋值 `window.speechSynthesis.onvoiceschanged`，后者覆盖前者。应使用 `addEventListener`。

---

## 三、P2 — 建议改进（择机修复）

### 性能优化
| # | 文件 | 问题 |
|---|------|------|
| P2-1 | `AppContext.tsx:233` | Context value 未 memo，每次渲染新建对象，所有消费者无条件重渲染 |
| P2-2 | `Study.tsx:71-72` | `getDayWords`/`getDayPhrases` 每次渲染调用，未 useMemo |
| P2-3 | `Review.tsx:13-16` | `MASTER_WORDS.find` 每次 O(n) 查找，应建 Map 索引 |
| P2-4 | `WrongWords.tsx:13-22` | 循环内 `find` O(n*m)，应建 Map |
| P2-5 | `stats.ts:29-33` | `getCheckIns` 与 `getState` 串行，可 Promise.all 并行 |
| P2-6 | `tts.ts:80-84` | 内存缓存按条数限制而非字节数，移动端可能占数十 MB |
| P2-7 | `Home.tsx:117-123` | 多次 `filter` 未 memo 化 |
| P2-8 | `petVocabLoader.ts:80-96` | `searchWords` O(N) 全量遍历，每次重复 slice |

### 安全加固
| # | 文件 | 问题 |
|---|------|------|
| P2-9 | `client.ts` | 查询参数未 `encodeURIComponent` |
| P2-10 | `respond.js:9` | 通配符 CORS `*`，生产建议限制域名 |
| P2-11 | `login.js:48` | session token 明文存储 KV，建议存哈希 |
| P2-12 | `middleware.js:41` | Bearer 前缀检查大小写敏感，与 verifyToken 不一致 |
| P2-13 | `local-server.js:277` | 静态文件路径缺少遍历防护 `..` |
| P2-14 | `tts.js:97` | TTS 端点 `Allow-Origin: *` 配合无认证 |

### 类型安全
| # | 文件 | 问题 |
|---|------|------|
| P2-15 | `types/word.ts:10` | `difficultyLevel: 1|2|3|4|5` 与应用 0-4 体系不一致 |
| P2-16 | `types/study.ts:7` | `reviewStage` 含 5，应用最高 4 |
| P2-17 | `activity.ts:30` | `logActivity` 的 `type` 为 `string` 而非联合类型 |
| P2-18 | `types/word.ts:27-33` | 遗留枚举值（postgraduate/ielts/toefl）未清理 |
| P2-19 | `petVocabLoader.ts:18` | `scheduleData as any` 丢失类型安全 |

### 健壮性
| # | 文件 | 问题 |
|---|------|------|
| P2-20 | `AppContext.tsx:48` | `parseInt(wordsPerDay)` 未校验 NaN |
| P2-21 | `AuthContext.tsx:29` | `JSON.parse(vocab_user)` 无结构校验 |
| P2-22 | `AppContext.tsx:150` | tts.ts 并发去重 `finally` 误删后续 pending entry |
| P2-23 | `Dictation.tsx:246` | `total=0` 时除零得 NaN，界面显示 "NaN%" |
| P2-24 | `Dictation.tsx:318` | `current!.word` 非空断言可能崩溃 |
| P2-25 | `Study.tsx:128,152` | setTimeout 未在 unmount 时清理 |
| P2-26 | `client.ts` | 无请求超时，弱网下 fetch 可能长时间挂起 |
| P2-27 | `state.js:54` | `typeof states !== 'object'` 无法排除数组 |

### UX/交互
| # | 文件 | 问题 |
|---|------|------|
| P2-28 | `BottomNav.tsx:24` | 精确匹配导致子路由无高亮，/dictation 等无选中状态 |
| P2-29 | `BottomNav.tsx:22` | navigate 不用 replace，历史栈累积 |
| P2-30 | `Review.tsx:61` | 用 `alert()` 提示完成，阻塞 UI |
| P2-31 | `WrongWords.tsx` | 听写结果不持久化、不更新词状态，对了也不从错词本移除 |
| P2-32 | `Vocabulary.tsx` | 缺少发音功能和活动追踪 |
| P2-33 | `Login.tsx:50` | 前端限制 PIN 4 位，后端允许 4-8 位 |
| P2-34 | `App.tsx` | 缺少全局 Error Boundary，异常白屏 |
| P2-35 | `sw.js:98-112` | `cacheFirstWithUpdate` 名不副实，命中时不后台更新 |
| P2-36 | `App.css:5-9` | 全局 `*` reset 与 Tailwind preflight 冲突 |
| P2-37 | `App.css:24-26` | 全局 `button:active { transform: scale(0.97) }` 与组件级冲突 |

### 代码一致性
| # | 文件 | 问题 |
|---|------|------|
| P2-38 | `stats.ts:36` vs `streakCalculator.ts` | 两套 streak 实现，逻辑重复且不一致 |
| P2-39 | `local-server.js:201` | PUT 未做状态归一化，与生产行为不一致 |
| P2-40 | `AuthContext.tsx:6` + `Login.tsx:4` | 用户列表两处硬编码，修改易遗漏 |

---

## 四、修复优先级建议

### 第一批（数据安全 + 崩溃）
1. P0-1 家长密码移后端
2. P0-2 updateWordStates 副作用崩溃
3. P0-3 streak 跨月归零
4. P1-1 活动追踪 key 修复（一行改动）
5. P1-3 wordsPerDay 越界卡死
6. P1-4 登出数据残留
7. P1-15 state.js 字符串数字归零

### 第二批（功能正确性）
8. P1-7 Review 洗牌改为挂载时一次
9. P1-8 Dictation 恢复 mode
10. P1-11 重复打卡拦截
11. P1-16 Grammar fetch 错误处理
12. P1-2 Web Speech 语音加载
13. P1-5 Token 过期自动登出

### 第三批（安全加固）
14. P1-12 PIN 暴力破解防护
15. P1-13 TTS 端点认证
16. P1-9 活动追踪跨用户泄漏
17. P1-10 卸载时 sendBeacon

### 第四批（性能 + 健壮性 + UX）
18. P2-1~P2-8 性能优化
19. P2-20~P2-27 边界处理
20. P2-28~P2-37 交互改进
