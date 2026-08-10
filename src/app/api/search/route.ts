import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canRead } from "@/lib/access";
import { search } from "@/lib/search";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canRead(user)) {
    return NextResponse.json({ error: "Sign in to search." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (!q) {
    return NextResponse.json({ error: "Nothing to search for." }, { status: 400 });
  }

  return NextResponse.json(await search(q));
}
