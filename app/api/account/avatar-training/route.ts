import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { TRAINING_ITEM_KINDS, isSafeTrainingLesson } from "../../../../src/lib/avatarTraining";

async function owner() {
  const userId = await getUserId();
  if (!userId) return null;
  try { return { userId, ...getSupabaseAdminConfig() }; } catch { return null; }
}

async function ownedProfile(context: NonNullable<Awaited<ReturnType<typeof owner>>>, avatarProfileId: unknown) {
  if (typeof avatarProfileId !== "string" || !avatarProfileId) return null;
  const res = await fetch(`${context.url}/rest/v1/avatar_profiles?id=eq.${encodeURIComponent(avatarProfileId)}&owner_user_id=eq.${encodeURIComponent(context.userId)}&training_enabled=eq.true&select=id&limit=1`, { headers: { apikey: context.serviceRoleKey, Authorization: `Bearer ${context.serviceRoleKey}` } });
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function GET() {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const res = await fetch(`${context.url}/rest/v1/avatar_training_items?owner_user_id=eq.${encodeURIComponent(context.userId)}&select=id,avatar_profile_id,kind,content,enabled,created_at,updated_at&order=created_at.desc&limit=200`, { headers: { apikey: context.serviceRoleKey, Authorization: `Bearer ${context.serviceRoleKey}` } });
  if (!res.ok) return NextResponse.json({ error: "list failed" }, { status: 500 });
  return NextResponse.json({ items: await res.json() });
}

export async function POST(request: NextRequest) {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as { avatarProfileId?: string; kind?: string; content?: string } | null;
  if (!body || !TRAINING_ITEM_KINDS.includes(body.kind as typeof TRAINING_ITEM_KINDS[number]) || typeof body.content !== "string" || !isSafeTrainingLesson(body.content)) return NextResponse.json({ error: "invalid training lesson" }, { status: 400 });
  const avatarProfileId = await ownedProfile(context, body.avatarProfileId);
  if (!avatarProfileId) return NextResponse.json({ error: "training is not authorized for this avatar profile" }, { status: 403 });
  const res = await fetch(`${context.url}/rest/v1/avatar_training_items`, { method: "POST", headers: { apikey: context.serviceRoleKey, Authorization: `Bearer ${context.serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: context.userId, avatar_profile_id: avatarProfileId, kind: body.kind, content: body.content.trim(), source: "owner_training_conversation" }) });
  if (!res.ok) return NextResponse.json({ error: "store failed" }, { status: 500 });
  return NextResponse.json({ item: (await res.json())[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await owner();
  if (!context) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; enabled?: boolean; content?: string } | null;
  if (!body?.id || (typeof body.enabled !== "boolean" && (typeof body.content !== "string" || !isSafeTrainingLesson(body.content)))) return NextResponse.json({ error: "invalid update" }, { status: 400 });
  const patch = typeof body.enabled === "boolean" ? { enabled: body.enabled } : { content: body.content!.trim() };
  const res = await fetch(`${context.url}/rest/v1/avatar_training_items?id=eq.${encodeURIComponent(body.id)}&owner_user_id=eq.${encodeURIComponent(context.userId)}`, { method: "PATCH", headers: { apikey: context.serviceRoleKey, Authorization: `Bearer ${context.serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!res.ok) return NextResponse.json({ error: "update failed" }, { status: 500 });
  return NextResponse.json({ item: (await res.json())[0] });
}

export async function DELETE(request: NextRequest) {
  const context = await owner();
  const id = request.nextUrl.searchParams.get("id");
  if (!context) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const res = await fetch(`${context.url}/rest/v1/avatar_training_items?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${encodeURIComponent(context.userId)}`, { method: "DELETE", headers: { apikey: context.serviceRoleKey, Authorization: `Bearer ${context.serviceRoleKey}` } });
  if (!res.ok) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
