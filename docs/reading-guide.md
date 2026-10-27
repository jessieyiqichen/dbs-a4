# 阅读指南：读一遍 agent 在 a4-auth 分支上的改动

作业第 8 步："Before you merge, run /security-review and **read your agent's changes yourself**."
这个分支比 main 多了 86 个文件、约 3,900 行。不用逐行读：下面 8 处是安全和上课要讲的重点，约 30 分钟。
每处写了「它做什么」和「读的时候问自己」。读完在最后一节记下你注意到的东西，上课 Be Ready to Explain 第 5 题就用它。

在 Claude 桌面 app 里看改动：右上角打开 **Diff** 面板（或在终端运行 `git diff main...a4-auth -- <文件>`）。

---

## 必读（约 30 分钟）

### 1. 四张表和 RLS 规则 ☐
[supabase/migrations/20261026050122_create_nudge_tables.sql](../supabase/migrations/20261026050122_create_nudge_tables.sql)

- 它做什么：建 goals、entries、companies、saved_jobs 四张表，开 RLS，写规则，给权限。
- 读的时候问自己：
  - 第 10、31、50、64 行：每张表的 `user_id` 默认值是 `auth.jwt() ->> 'sub'`。这个值是谁填的？浏览器能不能自己填一个？
  - 第 80–83 行：四张表是不是都写了 `enable row level security`？少一张会怎样？
  - 第 85–88 行「Read own goals」「Add own goals」：用自己的话说出它们在比较什么。
  - 第 56 行：entries 为什么要用 `(goal_id, user_id)` 两个一起指向 goals？
  - 第 128–129 行：为什么先 `revoke all`、再只 `grant` 四种？没登录的 `anon` 拿到了什么？

### 2. 谁能打开哪个页面 ☐
[src/proxy.ts](../src/proxy.ts) 第 9 行，[src/lib/auth/routes.ts](../src/lib/auth/routes.ts) 第 9 行

- 它做什么：每个请求先经过这里，除了登录、注册页，没登录一律送去登录。
- 问自己：这里拦住了页面，那为什么还需要第 1 处的 RLS？（提示：只靠藏页面不够，作业也这么要求）

### 3. 连数据库用的是哪把钥匙 ☐
[src/lib/db/client.ts](../src/lib/db/client.ts) 第 8–13 行，[src/lib/db/server.ts](../src/lib/db/server.ts) 第 8–11 行

- 它做什么：浏览器和服务器都用 **publishable key** 加你的 Clerk 登录令牌（`accessToken`）连 Supabase。
- 问自己：整个项目里有没有用到 Supabase 的 secret key？（应该没有）服务器为什么也只用 publishable key？

### 4. 服务器上的岗位搜索接口 ☐
[src/app/api/jobs/search/route.ts](../src/app/api/jobs/search/route.ts)

- 它做什么：第 11 行查登录，第 13 行限次数，第 15、17 行检查搜索词和公司参数，第 20 行用**你的令牌**从 Supabase 读你关注的公司，第 26 行最多取 25 家，第 29 行拒绝不是你关注的公司。
- 问自己：浏览器能不能让服务器去抓一家你没关注的公司？哪一行挡住了它？

### 5. 为什么岗位 API 在服务器上调用 ☐
[src/lib/jobs/boards.ts](../src/lib/jobs/boards.ts) 第 7、39、93–102 行，[src/lib/jobs/service.ts](../src/lib/jobs/service.ts) 第 9、78 行

- 它做什么：第 7 行规定公司名只能是 `a-z 0-9 -`；第 93 行起同时问三家招聘系统；service.ts 第 9 行缓存 10 分钟，第 78 行是缓存本身。
- 问自己：如果有人在公司名里输入 `../admin`，会被拼进请求地址吗？上课被问「为什么在服务器调用」时，你会说哪三个理由？（对照 [docs/request-flow.md](request-flow.md) 最后一节）

### 6. 目标是怎么存进数据库的 ☐
[src/lib/store.ts](../src/lib/store.ts) 第 138 行 `enqueue`，第 195 行 `updateData`

- 它做什么：你点一下，屏幕先变，再在后台排队存进 Supabase；存失败时（第 150–151 行）屏幕退回数据库里的样子并提示。
- 问自己：这样做的好处是什么（快）？坏处是什么？（第 7 步发现：刚点完就关页面，可能还没存上）

### 7. 两个用户的自动测试 ☐
[e2e/two-users.spec.ts](../e2e/two-users.spec.ts) 第 59 行起

- 它做什么：两个浏览器分别登录 A、B，各加一个目标，第 75、79、84 行检查谁都看不到对方的。
- 问自己：第 2 轮故意弄坏规则时，失败在哪一行？报错 `Expected 0, Received 1` 是什么意思？

### 8. 安全审查后加的保护 ☐
[src/lib/validate.ts](../src/lib/validate.ts) 第 91 行 `webLink`，[next.config.ts](../next.config.ts) 第 8 行起，[supabase/migrations/20261026220814_companies_follow_limit.sql](../supabase/migrations/20261026220814_companies_follow_limit.sql)

- 它做什么：只放行 http(s) 链接；加安全响应头；数据库拒绝第 26 家公司。
- 问自己：为什么「最多 25 家」要在数据库里再拦一次，而不只在页面上提示？

---

## 可以快速扫一眼

| 文件 | 是什么 |
|---|---|
| `src/components/jobs/*` | Jobs 页：搜索卡片、公司下拉、收藏列表 |
| `src/components/today/SessionSaved.tsx` | 投递目标页里的「Your saved jobs」 |
| `src/lib/jobs/savedStore.ts` | 收藏和 Applied 的数据 |
| `src/lib/auth/appearance.ts`、`copy.ts` | Clerk 登录框的样子和文字 |
| `docs/request-flow.md` | 一次请求的流程图 |

## 可以跳过

- 所有 `*.test.ts`：自动测试（第 7 步的 e2e 除外），只要知道它们都通过（290 个）。
- `src/lib/jobs/copy.ts`、`src/lib/db/copy.ts`：页面上的文字。
- `package-lock.json`：装的依赖包清单。
- `log.md`：工作日志，你已经看过。

---

## 我注意到的

上课第 5 题：「你阻止过 agent 做什么？读改动时发现了什么？」（2026-10-26 问答后整理）

**我阻止 agent 做的**
- agent 想通过 MCP 直接删数据库里的两家测试公司，我拒绝了，后来在页面上删：直接改数据库绕过了 app，删错了也没有 Undo。
- 钥匙不经过 agent：`.claude/settings.json` 里的规则不让它读写 `.env` 文件，`.env.local` 和 Vercel 的 4 个环境变量都是我自己填的。
- 只许它用限定在这一个项目的 Supabase MCP，不许用能动我整个 Supabase 账号的那个。
- 合并进 main 要我同意：它有一次想推送后直接合并，被拦下，问过我才合并（合并就会改线上网站）。

**我指出、让它改的**
- 登录页「换一种方式」太小；Jobs 页公司在最下面翻不到；搜不到的公司响应慢；把页面改成标准多条件搜索。
- 部署后用手机实测发现：
  - Today 的窗户被压成一条、Titi 很小。原因是代码把可用高度 ≤740 的都当成矮屏手机，iPhone 14 在 Safari 里只剩约 700 也被算进去；加了一档中间尺寸。
  - 加公司的入口藏在下拉菜单里，点开才看得到；移到 Search | Saved 那一行，点了弹出对话框。
  - 庆祝页的提醒卡太大，把主按钮挤下去；换成一行的小卡。
  - 岗位列表一次 50 条，第 51 条以后看不到；改成每页 20 条，加上一页 / 下一页。

**agent 在浏览器实测中自己发现并改掉的**
- 只有一个目标时，把「投递」算到了「联系人」目标上；Undo 后提示条不消失；Search 按钮比输入框矮一截。
