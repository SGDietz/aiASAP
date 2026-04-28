# aiASAP Reboot Handoff - 2026-04-27

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
