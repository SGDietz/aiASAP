import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { gatherUserExport } from "../../../../src/lib/userDataExport";

/**
 * Direct (authenticated) data export (G 2026-06-07). Returns the signed-in
 * caller's OWN data as a downloadable JSON file. Shares gatherUserExport with the
 * emailed-link download route. The VOICE flow uses /api/account/export-request
 * (emails a link) rather than this — this stays available for a future in-app
 * "Download my data" button on the Memory page.
 */
export const maxDuration = 60;

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let payload;
  try {
    payload = await gatherUserExport(user.id, user.email ?? null);
  } catch {
    return NextResponse.json({ error: "could not build export" }, { status: 500 });
  }

  const filename = `aiASAP-my-data-${payload.exported_at.slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
