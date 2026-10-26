<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nudge · DBS Assignment 4 (Full Stack App), extended from Assignment 3

## What Assignment 4 adds (user decisions 2026-10-20/21)
- Accounts (Clerk) and a database (Supabase), so classmates can sign up and each person sees only their own goals and jobs, on any device.
- Jobs from the public job boards of three hiring systems (Greenhouse, Ashby, Lever), tied into the main loop: each person adds the companies they are targeting, searches those companies' open roles by title, saves the ones they want, and marking a saved job "Applied" counts one toward an applications goal (one more fish for Titi).
- Why job boards and user-added companies: these boards have no cross-company search, and a fixed company list fails classmates who target different companies (user, 2026-10-21). Rejected: Remotive (search ignored, terms forbid listings behind sign-in), The Muse (no keyword search, noisy categories), Adzuna (needs a key, free tier is "for evaluation", logo on every listing), Himalayas (remote jobs only), a Divvy app (the official Divvy app already does live availability).
- All three systems from the first version (user, 2026-10-21: "try them all"). In a live check of 33 common companies (2026-10-21), 24 were found: Greenhouse 16 (Anthropic, Airbnb, Jane Street...), Ashby 6 (OpenAI, Perplexity, Notion, Snowflake, Plaid, Webflow), Lever 2 (Spotify, Palantir).
- Coverage is partial, and the page says so ("Works with companies that hire through Greenhouse, Ashby or Lever"). Not reachable: companies on their own systems or Workday (Google, Uber, McKinsey, DoorDash, Etsy, Two Sigma, Citadel, Hudson River Trading, Grammarly). Applications to those still count: the manual +1 from Assignment 3 stays.

## Data model (Supabase, user-approved 2026-10-21)
Four tables. Every table has `user_id text not null default (auth.jwt() ->> 'sub')`: the Clerk user id (`user_...`, not a uuid), filled in by the database from the signed-in person's token, never sent by the browser. Row-level security is on for every table, with select, insert, update and delete policies that all check `user_id = (select auth.jwt() ->> 'sub')`. Ids are `uuid default gen_random_uuid()`.

| Table | Holds | Columns besides id and user_id |
|---|---|---|
| `goals` | A person's goals (was `AppData.goals`) | verb, title, unit, type (`by-date` / `daily`), target (> 0), deadline (date, null for daily), link, start_date, pauses (jsonb), history (jsonb), position (order; Undo puts a goal back where it was), created_at |
| `entries` | How many were done, per goal per moment (was `AppData.entries`) | goal_id (references goals, on delete cascade), saved_job_id (references saved_jobs, nullable, on delete set null), date, amount (> 0), at |
| `companies` | The companies a person follows | source (`greenhouse` / `ashby` / `lever`), board_token (e.g. `figma`), name (Greenhouse's company name, or what the person typed for Ashby and Lever, which send none), added_at; unique (user_id, source, board_token) |
| `saved_jobs` | Jobs a person saved, with a snapshot so they stay readable after the posting is taken down | source, board_token, job_id (text: Greenhouse ids are numbers, Ashby and Lever ids are uuids), title, company_name, location, url (the posting on the hiring system's site), posted_at, status (`saved` / `applied`), saved_at, applied_at; unique (user_id, source, board_token, job_id) |

- Saved jobs do not reference `companies`: removing a company keeps the jobs saved from it.
- Marking a job Applied inserts one entry on the goal the person picks (with `saved_job_id` set); un-marking deletes that entry. Deleting a saved job keeps its entry (they did apply). Which goal (user, 2026-10-26): with one applications goal it counts there and the toast names the goal, with Undo; with several, it asks the first time and remembers the pick (per device), which can be changed.
- Stays in the browser (localStorage), per device: settings (reminder times, notifications, prompts seen), the session in progress, last visit. Notification permission is per device anyway.
- Only two states for a job, saved and applied: Nudge pushes people to start, it is not an application tracker.
- No import of Assignment 3 browser data: the new site is on a different domain, so that data is not reachable.
- Suggested companies for an empty list are a constant in the code, shown as one-tap "Add" options. Nothing is written until the person adds one.

## External API: public job boards (Greenhouse, Ashby, Lever)
Code: `src/lib/jobs/` (`normalize.ts` turns each system's response into one `Job` shape, `boards.ts` fetches a board, finds a company and filters by title). No key for any of them; a missing board answers 404.

| System | Board address | Size of a big board | Fields we keep |
|---|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs` | 0.5 MB (Anthropic) | id, title, company_name, location.name, absolute_url, first_published |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{token}` | 13.5 MB (OpenAI) | id, title, location + secondaryLocations, jobUrl, publishedAt; only `isListed` jobs |
| Lever | `api.lever.co/v0/postings/{token}?mode=json` | 6 MB (Palantir) | id, text (title), categories.allLocations, hostedUrl, createdAt (ms) |

- Adding a company by name (user, 2026-10-21: a name, not a link): the person types a company name. It becomes board names to try (`Scale AI` → `scaleai`, then `scale-ai`), each tried on Greenhouse, then Ashby, then Lever. The first board with jobs wins; an empty board counts only if nothing else has jobs (Webflow left an empty Greenhouse board when it moved to Ashby). The page shows "Found Figma, 141 open roles" and adds only after the person taps Add, so a different company with the same name is never added by surprise.
- Not found → "Couldn't find this company on Greenhouse, Ashby or Lever", with a second field: "Have a job link from them? Paste it". A link from `job-boards.greenhouse.io`, `boards.greenhouse.io`, `jobs.ashbyhq.com` or `jobs.lever.co` asks only that system. Links from other sites are not followed.
- Board names must match `^[a-z0-9-]{1,64}$` before any request, so typed input can never change the address we call.
- Called only on the server, never from the browser: the raw boards are megabytes, everyone following the same company shares one cached copy, and input is checked before any request. Cache each board's trimmed job list (at most about 230 KB) for 10 minutes; never cache the raw response. Send the browser only the matching jobs' fields.
- Designed states: loading; company not found; no open roles match the search; a system unavailable (non-200, not a job list, or no answer within 10 seconds), with saved jobs still shown from the database; a saved job no longer posted (its id is gone from the board), shown from its snapshot and marked as closed.
- Only https links are kept, and descriptions are not shown in the first version: "View posting ↗" opens the job on the hiring system's own site, which also credits the source. If descriptions are ever shown, sanitize the HTML first.

# Assignment 3 notes (still apply)

## What and for whom
- A goal pusher for students in recruiting season: the job-search tasks that matter but you don't enjoy, so you keep putting them off (LinkedIn connections, applications, coffee chats, interview practice).
- The user is a student in recruiting season (user decision 2026-10-17: a specific audience, not everyone). Examples, copy and nudges speak to job hunting. The tool is proactive: it tells you today's number, pushes you to start, and nudges you again (encouraging, never shaming) until you do. No chat.
- Main flow: I set a goal (e.g. 500 connections by a date) → every day it tells me today's number and pushes me to start → if I haven't, it nudges me again → I come back and see how close I am.

## Decisions so far (user-approved)
- Any job-search goal can be tracked (Something else is free text), but first-visit choices are recruiting tasks.
- A big goal is split into a daily quota (remaining / days left); falling behind raises tomorrow's quota, and the app says why.
- "Forcing a start": the home screen shows only today's number and one big "do one now" action.
- Tone and look: warm and motivating (user, 2026-10-17). Nudges get more direct through the day when nothing is done, but never shame. The visual style should feel warm too.
- A goal you have started stays on top until it is done, so it never jumps away mid-task.

## Design rules (from Week 3 class, agreed with the user 2026-10-17)

Voice and style (user, 2026-10-17, after researching Duolingo)
- Encourage, don't remove the push (user, 2026-10-17): the app still pushes people to finish, but always by cheering them on. Lead with progress, then the next step ("10 of 100, nice work!" then "pick a new one and keep going!"), never with a verdict ("The deadline has passed").
- Write like a cheerleader, after Duolingo: short, active voice, celebrate small wins. The character may joke about itself, never about the person. A missed day talks about the best run and starting again, never "falling behind".
- No full stops anywhere in the interface (they read as stern). Encouraging lines end with "!", easygoing ones with no punctuation at all (user, 2026-10-18: the "~" read as a typo; a full stop felt down). Errors and labels take no end punctuation (no "!" on errors, it reads as shouting). `src/lib/copy.test.ts` checks this.
- Look: "Cozy Cat", clay edition (user, 2026-10-17, after reading the design skills). Warm light page; the few things you act on are saturated and chunky (Claymorphism: a highlight on top, a solid lip underneath, press sinks it), everything else quiet. Grass green (`--color-primary` #3ec66b, a step brighter than the first mint) only for the primary action and the selected goal tab; honey for fish treats and the streak; sky blue is Titi's bowl; the finish flag on Titi's road is the one plain red (user's request, 2026-10-18). No orange or rose anywhere else: the user tried a rose primary on 2026-10-18 and rejected it (a cool pink fought the warm cream), and orange was rejected because it is Titi's and the rewards' colour, so the button would not stand apart. No dark outlines. The design system is Fish Treat (https://claude.ai/artifact/8ZLSKPpy6jRFPHJtqfZXCw, user's decision 2026-10-18: everything follows it): its README, tokens, type roles, radii and component cards are the source of truth. A new element takes an existing token, role or component from it; a change to the look is made here and in Fish Treat together (the one difference waiting to be written back: the focus ring that wraps a clay control's lip). Clay (the highlight and the lip, `.clay`) means "you can press this" and goes only on buttons, tappable fish, radio options, goal tabs and cards that are links; anything that cannot be tapped has no box at all: the sentence on Today, the week's bowls, the result numbers, the painted road (its own rounded shape), the settings sections (separated by a hairline) are plain on the page (user, 2026-10-18, after the sentence card was taken for a button). The only read-only things with a backing are Titi's speech bubbles (the tail says "speech") and the streak chip on the painting (`.flat`: a soft shadow, no lip). Titi's mat is the one decorative clay piece. Tokens and their contrast live in `src/app/globals.css`.
- Never stitch separately generated raster art together (user, 2026-10-17: "if it looks ugly I'd rather not have it"). Painted pieces (the window, the bowls, Titi) each stand alone on plain interface, never laid over another painting. Titi keeps her drawn frame animations. The one exception is Titi's road on the progress page (user's decision, 2026-10-18): the hillside is a GPT painting and the code draws Titi, paw prints, the signposts, the pace ring and the flag on top of it, because they move with progress; things higher up the hill are drawn smaller so they sit in the painting's distance, and each gets a soft shadow. Do not extend this to any other screen.
- Each screen holds one sentence, one central object (Titi and the fish treats) and one button.
- Start never opens a website (user, 2026-10-18): the session (`/session`, its own page so Back works) offers "Open <site> ↗" and the person taps it. Presets may suggest a page; it is only ever offered on that button.
- Navigation holds only the core needs: Today, Jobs and Goals (Jobs added for Assignment 4, user 2026-10-26: following companies and saving roles is a daily task, and the job boards are the assignment's API). Reminders are a setting, reached from Goals and from the done screen.
- One streak for the whole app, like Duolingo's: a day counts when any goal got at least one ("One now keeps your streak going!"), with one forgiven rest day a week. It reads as "N-day streak".
- Titi is the user's own cat (art generated with GPT, credit it in the README). Drawn loops in `public/cat/`: asleep before you start, sitting with you while you work, jumping for joy when today is done; each has a still frame for reduced motion. Titi is never hungry, sad or disappointed. Every task done is one fish treat for Titi; the count always shows as a number too.

Hierarchy (emphasize by de-emphasizing)
- One primary action per screen, the only accent-colored thing on it. Everything else is secondary or quieter.
- The most important number reads as a full sentence: what to do, how many, today.
- Never stack more than one notice (welcome, warning, prompt) above the main action.

Flow and steps (reducing friction)
- Before adding a step, field or page, say what breaks without it. If nothing, don't add it.
- Prefer doing it in place over sending people to another page.
- Fill in sensible defaults, but the person decides their own goal: defaults are editable before they start.

First visit and coming back
- First visit: one question, one obvious first action, and one line saying what happens when you tap.
- Coming back is faster than the first visit: what they do most comes first, before any message.
- Reward right away: finishing today's number gets a visible celebration, not just a line of text.
- Ask for permissions (notifications, calendar) only after the person has done something useful.

Consistent components
- The same action looks the same on every page (Edit, Add a goal, Back). Build it once as a shared component.
- Removing one item uses Undo; replacing or deleting everything uses Confirm.

Checking and working together
- Don't say it's done until it's checked in the browser at 390px and 1440px, keyboard only, with the console clear.
- Check text contrast meets WCAG AA (4.5:1 text, 3:1 controls) for every color pair you add.
- Work one flow stage at a time with the user. Show the current steps, ask, then change only what was agreed. Never redesign several stages at once.

## Rules
- Next.js + Tailwind, Clerk for sign-in (development keys), Supabase for data, the Greenhouse Job Board API for jobs, deployed on Vercel's Hobby plan. Push back on any other service or package we don't need.
- Keys live in `.env.local`, which the user creates; agents never read or write `.env` files (deny rule in `.claude/settings.json`). Publishable keys may reach the browser; secret keys stay on the server.
- A signed-out visitor sees no one's data. Access is decided by row-level security in Supabase, not only by hiding things in the page.
- The app cannot push when the page is closed. Calendar files (.ics, generated in the browser) are the only off-page reminder; they cannot know whether today is done. Say so honestly in the UI and README.
- Forms: one column, a real label on every field, errors next to the field saying what to do next, keep what the person typed.
- Shared components (Button, Field, Input...) used everywhere. Keyboard access, real labels, contrast checked.
- Every step is discussed and approved by the user before it is built. Small fixes to approved work are fine.
- Log every request, push-back and decision in `log.md` (Chinese). Pages, code and this file stay in English.
- Commits: one small step each; add files by name, never `git add -A`.
