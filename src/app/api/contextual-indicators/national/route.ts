import { NextResponse } from "next/server";
import { getLatestNationalHdxContext } from "@/lib/contextualNationalContext";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const ctx = await getLatestNationalHdxContext(country);
  return NextResponse.json(ctx);
}
