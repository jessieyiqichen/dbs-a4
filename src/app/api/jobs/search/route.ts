import { serverDbForRequest } from "@/lib/db/server";
import { getBoard, limits, tooMany } from "@/lib/jobs/server";
import { MAX_COMPANIES } from "@/lib/jobs/companies";
import { companyKey, readCompany, readFrom, readQuery, rowToCompany, searchCompanies, type Company } from "@/lib/jobs/service";

/** GET /api/jobs/search?q=product+manager&company=greenhouse:figma&from=20: a page of 20 roles matching the search at
 *  every company the signed-in person follows, or only the one chosen in the company menu (it must be one they follow).
 *  The list of companies comes from their own rows in Supabase (read with their token, so RLS applies), not from the
 *  browser, so a request can never make the server fetch boards the person doesn't follow. */
export async function GET(request: Request) {
  const signedIn = await serverDbForRequest();
  if (!signedIn) return Response.json({ error: "Sign in to search roles" }, { status: 401 });
  if (!limits.search(signedIn.userId)) return tooMany();
  const { db } = signedIn;
  const query = readQuery(new URL(request.url).searchParams.get("q"));
  if (query === null) return Response.json({ error: "Keep the search under 100 characters" }, { status: 400 });
  const only = readCompany(new URL(request.url).searchParams.get("company"));
  if (only === null) return Response.json({ error: "Pick one of your companies" }, { status: 400 });
  const from = readFrom(new URL(request.url).searchParams.get("from"));
  if (from === null) return Response.json({ error: "Search again to see more roles" }, { status: 400 });

  const { data, error } = await db.from("companies").select("source, board_token, name").order("added_at");
  if (error) {
    console.error("Jobs: could not read followed companies", error);
    return Response.json({ error: "Your companies didn't load, try again in a moment" }, { status: 502 });
  }
  // At most 25 (the database refuses more); sliced here too, so one search never fans out further whatever is stored
  const companies = (data ?? []).map(rowToCompany).filter((c): c is Company => c !== null).slice(0, MAX_COMPANIES);
  // Only a company this person follows can be chosen, so the browser still can't make the server fetch any other board
  if (only && !companies.some((c) => companyKey(c) === only)) {
    return Response.json({ error: "Pick one of your companies" }, { status: 400 });
  }
  return Response.json(await searchCompanies(companies, query, getBoard, only, from));
}
