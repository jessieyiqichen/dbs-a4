import { fetchBoard } from "./boards";
import { cachedBoards } from "./service";

/** One cached board reader for the whole server process, shared by every request and everyone following a company. */
export const getBoard = cachedBoards((source, token, label) => fetchBoard(source, token, label));
