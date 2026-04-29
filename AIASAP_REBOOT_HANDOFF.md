# aiASAP Reboot Handoff - 2026-04-27

## Current Shutdown Handoff - 2026-04-29 12:48 PM ET

G is heading out for a few hours. Pick up from here, not from the older stale sections below.

### Current production state

- Lane: Codex stays in `C:\Users\sgdie\Dropbox\Codex\aiASAP`. Do not touch iSolve unless G explicitly redirects.
- Current git short HEAD at shutdown: `0007fc5`.
- Latest production deploy: `dpl_6KytR2KoURwY7BA6N3Lh2i1UcUsF`.
- Production URL: `https://aiasap.ai`.
- Vercel production alias completed successfully.
- Telegram smoke test sent as message `148`.
- Local checks passed:
  - `tsc --noEmit`
  - `next build`
  - homepage `https://aiasap.ai` returned `200`
  - `/api/liveavatar/debug-token` used voice `a65a59af-39bd-4f57-8cc6-235449ca3348`
  - `used_fallback_voice=false`
  - `voice_resolution_reason=primary_preview_has_audio`
- LiveAvatar context was updated successfully with `tools/update_liveavatar_context.py`.
- Real account setup email route was tested with the configured G email in `.env`; response was `ok=true`, `emailSent=true`, `accountExists=false`. Do not expose the verification link or token in chat.

### Latest user rule overrides

- G changed the Supabase rule: only check Supabase after G gives feedback from a real test and asks/needs us to understand what happened. Do not check Supabase as a routine step after every smoke test.
- Use the words `smoke test`, not `smoke`.
- Keep final briefs very short.
- Give links when asking G to go anywhere.
- Use Telegram for smoke test messages unless G says otherwise.

### What changed in the latest build

- Fresh start should not auto-open grocery lists, search boxes, location boxes, or old UI panels.
- Saved account lists are still available in the background, but the UI stays clean unless the user asks for a list.
- Account restore now gives Six awareness of the last conversation/lists/search context without reopening UI.
- Return/account memory language should feel like friends picking back up:
  - With an account, conversations can be remembered.
  - Lists stay intact.
  - Likes/dislikes can be remembered.
  - Six can pick up where the user left off every time.
  - Optional account joke: avoids the awkward "do I know you? Have we met?" moment.
  - Brand line added where appropriate: "If you've got a phone, you've got a friend."
- Online lookup/location flow fixes:
  - If user says "find local hikes", prompt bubbles should stay hiking/location focused.
  - "Share location" should request browser geolocation instead of doing nothing.
  - "Close the box" / "close location box" / "close search" should close only the lookup/location overlay, never the session.
  - Lookup box is wider/lower and closer to the prompt bubbles.
- Prompt cleanup:
  - Removed bad bubble `Add the Next Item`.
  - Hiking bubbles should not drift into business/branding.
- Logo:
  - aiASAP logo raised slightly.
  - Desktop logo font now also used on mobile.
- Account memory implementation:
  - Recent conversation lines are captured in account resume state.
  - A signed-in user gets memory context injected into the first LiveAvatar message path so Six can speak with awareness.
  - Lists/search/location state is remembered as context, not forced open on screen.

### Files most relevant to the latest changes

- `src/components/LiveAvatarSession.tsx`
- `src/lib/accountPersistence.ts`
- `app/globals.css`
- `tools/update_liveavatar_context.py`

### What G should test next

Use production: `https://aiasap.ai`

1. Fresh computer start should show no grocery list and no search/location box.
2. Say: "find local hikes".
3. Then say: "share location".
4. Browser location permission should appear.
5. Say: "close the box".
6. It should close only the box, not the session.
7. Click the account setup email link that was sent to G.
8. Screen should stay clean.
9. Six should remember the last conversation/list context naturally, like a friend, without reopening UI.

### If G reports a problem

Then inspect Supabase/backend records to understand the real path. Focus on:

- `conversation_messages`
- LiveAvatar transcript sync rows
- account storage objects in bucket `aiasap-accounts`
- account resume JSON
- bug report objects if the issue was reported through Six

Do not check Supabase before G reports what happened.

### Suggested restart phrase for G

Copy/paste this when restarting:

```text
Read AIASAP_REBOOT_HANDOFF.md and continue from the 2026-04-29 12:48 PM ET shutdown handoff. Stay in aiASAP only. Do not touch iSolve. Latest production is https://aiasap.ai build dpl_6KytR2KoURwY7BA6N3Lh2i1UcUsF / 0007fc5. First, summarize current state in 5 bullets max, then help me test the fresh-start, location/share, close-box, and account-memory flow. Only check Supabase after I give test feedback.
```

## Emergency Reboot Handoff - 2026-04-29 ElevenLabs Key Rotation

- G is rebooting the whole system because the machine/session is running slow.
- Current lane: Codex stays in `C:\Users\sgdie\Dropbox\Codex\aiASAP`; do not touch iSolve unless G explicitly redirects.
- Read these first after reboot:
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP\STICKY_REBOOT_RULES.txt`
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP\PROJECT_MEMORY.md`
  - this file
- Latest rule update: Codex does all work, always, unless Codex absolutely cannot, then asks G for help. Telegram is default alert/smoke lane. Always send links. Shelly / Mrs. Claws is keymaster for security. Rule 12: automatically update the LiveAvatar context window/SW through the connected helper/API/dashboard when aiASAP behavior or voice context changes.
- ElevenLabs/LiveAvatar issue being worked: Discord evidence says custom avatar visible-but-not-speaking can be caused by an ElevenLabs API key problem even when credits and cloned voice are valid. Fix path is to create a fresh ElevenLabs API key on the same ElevenLabs account and use it instead.
- G created a new ElevenLabs API key named `aiASAP LiveAvatar ElevenLabs TTS`.
- New ElevenLabs key has been added locally to `.env` as `ELEVENLABS_API_KEY`; do not print it, commit it, or repeat it in chat.
- Existing ElevenLabs voice ID remains in `.env` as `ELEVENLABS_VOICE_ID`. Do not change the voice unless G asks.
- `.env.example` has been updated with safe placeholders for `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.
- `tools/set_vercel_env_from_local.ps1` already includes `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in optional Vercel env keys.
- Not yet done before reboot:
  1. Push updated envs to Vercel with `.\tools\set_vercel_env_from_local.ps1`.
  2. Deploy production with `npx.cmd vercel deploy --prod --yes`.
  3. Smoke the TTS path without logging audio or secrets.
  4. Send Telegram smoke note if deployment/voice smoke is meaningful.
  5. Check Supabase/backend only if the smoke actually writes data; otherwise state no backend rows were expected.
- Good next commands after reboot:

```powershell
cd C:\Users\sgdie\Dropbox\Codex\aiASAP
git status --short
Select-String -Path .env -Pattern '^(ELEVENLABS|LIVEAVATAR)_' | ForEach-Object { ($_.Line -split '=',2)[0] }
.\tools\set_vercel_env_from_local.ps1
npm.cmd run build
npx.cmd vercel deploy --prod --yes
```

- Reminder for next assistant from G: "Read the handoff, continue ElevenLabs key rotation. The new key is already in local .env. Do not ask me for it again."

## Lane Ownership

- Codex is aiASAP only.
- Claude is iSolve only.
- Do not touch iSolve from this repo/thread.

## Shutdown Handoff - 2026-04-28 Social Integration

- Current repo path/lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP`. Codex stays on aiASAP only.
- Current pushed HEAD: `11806aa Use stable social callback URLs`.
- Latest desktop social smoke-test link: `https://ai-asap-msa70mst6-team-dietz.vercel.app/social`.
- Latest smoke test sent to Telegram: `Smoke test 11806aa`; action line told G to use desktop to copy checklist/callbacks for Shelly.
- `/social` is the internal `aiASAP Social CENTCOM` dashboard for X, TikTok, Instagram, Facebook, Threads, and YouTube.
- Social tokens and drafts are stored as encrypted JSON in Supabase Storage bucket `aiasap-accounts`; they are not stored in `social_*` tables.
- Supabase post-smoke check: `aiasap-accounts` bucket exists, private, 1 MB limit, `application/json`; `users/` social storage objects count was `0`, which is expected until accounts are connected.
- Vercel envs installed by Codex: `INTEGRATION_TOKEN_ENCRYPTION_KEY` and `INTEGRATION_STATE_SECRET` for production/preview/development.
- Vercel envs still missing and needed from provider setup/keymaster: `META_APP_ID`, `META_APP_SECRET`, `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Stable callback URLs to give provider consoles and Shelly:
  - Meta: `https://ai-asap.vercel.app/api/social/meta/callback`
  - Threads: `https://ai-asap.vercel.app/api/social/threads/callback`
  - X: `https://ai-asap.vercel.app/api/social/x/callback`
  - TikTok: `https://ai-asap.vercel.app/api/social/tiktok/callback`
  - YouTube: `https://ai-asap.vercel.app/api/social/youtube/callback`
- Public social accounts known:
  - X: `https://x.com/aiASAPai`
  - TikTok: `https://www.tiktok.com/@aiasap.ai`
  - Instagram: `https://www.instagram.com/aiasap.ai/`
  - Facebook: `https://www.facebook.com/aiasapai`
  - Threads: `https://www.threads.com/@aiasap.ai`
- YouTube/Google: G said the existing Google Brand Account should be used for aiASAP. Do not commit the internal Google `myaccount`/brand-account URL or ID; only store/use a public YouTube channel URL after it exists.
- Next setup path: bring Shelly/keymaster in for keys. Start with Meta because it covers Instagram + Facebook, then Threads, then X, TikTok, and Google/YouTube.
- Dirty working tree at shutdown included unrelated files not to revert unless G asks: modified `telegram_codex_bot.py`, untracked `app/api/integrations/`, untracked `src/lib/googleIntegration.ts`.

## LiveAvatar Status

- G resumed LiveAvatar testing on 2026-04-28 and said not to worry too much about credits; get it right.
- aiASAP FULL mode issue: avatar/video can connect, but FULL brain/speech path does not respond.
- Smoke tests showed commands publish to `agent-control`, but no `agent-response`, no `avatar.speak_started`, and no transcription events.
- Latest 2026-04-27 smoke test still failed after a narrow app-side patch that sends normal FULL transcripts to the avatar brain. User saw same behavior; Supabase still showed user transcript evidence only, with no assistant response/speak evidence.
- Discord evidence on 2026-04-28 showed LiveAvatar SDK `0.0.17` and FULL mode are the current troubleshooting target. David's working demo includes `avatar_persona.context_id` and `is_sandbox: true`; Anders' failing test omitted `context_id` and `is_sandbox`.
- Local SDK was updated from vendored `0.0.9` to `0.0.17`.
- Added diagnostic page `/liveavatar-debug` with variants for `voice+context`, `voice+context+sandbox`, `voice only`, and `voice only+sandbox`, plus `repeat()` and `message()` buttons and event logs.
- Latest deployed diagnostic build: commit `b783657 Fix LiveAvatar SDK vendored install`.
- Latest diagnostic smoke test sent to Telegram: `Smoke test b783657`.
- Latest diagnostic URL: `https://ai-asap-368u6dnsq-team-dietz.vercel.app/liveavatar-debug`.
- Supabase checked after that smoke test: no new LiveAvatar/session rows yet; latest rows remain 2026-04-27 session `0c74140e-c1a8-4482-9d86-13d66d5dc32b` with user-only transcript evidence.
- Wildworks avatar reportedly works perfectly, so issue may be account/context/session/FULL-agent specific, not universal.

## Current Deployed aiASAP State

- Current main HEAD before reboot note: `93fbbf0 Add custom LiveAvatar fallback mode`.
- Production was deployed and aliased to `https://aiasap.ai`.
- Telegram message `#88` was sent with custom fallback test link:
  `https://aiasap.ai/?mode=custom&debugVoice=1&v=93fbbf0`
- Do not keep testing this unless user explicitly says to resume, because of credit concerns.

## Social CENTCOM Current State

- Current internal social dashboard route: `/social`.
- Latest preview smoke test sent to Telegram: `Smoke test gmx8c41k6`.
- Latest preview URL: `https://ai-asap-gmx8c41k6-team-dietz.vercel.app/social`.
- UI label: `aiASAP Social CENTCOM`.
- Use `Telegram` in UI/user-facing copy. `T` is only G's shorthand when appropriate.
- Current social platforms in scope: X, TikTok, Instagram, Facebook, Threads, YouTube.
- Threads account URL: `https://www.threads.com/@aiasap.ai`.
- DM/messaging apps such as WhatsApp, Messenger, Discord, and Telegram are deferred until the messaging workflow is appropriate; do not add them to the active social platform card list yet.
- Purpose: internal control panel for connection status, social drafts, Telegram approval, and later post/log workflow.
- Future product-track note: this setup flow should later become an aiASAP workflow that helps users create accounts, connect social platforms, set up developer apps/API keys, build approval workflows, create content, post/log results, and add messaging apps when useful.
- Current implementation files:
  - `app/social/page.tsx`
  - `app/api/social/status/route.ts`
  - `app/api/social/drafts/route.ts`
  - `app/api/social/[provider]/start/route.ts`
  - `app/api/social/[provider]/callback/route.ts`
  - `src/components/SocialPostingHub.tsx`
  - `src/lib/socialPosting.ts`
- `src/lib/apiRouteSecurity.ts` was updated so same-origin Vercel preview links can call `/api/social/status`; this fixed preview cards falling back to `Status unavailable`.
- `.env.example` includes social OAuth placeholders for X, TikTok, Meta, Threads, Google/YouTube, token encryption, and state secret.
- Full connection setup is not a two-hour clean finish. Next best connection path is Meta first because it covers Instagram, Facebook, and Threads. Full connection needs external developer apps, callback URLs, OAuth logins, Vercel env vars, and possibly platform review delays.

## Custom Fallback Build

- `?mode=custom` uses `/api/start-custom-session`.
- It routes brain/audio through app-side OpenAI and ElevenLabs, then LiveAvatar CUSTOM audio.
- Normal `https://aiasap.ai` still defaults to FULL mode.
- Build and typecheck passed before deploy.

## Google Integration Restore In Progress

- User said "go" to restore Google Calendar/Gmail while waiting.
- We decided not to revert the whole app.
- We restored only these files from pre-rollback commit `250923a`:
  - `app/api/integrations/google/start/route.ts`
  - `app/api/integrations/google/callback/route.ts`
  - `app/api/integrations/google/status/route.ts`
  - `src/lib/googleIntegration.ts`
- Current working tree has these as untracked files.
- `.env.example` has not yet been updated with the Google env placeholders after the restore.
- Next steps after reboot:
  1. Check `git status --short`.
  2. Add Google env placeholder block back to `.env.example`.
  3. Review restored Google files against current security/account helpers.
  4. Run `npm.cmd run build`.
  5. Run `npm.cmd run typecheck`.
  6. Commit if clean.
  7. Do not deploy or test LiveAvatar unless user explicitly resumes.

## Important Commands

```powershell
cd C:\Users\sgdie\Dropbox\Codex\aiASAP
git status --short
git log --oneline --decorate --graph -12
npm.cmd run build
npm.cmd run typecheck
```

## User Preferences To Remember

- Reboot contract: G keeps a sticky-note list because assistants forget. Treat these rules as startup requirements, not suggestions.
- Assistant-wide lane rule: Codex works aiASAP; Claude works iSolve unless G explicitly says otherwise. Never cross lanes unless G knows it.
- Send Telegram link when a test build is ready, always.
- If Telegram is needed, use `.env` `TELEGRAM_BOT_TOKEN` plus `TELEGRAM_ALLOWED_USER_IDS`; direct Bot API send was verified on 2026-04-27 with `ok=True`.
- Telegram voice notes are supported in `telegram_codex_bot.py`: Telegram `voice` audio is downloaded, transcribed with OpenAI audio transcriptions using `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`, then answered through the normal chat path. G's latest voice-note transcript appeared in `telegram_conversations.json` on 2026-04-27.
- Do not claim Telegram sending is impossible. Figure out the local route and send the message when operationally useful.
- After every smoke test, check Supabase and learn from the latest session/conversation data before deciding next changes.
- Verify access routes into Telegram, Vercel, Supabase, GitHub, Resend, LiveAvatar/context, and other required services before saying a service is unavailable. Check local envs, helper scripts, CLIs/APIs, dashboards, and route around blockers.
- Every smoke test is sent to Telegram unless G explicitly says otherwise.
- Smoke test format in Telegram is exactly three lines: line 1 `Smoke test <build/version>`, line 2 the Vercel link, line 3 a super brief description of changes plus what G should do next.
- When possible, provide desktop links in chat because integrations are easier for G on the computer. Use Telegram/mobile links when necessary or explicitly requested.
- If G says to check the latest screenshots, look in Dropbox first.
- If G needs to copy/paste something, provide a copyable block or local file/link automatically and make it easy to copy.
- Every final work brief must be super brief. Put any questions at the end under `Questions:` because G will not see buried questions.
- Always security review before deploy.
- Keep aiASAP separate from iSolve.
- Keep final briefs short and include decisions needed.
- Do not start LiveAvatar sessions while the provider issue is being investigated.

## Restart Checklist

1. Confirm path is `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
2. Read `PROJECT_MEMORY.md` and this handoff before making product decisions.
3. Run `git status --short` and preserve any user/other-assistant changes.
4. Keep Codex on aiASAP only; Claude owns iSolve.
5. Before meaningful product/code/database changes: audit first, give G the plan, get explicit approval, then build.
6. When a build/deploy/review URL is ready, send G a Telegram smoke-test message unless he explicitly says otherwise.
7. After G runs a smoke test, inspect Supabase for sessions, transcripts, conversation messages, account/list/reminder rows, bug reports, or errors. Summarize what was learned before recommending fixes.
8. Before external-service work, verify routes for Vercel, Supabase, GitHub, Resend, Telegram, and any other required provider.
9. Keep the final response brief and put questions last.
