import { serverDbForRequest } from "@/lib/db/server";
import { getBoard } from "@/lib/jobs/server";
import { companyKey, readCompany, readQuery, rowToCompany, searchCompanies, type Company } from "@/lib/jobs/service";

/** GET /api/jobs/search?q=product+manager&company=greenhouse:figma: roles matching the search at every company the
 *  signed-in person follows, or only the one chosen in the company menu (it must be one they follow).
 *  The list of companies comes from their own rows in Supabase (read with their token, so RLS applies), not from the
 *  browser, so a request can never make the server fetch boards the person doesn't follow. */
export async function GET(request: Request) {
  const db = await serverDbForRequest();
  if (!db) return Response.json({ error: "Sign in to search roles" }, { status: 401 });
  const query = readQuery(new URL(request.url).searchParams.get("q"));
  if (query === null) return Response.json({ error: "Keep the search under 100 characters" }, { status: 400 });
  const only = readCompany(new URL(request.url).searchParams.get("company"));
  if (only === null) return Response.json({ error: "Pick one of your companies" }, { status: 400 });

  const { data, error } = await db.from("companies").select("source, board_token, name").order("added_at");
  if (error) {
    console.error("Jobs: could not read followed companies", error);
    return Response.json({ error: "Your companies didn't load, try again in a moment" }, { status: 502 });
  }
  const companies = (data ?? []).map(rowToCompany).filter((c): c is Company => c !== null);
  // Only a company this person follows can be chosen, so the browser still can't make the server fetch any other board
  if (only && !companies.some((c) => companyKey(c) === only)) {
    return Response.json({ error: "Pick one of your companies" }, { status: 400 });
  }
  return Response.json(await searchCompanies(companies, query, getBoard, only));
}
