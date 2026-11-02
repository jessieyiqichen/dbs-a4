# 上课分享稿 · Nudge（Assignment 4）

英文是要说出口的话，灰字（引用块）是给自己的提示和被追问时的备答。
全程约 5 分钟：开场演示 1 分钟，作业里 Be Ready to Explain 的 5 道题各 45 秒左右。
打开好两样东西：线上网站 https://dbs-a4.vercel.app （已登录），和 [docs/request-flow.md](request-flow.md) 的图。

---

## 开场 + 演示（约 1 分钟）

"My app is called Nudge. It's a goal pusher for students in recruiting season: the job-search tasks we keep putting off, like connection requests, applications, or interview practice.

You set a goal, like 150 connections by a date. Every day it tells you today's number, and one button to start. Every task you finish is one fish treat for Titi, my cat.

For Assignment 4 I added three things: accounts with Clerk, a database in Supabase so your goals follow you to any device, and jobs from real job boards.

On the Jobs page, you add the companies you're targeting, search their open roles by title, and save the ones you want. When you apply to a saved job, it counts one toward your applications goal. So the job search and the goal are one loop."

> 演示顺序：Today（今天的数字和 Start）→ Jobs（选一家公司，搜 "product"，点 Save）→ 打开投递目标，点 I applied，鱼干 +1。
> 如果有时间，顺带一句：A3 助教说「休息的状态不够醒目」，这次改了：休息中的目标在 Today 写明休息到哪天，有 I'm back early，Goals 里卡片变淡并加 On a break 标签。

---

## 1. 追踪一次请求：有人收藏了一个岗位（约 45 秒）

"When someone taps Save on a job, the request actually skips my server and the job board.

First, the browser asks Clerk for a short-lived token. It's signed by Clerk, lasts about a minute, and says who you are.

Then the browser writes straight to Supabase, with the publishable key plus that token. The row is a snapshot of the job we already got during the search: title, company, link. So the job board isn't called again, and the saved job stays readable even after the posting is taken down.

The browser never sends a user id. Supabase checks the token's signature, fills in `user_id` from the token, and row-level security checks that the new row belongs to you before it saves."

> 一句话版：浏览器 → Clerk 拿令牌 → 直接写 Supabase → 数据库从令牌填 user_id、RLS 检查。我的服务器和招聘网站这一步都不参与。
> 被问「那岗位从哪来」：来自之前的搜索，搜索才经过我的服务器和招聘网站（第 3 题）。

---

## 2. 怎么控制访问：在哪知道你是谁，在哪决定你能看什么（约 45 秒）

"Who you are comes from Clerk. When you sign in, Clerk gives the browser a session, and every request to the database carries a token from Clerk. The `sub` field in that token is your user id.

What you can see is decided by Supabase, with row-level security. All four tables have RLS on, with four policies each: read, add, change, delete. Every policy compares the row's `user_id` with the `sub` in your token.

There are two outer layers too. `proxy.ts` sends a signed-out visitor to the sign-in page. And signed-out visitors have no grants on any table at all. But hiding pages isn't enough on its own: the real decision is in the database."

> 被问「为什么页面拦了还要 RLS」：有人可以不用页面，直接拿 publishable key 请求数据库；能挡住他的只有 RLS。
> 四张表：goals、entries、companies、saved_jobs。

---

## 3. API 在哪里调用，为什么（约 45 秒）

"All three job boards, Greenhouse, Ashby and Lever, are called only on my server, in `/api/jobs/search`. Not to hide a key: these boards don't need one. There are three reasons.

One, size. OpenAI's board on Ashby is about 13 megabytes. The server trims it, caches the trimmed list for ten minutes, and everyone following the same company shares that copy. The browser only gets one page of 20 matches.

Two, the server decides what gets fetched. It reads your companies from Supabase with your own token, so RLS applies, and it refuses a company you don't follow. Company names have to match a strict pattern before they go into any address.

Three, limits. Each person gets a set number of searches a minute, and a board that doesn't answer in 10 seconds is shown as unavailable, while your saved jobs still show from the database."

> 三个理由记关键词：数据量和缓存、服务器决定抓哪些公司、次数限制和超时。不要说「等等」，也不要说「为了藏钥匙」。

---

## 4. 测试：失败时是什么样子，改了什么（约 45 秒）

"My Playwright test signs in two people, A and B, in two separate browsers. Each one adds a goal. Then it checks that A can't see B's goal, B can't see A's, and B can't see A's goal even when opening its link.

It passed first. Then I broke row-level security on purpose: I changed the 'Read own goals' policy to `using (true)`, which means anyone can read any goal.

The test failed at 'A must not see B's goal': expected 0, received 1. B's goal showed up on A's Goals page. I put the policy back with a migration, and the test passed again."

> 作业要的那一句：「I changed the rule so anyone could read any goal, and B's goal appeared on A's page, so the test failed at 'A must not see B's goal'.」
> 顺带的发现：测试一开始点完就刷新页面，目标还没存进数据库。这也说明「刚加完就关页面」可能丢数据，所以测试改成等 Supabase 确认保存。

---

## 5. Agentic workflow：阻止过 agent 做什么，读改动时发现了什么（约 45 秒）

"What I stopped: the agent wanted to delete two test companies straight from the database through the Supabase MCP. I said no and removed them in the app, because going around the app means no Undo if it deletes the wrong thing. It also once tried to merge to main right after pushing, and that was blocked until I said yes, because merging changes the live site.

What I set up so it couldn't: a deny rule so it can't read or write `.env` files, I entered all the keys myself, and the Supabase MCP is scoped to this one project only.

What I caught: after deploying, I used it on my phone. The window on Today was squashed into a strip and Titi was tiny, because the layout treated any phone under 740 pixels tall as a short screen, and Safari leaves an iPhone about 700. A company with over a hundred roles only showed the first 50, with no next page, and adding a company was hidden inside the dropdown. We fixed all of those."

> 三类记法：我阻止的（MCP 删数据、没问就合并）、我限制的（.env、钥匙我自己填、MCP 只限一个项目）、我发现的（手机排版、翻页、加公司入口）。
> 被问「agent 自己发现了什么」：只有一个目标时把投递算到了联系人目标上；Undo 后提示条不消失；Search 按钮比输入框矮一截。

---

## 收尾（一句）

"So: Clerk knows who you are, Supabase decides what you see, and the job boards are only ever called from my server. Thanks!"
