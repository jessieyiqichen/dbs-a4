import { fetchBoard } from "./boards";
import { createRateLimit } from "./rateLimit";
import { cachedBoards } from "./service";

/** One cached board reader for the whole server process, shared by every request and everyone following a company. */
export const getBoard = cachedBoards((source, token, label) => fetchBoard(source, token, label));

const MINUTE = 60_000;
/** Per person, per minute (security review, 2026-10-26). A lookup can ask all three hiring systems, so it is the
 *  tightest; a search reads cached boards, so it can be looser. */
export const limits = {
  lookup: createRateLimit({ limit: 20, windowMs: MINUTE }),
  search: createRateLimit({ limit: 60, windowMs: MINUTE }),
  savedStatus: createRateLimit({ limit: 20, windowMs: MINUTE }),
};

export const tooMany = () => Response.json({ error: "Too many searches at once, wait a minute and try again" }, { status: 429 });
