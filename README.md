# talkbase · 把会议变成可检索的记忆

> 导入一场会议 / 一节课的转写稿 → 自动生成结构化总结 → 对着它提问，回答带原文时间戳。
> 本地优先、零配置可跑：**不配 API Key 也能完整体验**（走本地规则演示模式）。

一个 Next.js 全栈应用：App Router + Route Handlers + 流式响应，数据落在本地一个 JSON 文件里，换 Postgres 只需改一层。

## 为什么做这个

录音转文字已经不稀缺了（作者另一个项目 [meeting-note-app](https://github.com/zhengxiyu880-ui/meeting-note-app)
就在本机离线做这件事）。真正麻烦的是**转完之后**：

- 一小时会议的转写稿有几千字，你只会看一次，然后永远想不起来谁答应了什么
- 想找「上次说的那个截止时间」只能全文搜索，搜到了也不知道在什么上下文里
- 通用聊天机器人不知道你的会议内容，问它等于让它编

所以这个项目的重点不在转写，而在**转写之后的三件事**：结构化总结、基于原文的问答、可追溯的时间戳引用。

## 快速开始

```bash
git clone https://github.com/zhengxiyu880-ui/talkbase.git
cd talkbase
npm install
npm run dev          # http://localhost:3000
```

首次启动会自动写入两场演示数据（一场产品评审会、一节高数课），
首页点「填一份产品评审会」→「导入并打开」就能走完整流程，**不需要任何 API Key**。

### 接入真实模型

任何 OpenAI 兼容服务都行，复制 `.env.example` 为 `.env.local`：

```bash
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com   # 换服务商只改这一行
OPENAI_MODEL=deepseek-chat
```

配好之后右上角的角标会从「演示模式」变成「已接入大模型」，总结与问答走真实模型。
DeepSeek / 通义 / Kimi / 智谱 / OpenRouter 都可以，常用地址在 `.env.example` 里给了注释。

## 两种模式的区别

| | 演示模式（无 Key） | 接入模型 |
| --- | --- | --- |
| 总结 | 本地规则抽取（挑出含「决定 / 负责 / 截止 / 风险」的句子） | LLM 生成，四个固定小节 |
| 问答 | 直接返回检索到的最相关原文片段 | 以检索片段为上下文生成，要求标注 `[mm:ss]` |
| 联网 | 不需要 | 需要 |
| 用途 | 让 clone 下来的人立刻看到产品长什么样 | 真实使用 |

演示模式的输出在界面上会**明确标注**是规则抽取，不会假装成模型输出。

## 功能

- **导入转写稿**：粘贴带 `mm:ss` 时间戳的文本；没有时间戳就按每行 5 秒自动铺开
- **结构化总结**：一句话结论 / 关键决定 / 待办事项（负责人 + 截止时间）/ 风险与遗留问题
- **流式输出**：总结和回答都是逐字流式渲染，不是转圈等三秒
- **带引用的问答**：回答基于检索到的原文片段，用 `[mm:ss]` 标注依据；找不到就直说「转写里没有提到」
- **原文联动高亮**：提问后自动高亮相关的转写段落，并滚动到第一处
- **会议库**：列表、时长、段数、是否已总结，可删除
- **零 Key 可跑**：没有 Key 时自动降级为演示模式，功能闭环

## 架构

```
talkbase/
├── src/app/
│   ├── page.tsx                     # 首页：导入 + 会议库
│   ├── s/[id]/page.tsx              # 详情：转写稿 + 总结 + 问答
│   └── api/
│       ├── sessions/route.ts        # GET 列表 / POST 导入
│       ├── sessions/[id]/route.ts   # GET 单场 / DELETE
│       ├── summarize/route.ts       # POST 流式生成总结（结束后落库）
│       └── chat/route.ts            # POST 流式问答（检索 → 上下文 → 生成）
├── src/lib/
│   ├── store.ts                     # JSON 持久化（原子写 + 串行化），换 DB 只改这层
│   ├── retrieval.ts                 # 中文二元组 + 英文词的轻量检索（无 embedding）
│   ├── ai.ts                        # 模型接入层 + 系统提示词 + 演示模式流
│   ├── offline.ts                   # 演示模式的规则总结 / 规则回答
│   ├── parse.ts                     # 转写稿解析
│   ├── stream.ts                    # 流式透传 + 结束后回调落库
│   └── markdown.ts                  # 极简安全 Markdown 渲染（先转义再拼装）
└── supabase/schema.sql              # 上生产用的表结构（含 pgvector 位）
```

数据流：

```
粘贴转写稿 ──POST /api/sessions──▶ data/db.json
                                      │
点「生成总结」──POST /api/summarize──▶ 拼提示词 → 流式返回 → 写回 summary
                                      │
提问 ──POST /api/chat──▶ 检索 top6 片段 ──▶ 拼上下文 + 历史 ──▶ 流式回答
                              └──▶ 前端用同一套检索逻辑高亮原文
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sessions` | 会议列表（不含转写正文） |
| POST | `/api/sessions` | 导入 `{ title?, transcript }`，返回新会话 |
| GET | `/api/sessions/:id` | 单场详情（含 segments / summary） |
| DELETE | `/api/sessions/:id` | 删除 |
| POST | `/api/summarize` | `{ sessionId }` → 流式总结，结束后落库 |
| POST | `/api/chat` | `{ sessionId, question, history }` → 流式回答 |

两个流式接口都返回 `text/plain` 的裸文本流（不是 SSE），前端用 `ReadableStream` 逐块追加；
响应头里的 `X-Talkbase-Mode: live|demo` 标明是模型生成还是规则兜底。

## 测试

```bash
npm test        # 15 个用例：转写稿解析 / 检索排序 / 演示模式总结与回答
```

跑的是纯逻辑层（`src/lib`），不需要启动服务、不需要 API Key：
`node --import tsx --test`，没有引入 jest / vitest 之类的测试框架。

## 部署

**Vercel 上直接部署会失败** —— 不是代码问题，是 Serverless 的文件系统只读，`data/db.json` 写不进去。
所以上生产必须先换数据库，项目已经准备好了：

1. 在 Supabase 建项目，执行 [`supabase/schema.sql`](supabase/schema.sql)（已带 pgvector 字段和 RLS 开关）
2. 实现 `src/lib/store.ts` 里的 5 个函数，把 JSON 读写换成 SQL —— **这是唯一需要改的文件**
3. 配好 `SUPABASE_URL` / `SUPABASE_ANON_KEY`，推到 Vercel

不想上云的话，任意能持久化磁盘的机器都行（一台 2 核小主机 + `npm run build && npm start`）。

## 已知限制 / 路线图

- [ ] 检索是词频匹配，同义改写（「谁背锅」vs「谁负责」）召回不了 —— 换 embedding + pgvector
- [ ] 还不能直接传音频，要先把转写稿粘进来 —— 接 Whisper / SenseVoice
- [ ] 没有说话人分离与自动把待办提取到日历
- [ ] 单用户、无鉴权，只适合自己用
- [ ] 还只有单测，缺 e2e（下一步：Playwright 覆盖「导入 → 总结 → 提问」全链路）

---

MIT © 2026 Zheng Xiyu
