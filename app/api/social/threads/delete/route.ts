export async function GET() {
  return Response.json({
    url: "https://aiasap.ai/privacy",
    confirmation_code: "aiasap_threads_delete_callback",
  });
}

export async function POST() {
  return Response.json({ ok: true });
}
