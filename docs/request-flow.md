# One request, from the click to the screen

Assignment 4, step 6: "Draw a diagram of one request, from the click to the screen: the browser, my server, Clerk, Supabase, and the API."

The request is **Search** on the Jobs page: someone signed in as A types "product manager" and taps Search. It touches all five parts. A second, shorter diagram follows for **Save**, which goes from the browser straight to Supabase.

## Search: browser → our server → Clerk → Supabase → job boards → screen

```mermaid
sequenceDiagram
    autonumber
    actor A as A (signed in)
    participant B as Browser<br/>(Jobs page)
    participant P as Our server: proxy.ts<br/>(runs before every request)
    participant R as Our server: /api/jobs/search
    participant C as Clerk
    participant S as Supabase<br/>(Postgres + RLS)
    participant J as Greenhouse / Ashby / Lever

    A->>B: types "product manager", taps Search
    B->>B: shows "Looking through Figma…" (loading state)
    B->>P: GET /api/jobs/search?q=product+manager<br/>(Clerk's session cookie goes along by itself)
    P->>C: is this session real and still valid?
    C-->>P: yes, it is user_3LDe… (A)
    Note over P: signed out → 307 to /sign-in, nothing below runs
    P->>R: let the request through
    R->>R: check the search: at most 100 characters
    R->>C: getToken(): a short-lived token that says sub = user_3LDe…
    C-->>R: token
    R->>S: select source, board_token, name from companies<br/>(publishable key + A's token, never the secret key)
    S->>S: check the token's signature against Clerk (third-party auth)
    S->>S: RLS: keep rows where user_id = token's sub
    S-->>R: A's companies only: Figma (greenhouse)
    R->>R: check each company's board name is safe (a-z, 0-9, -)
    alt Figma's board was fetched in the last 10 minutes
        R->>R: use the shared cached copy (about 0.02 s)
    else not cached
        R->>J: GET boards-api.greenhouse.io/v1/boards/figma/jobs (10 s limit, no key)
        J-->>R: 139 jobs, 88 KB, 15 fields each
        R->>R: trim to 8 fields per job, keep 10 minutes for everyone
    end
    R->>R: keep titles matching every word ("product", "manager"), newest first, one page of 20 ("Show 20 more" asks for the next)
    R-->>B: 200 JSON, about 3.6 KB: 7 jobs + how many roles each company has open
    B->>B: check each job (https links only)
    B-->>A: "7 roles match "product manager"", each with Save and View posting ↗
```

What can go wrong, and what the screen says:

| Where | What happens | What A sees |
|---|---|---|
| proxy.ts | not signed in | sent to the sign-in page |
| route | search longer than 100 characters | "Keep the search under 100 characters" |
| Supabase | companies can't be read | "The hiring systems didn't answer, try again in a minute" + Try again |
| job boards | one system doesn't answer within 10 s | "Palantir didn't answer, showing the rest" |
| job boards | none answer | "The hiring systems didn't answer, try again in a minute" + Try again; the companies still show |
| result | nothing matches | "No roles match "…" at your companies right now, try a shorter title like "designer"" |

## Save: browser → Clerk → Supabase (our server is not involved)

```mermaid
sequenceDiagram
    autonumber
    actor A as A (signed in)
    participant B as Browser
    participant C as Clerk
    participant S as Supabase<br/>(Postgres + RLS)

    A->>B: taps Save on "Product Manager, Figma Pattern Library"
    B->>C: session.getToken()
    C-->>B: token with sub = user_3LDe…
    B->>S: insert into saved_jobs (a snapshot: title, company, location, link, date)<br/>no user_id sent
    S->>S: check the token, fill user_id from its sub
    S->>S: RLS "Add own saved jobs": user_id = sub? yes
    S-->>B: the saved row
    B-->>A: the button turns into "Saved ✓"
```

The job boards aren't called here: the snapshot already came with the search. Our server isn't either: the browser can talk to Supabase directly because row-level security, not the server, decides what each person may touch.

## Why the job boards are called on the server, not in the browser

- **Size and caching:** a raw board is up to 13.5 MB (OpenAI on Ashby). The server trims it, keeps one copy for everyone for 10 minutes, and sends the browser a few KB.
- **Rate limits:** with the shared cache, a company is fetched at most once every 10 minutes, however many people follow it.
- **Safety:** the browser never chooses the address we call. The list of companies comes from the person's own rows in Supabase, and every board name is checked before it goes into an address.
- **Not keys:** Greenhouse, Ashby and Lever need no key, so hiding one is not the reason.
