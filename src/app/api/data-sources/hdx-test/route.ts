import { NextResponse } from "next/server";
import { testUnHabitatHdxConnection } from "@/lib/hdxUnHabitatClient";

export async function GET() {
  try {
    const result = await testUnHabitatHdxConnection();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "failed",
        hapiAvailable: false,
        ckanAvailable: false,
        datasetsFound: [],
        resourcesFound: [],
        sampleRows: [],
        notes: [`Connector execution failed: ${message}`],
      },
      { status: 500 },
    );
  }
}
