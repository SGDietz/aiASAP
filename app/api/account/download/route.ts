import { NextResponse } from "next/server";
import { verifyDownloadToken } from "../../../../src/lib/downloadToken";
import {
  gatherUserExport,
  renderUserExportHtml,
  buildExportFile,
} from "../../../../src/lib/userDataExport";

/**
 * Token-gated data download (G 2026-06-07; reworked into a Google/Meta-style
 * data-and-privacy flow 2026-06-09). The link emailed by /api/account/export-request
 * points here. The token IS the authorization - it's signed + time-limited, so no
 * login is needed (the user clicks straight from their email).
 *
 * Two modes on the same token-gated GET:
 *   - default            -> a branded "Your data & privacy" CHOOSER page (pick
 *                           categories; nothing rendered = private; no blank tab).
 *   - ?format=file&include=profile[,history] -> the actual file (plain-text),
 *                           built from ONLY the chosen categories. The chooser
 *                           page fetches this and saves it. Profile is the default;
 *                           full conversation history is opt-in (it can be huge).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const claims = verifyDownloadToken(token);
  if (!claims) {
    return new NextResponse(
      "<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;background:#190f05;color:#f4e7d2;padding:40px'>This download link is invalid or has expired. Ask 6 for a fresh one.</body>",
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  let payload;
  try {
    payload = await gatherUserExport(claims.uid, claims.email);
  } catch {
    return new NextResponse(
      "<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;background:#190f05;color:#f4e7d2;padding:40px'>Sorry, I couldn't put your data together right now. Try the link again in a bit.</body>",
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // FILE mode: build only the chosen categories and return a plain-text file.
  if (url.searchParams.get("format") === "file") {
    const inc = (url.searchParams.get("include") ?? "profile").toLowerCase();
    const file = buildExportFile(payload, {
      profile: inc.includes("profile"),
      history: inc.includes("history"),
    });
    const fname = `aiASAP-my-data-${payload.exported_at.slice(0, 10)}.txt`;
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: the category chooser page.
  return new NextResponse(renderUserExportHtml(payload), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
