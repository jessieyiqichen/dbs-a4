import { auth } from "@clerk/nextjs/server";
import { findCompany } from "@/lib/jobs/boards";
import { getBoard } from "@/lib/jobs/server";
import { readName, summarize } from "@/lib/jobs/service";

/** GET /api/jobs/company?name=Figma: finds a company on Greenhouse, Ashby or Lever by name or job link. Answers with
 *  the company and how many roles are open, not the roles themselves; nothing is saved until the person taps Add. */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to look up companies" }, { status: 401 });
  const name = readName(new URL(request.url).searchParams.get("name"));
  if (name === null) return Response.json({ error: "Enter a company name, like Figma" }, { status: 400 });
  return Response.json(summarize(await findCompany(name, fetch, getBoard)));
}
