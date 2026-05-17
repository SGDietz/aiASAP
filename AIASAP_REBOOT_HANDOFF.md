# aiASAP Reboot Handoff - 2026-04-27

## YouTube Banner / Social CENTCOM URL Preview - 2026-05-06 8:28 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "YouTube Banner / Social CENTCOM URL Preview - 2026-05-06 8:28 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Before any future build/deploy or smoke test, check queued user messages first. Current preview is https://ai-asap-jggf6sm6o-team-dietz.vercel.app/social, deployment dpl_HuWdyoDZUR99qYiRFFCC1v5EDBTT. YouTube public URL is https://www.youtube.com/@aiASAP-1, channel ID URL is https://www.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw, and Studio customization URL is https://studio.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw/editing/profile. The rebuilt YouTube banner is public/social-artwork/v12/youtube-banner-2560x1440.png, 2560x1440, 1094635 bytes, with logo and Six's full face inside the center safe area. Do not store tokenized Google Brand Account rapt URLs. Use Comet only if browser work is needed and do not move/resize the browser window.
```

- G asked to recreate the YouTube banner so it works across TV, desktop, and mobile the way YouTube wants it.
- G added an artwork cleanup rule: when new artwork makes old versions invalid or unusable, identify and delete the obsolete garbage instead of leaving broken assets around. Because deletion is destructive, list exact files/folders first unless G has already named the exact cleanup target.
- Action taken:
  - Rebuilt `public/social-artwork/v12/youtube-banner-2560x1440.png` at `2560x1440`, `1094635` bytes.
  - Updated `tools/generate_social_artwork_v12.py` so the banner has a full TV canvas and keeps the logo/Six's full face inside the scaled center safe area.
  - Updated Social CENTCOM YouTube data in `src/components/SocialPostingHub.tsx`: handle `@aiASAP-1`, public URL, channel ID URL, Studio customization URL, and the channel-picture task uses `x-profile-400.png`.
  - Updated `public/social-artwork/v12/manifest.json` with the YouTube handle/public URL/channel ID and the all-device banner note.
  - Refreshed `public/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip`.
- Important URLs:
  - Public handle: `https://www.youtube.com/@aiASAP-1`
  - Public channel ID: `https://www.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw`
  - Studio customization: `https://studio.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw/editing/profile`
- The tokenized Google Brand Account URL with `rapt=` was not stored.
- Verification passed:
  - `npm.cmd run typecheck`
  - `python -m py_compile tools/generate_social_artwork_v12.py`
  - ZIP entries include `manifest.json`, `x-profile-400.png`, and `youtube-banner-2560x1440.png`
  - Preview deploy target `preview`, status `Ready`
  - Protected `/social` check found `@aiASAP-1`, the public YouTube URL, the Studio customization URL, `x-profile-400.png`, and `youtube-banner-2560x1440.png`
  - Banner asset HEAD returned `200`, `Content-Type: image/png`, `Content-Length: 1094635`
  - Install ZIP HEAD returned `200`, `Content-Type: application/zip`, `Content-Length: 10654326`
  - Preview error logs found no logs
- Latest preview only:
  - URL `https://ai-asap-jggf6sm6o-team-dietz.vercel.app/social`
  - Deployment `dpl_HuWdyoDZUR99qYiRFFCC1v5EDBTT`
  - `aiasap.ai` was not touched.
- Live YouTube update:
  - After G said the refreshed YouTube channel was still wrong and to do it correctly, Codex opened a separate Codex-only Comet window, uploaded the corrected banner to the correct `aiASAP` YouTube channel, clicked Publish, and verified the public channel view.
  - Live public channel `https://www.youtube.com/@aiASAP-1` now shows the corrected banner with Six's full face visible in the desktop strip.
  - G told Codex to leave his active Comet work alone and use its own pages/windows. Future browser work must use a separate Codex-owned Comet window/tab and avoid interacting with G's active browsing.
  - Cleaned up 26 temporary YouTube/Comet screenshot files from the repo root after verification.
- Next move:
  - Continue to the next social platform only after G says what to do next.

## TikTok Profile Install - 2026-05-06 9:08 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "TikTok Profile Install - 2026-05-06 9:08 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Before any future build/deploy or smoke test, check queued user messages first. YouTube is live at https://www.youtube.com/@aiASAP-1 with the corrected banner. TikTok is live at https://www.tiktok.com/@aiasap.ai with the aiASAP profile image and short bio `TurboCharge Your Life by Talking to Your Computer. The All-In-One App (beta).` TikTok bio limit is 80 characters, so the full X bio cannot fit there. Use separate Codex-owned Comet pages/windows only; leave G's active Comet work alone.
```

- G said `next. go`, so Codex continued from YouTube to the next saved Social CENTCOM platform: TikTok.
- Browser boundary:
  - Used a separate Codex-owned Comet window for TikTok.
  - Do not use or navigate whatever G is actively working on in Comet.
- TikTok public URL:
  - `https://www.tiktok.com/@aiasap.ai`
- Live TikTok state after install:
  - Account name: `aiASAP`
  - Username/handle: `aiasap.ai`
  - Profile image: aiASAP/Six square profile image uploaded and visible.
  - Bio: `TurboCharge Your Life by Talking to Your Computer. The All-In-One App (beta).`
  - TikTok bio limit is `80` characters; this installed bio is `77` characters.
  - Full X bio does not fit TikTok.
- Cleanup:
  - Deleted 8 temporary TikTok screenshot files from the repo root after verification.
- Next move:
  - Continue to Facebook when G says go.

## Bedtime Supabase List Fine-Tune - 2026-05-05 11:35 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Bedtime Supabase List Fine-Tune - 2026-05-05 11:35 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Before any future build/deploy or smoke test, check queued user messages first. Current preview is https://ai-asap-iu1iypiie-team-dietz.vercel.app, deployment dpl_DGXKzcbPeuUjdTSpE8JzNompU4hg, Telegram smoke message 370. Visible under-logo line is back to "Take the Leap"; TurboCharge Your Life remains a broader brand/practice theme. sup means Supabase only; ss means Supabase plus screenshots. Use Comet only if browser work is needed. Do not open the Codex right sidebar unless absolutely necessary. If there is more than one issue, make a checklist and work down it before reporting done.
```

- G said good night and asked to commit the current state to memory.
- Latest Supabase-driven pass:
  - Checked latest Supabase transcript session `efa2d009-a6b5-4d2f-9562-127c9e61bcc6`, 177 rows, latest `2026-05-06T03:09:57.709746+00:00`.
  - Built and completed a checklist from the transcript before deploying/smoking.
  - Fixed shopping-list multi-item speech such as `bananas, blueberries, bread and butter`.
  - Added ASR correction handling for `I said jam, not damn`, normalizing `jam like jelly` to `Jam`.
  - Blocked bad filler items including `damn`, `dam`, `there we go`, `we go`, `up`, and `my`.
  - Fixed natural to-do item speech like `level the pool table`.
  - Fixed named-list routing so `put the grocery list up`, `bring up the grocery list`, `where's the grocery list`, and `did we make a Walmart list yet` open/check/switch lists instead of adding junk.
  - Changed `remove/delete the Walmart list` behavior to actually delete the named list.
  - Strengthened native LiveAvatar transcript filtering for short fragments like `What else`, `All`, `What do`, `Looks like`, `I`, `The`, and `Got it! Your To`.
  - Updated `tools/update_liveavatar_context.py` and pushed LiveAvatar context successfully with code `1000`.
- Files intentionally touched in the latest pass:
  - `src/components/LiveAvatarSession.tsx`
  - `app/api/liveavatar/session-transcript/sync/route.ts`
  - `tools/update_liveavatar_context.py`
  - This handoff/memory set after G asked for bedtime memory.
- Latest preview only:
  - URL `https://ai-asap-iu1iypiie-team-dietz.vercel.app`
  - Deployment `dpl_DGXKzcbPeuUjdTSpE8JzNompU4hg`
  - Telegram smoke message `370`
  - `aiasap.ai` was not touched.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx app\api\liveavatar\session-transcript\sync\route.ts tools\update_liveavatar_context.py`
  - `npm.cmd run typecheck`
  - LiveAvatar context update code `1000`
  - Vercel preview build READY
  - `npx.cmd vercel inspect https://ai-asap-iu1iypiie-team-dietz.vercel.app --timeout 120s`
  - `npx.cmd vercel curl / --deployment https://ai-asap-iu1iypiie-team-dietz.vercel.app`
  - `npx.cmd vercel logs dpl_DGXKzcbPeuUjdTSpE8JzNompU4hg --no-follow --level error --since 10m` returned no logs.
- Current operating rules to preserve:
  - Ask before every non-requested change; only change what G asks for.
  - Preserve dirty worktree and ignore unrelated changes.
  - Check queued user messages before any future build/deploy/smoke.
  - Work in Vercel previews only; do not promote or alias to `aiasap.ai` unless G explicitly says so.
  - For smoke tests, send Telegram and thread links only after the work/checklist is handled.
  - Use the open Comet browser/window if browser work is needed; do not use Microsoft Edge.
  - Do not open the Codex right sidebar or send clickable file links unless absolutely necessary.

## Multi-Task Checklist Rule - 2026-05-05

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Multi-Task Checklist Rule - 2026-05-05". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Before any future build/deploy or smoke test, check the queued user messages first. Any time Codex has more than one task or issue to handle, whether Supabase-related or not, make a concrete checklist, work down that checklist item by item, and only report done or send smoke after every listed item is fixed/accomplished or explicitly marked blocked/deferred.
```

- Standing rule from G:
  - Any time there is more than one task or issue, make a concrete checklist first.
  - This applies to Supabase passes and to all other multi-task work.
  - Work down the checklist item by item.
  - Do not report done, say everything is finished, or send smoke until every listed item is fixed/accomplished or explicitly blocked/deferred.

## Codex Right Sidebar Rule - 2026-05-05

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Codex Right Sidebar Rule - 2026-05-05". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Before any future build/deploy or smoke test, check the queued user messages first. Do not open the Codex right-side code/file preview sidebar unless it is absolutely necessary. Do not use clickable file links in normal replies because they open that sidebar; use plain filenames/paths unless G asks. If G needs to see something there, tell him first and let him decide to click/open it. If the sidebar must be opened, close it as soon as it is no longer needed.
```

- Standing UI rule from G:
  - Do not open the Codex right-side code/file preview sidebar unless it is absolutely necessary for the active task.
  - Avoid clickable file links in normal replies because they open that sidebar.
  - Use plain filenames/paths unless G explicitly asks for clickable links.
  - If G needs to see something in the sidebar, tell him first and let him choose to click/open it.
  - If the sidebar has to open, close it immediately after it is no longer needed.

## Laptop Sides Four-Smidge Preview - 2026-05-04 10:54 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Sides Four-Smidge Preview - 2026-05-04 10:54 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-3bqblxaxr-team-dietz.vercel.app, deployment dpl_J888fLV323P6r8uK37pFNLBZpYks. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop pass: top and bottom stayed exactly the same; only left/right sides came inward four smidges each. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G requested only left/right inward four smidges each, with laptop top and bottom untouched.
  - Refined only the laptop media override in `src/components/LiveAvatarSession.tsx` for `901px-1999px` wide and `680px+` tall CSS viewports.
  - Laptop logo stayed at `font-size: clamp(2.05rem, 4.05vh, 3.38rem)`.
  - Prompt stack top/bottom stayed `top: calc(var(--aiasap-lock-top) + 47.2vh)`, `gap: 0.24rem`, and `height: 2.36rem`.
  - Prompt width changed only from `min(100%, 43vw, 16.5rem)` to `min(100%, 41vw, 15.5rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-3bqblxaxr-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `4.05vh`, `3.38rem`, `47.2vh`, `15.5rem`, `41vw`, `2.36rem`, and `0.24rem`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_J888fLV323P6r8uK37pFNLBZpYks`
  - URL `https://ai-asap-3bqblxaxr-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.
- Telegram smoke was sent with the preview link and sides-only laptop action line.

## Laptop Sides Two-Smidge Preview - 2026-05-04 10:49 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Sides Two-Smidge Preview - 2026-05-04 10:49 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-iys1zlc1f-team-dietz.vercel.app, deployment dpl_H5MMKnjk4iHY64N5cwq1XMgGy1zk. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop pass: top and bottom stayed the same; only left/right sides came inward two smidges each. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G said laptop top and bottom look great and requested only left/right inward two smidges each.
  - Refined only the laptop media override in `src/components/LiveAvatarSession.tsx` for `901px-1999px` wide and `680px+` tall CSS viewports.
  - Laptop logo stayed at `font-size: clamp(2.05rem, 4.05vh, 3.38rem)`.
  - Prompt stack top/bottom stayed `top: calc(var(--aiasap-lock-top) + 47.2vh)`, `gap: 0.24rem`, and `height: 2.36rem`.
  - Prompt width changed only from `min(100%, 44vw, 17rem)` to `min(100%, 43vw, 16.5rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-iys1zlc1f-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `4.05vh`, `3.38rem`, `47.2vh`, `16.5rem`, `43vw`, `2.36rem`, and `0.24rem`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_H5MMKnjk4iHY64N5cwq1XMgGy1zk`
  - URL `https://ai-asap-iys1zlc1f-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Laptop Logo / Four-Smidge In-Up Preview - 2026-05-04 10:45 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Logo / Four-Smidge In-Up Preview - 2026-05-04 10:45 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-aepoa5vjo-team-dietz.vercel.app, deployment dpl_6hD1BdeQsAvNsWdnHaUUKs8S6qE5. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop pass: aiASAP top name is one font size smaller; pillboxes moved up four smidges and left/right came inward four more smidges. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G requested laptop-only: make `aiASAP` top name one font size smaller, move pillboxes up four smidges, and bring left/right inward four smidges again.
  - Refined only the laptop media override in `src/components/LiveAvatarSession.tsx` for `901px-1999px` wide and `680px+` tall CSS viewports.
  - Laptop `aiASAP` logo now uses `font-size: clamp(2.05rem, 4.05vh, 3.38rem)`.
  - Prompt stack changed to `top: calc(var(--aiasap-lock-top) + 47.2vh)`, `gap: 0.24rem`, `height: 2.36rem`, and `width: min(100%, 44vw, 17rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-aepoa5vjo-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `4.05vh`, `3.38rem`, `47.2vh`, `17rem`, `2.36rem`, `0.24rem`, and `44vw`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_6hD1BdeQsAvNsWdnHaUUKs8S6qE5`
  - URL `https://ai-asap-aepoa5vjo-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Laptop Three-Side Four-Smidge Preview - 2026-05-04 10:40 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Three-Side Four-Smidge Preview - 2026-05-04 10:40 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-b6k9fh0ho-team-dietz.vercel.app, deployment dpl_7ctbkNoGtLLsAhuu2AhEAi4v6YQo. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop smidge pass: top stayed the same; bottom, left, and right all came inward four smidges. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G said the layout is getting better and requested bottom, left, and right all come in four smidges, with the top unchanged.
  - Refined only the laptop media override in `src/components/LiveAvatarSession.tsx` for `901px-1999px` wide and `680px+` tall CSS viewports.
  - Top stayed `top: calc(var(--aiasap-lock-top) + 47.8vh)`.
  - Prompt stack geometry changed from the prior smidge pass to `gap: 0.28rem`, `height: 2.46rem`, and `width: min(100%, 46vw, 18rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-b6k9fh0ho-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `47.8vh`, `18rem`, `2.46rem`, `0.28rem`, and `46vw`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_7ctbkNoGtLLsAhuu2AhEAi4v6YQo`
  - URL `https://ai-asap-b6k9fh0ho-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Laptop Smidge Adjustment Preview - 2026-05-04 10:33 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Smidge Adjustment Preview - 2026-05-04 10:33 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-oesphm9v8-team-dietz.vercel.app, deployment dpl_2i5usF86ZawFwARGRMS9yBuUA68B. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop smidge pass: no screenshot loop per G; keep the laptop prompt stack top the same, bring the bottom up by tightening height/gap, and bring both sides in slightly. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G said the laptop was still exactly the same, then instructed: bring it up eight smidges from the bottom on laptop, bring sides in two smidges on both sides, leave the top the same.
  - G then said that for smidges, do not worry about screenshots; just do it.
  - Refined only the laptop media override in `src/components/LiveAvatarSession.tsx` for `901px-1999px` wide and `680px+` tall CSS viewports.
  - Top stayed `top: calc(var(--aiasap-lock-top) + 47.8vh)`.
  - Prompt stack geometry changed to `gap: 0.32rem`, `height: 2.56rem`, and `width: min(100%, 48vw, 19rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-oesphm9v8-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `1999px`, `680px`, `47.8vh`, `19rem`, `2.56rem`, and `0.32rem`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_2i5usF86ZawFwARGRMS9yBuUA68B`
  - URL `https://ai-asap-oesphm9v8-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Laptop Screenshot-Checked Refinement Preview - 2026-05-04 10:25 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Screenshot-Checked Refinement Preview - 2026-05-04 10:25 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-81r39oc3a-team-dietz.vercel.app, deployment dpl_374TimQtKZ3HMHwHtUEKLx2WmJwg. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop screenshot `unnamed.png` was checked locally before output: wide/tall laptop open prompt pills now hit `780px+` CSS height, are about the blue-line width, shorter, tighter, and sit in the marked torso zone. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G said the laptop did not change and told Codex to try again from the last screenshot.
  - G then added the rule: create screenshots inside Codex's own system and check them before outputs.
  - Used Comet, not Edge, with a temporary local debug profile to create and inspect `tmp-comet-laptop-prompt-check.png`.
  - Created and inspected `tmp-laptop-reference-predicted-overlay.png` on top of G's `unnamed.png` blue-line screenshot before deploying.
  - Refined only the wide/tall laptop override in `src/components/LiveAvatarSession.tsx` for `901px+` wide and `780px+` tall CSS viewports.
  - Open prompt pills now use `top: calc(var(--aiasap-lock-top) + 47.8vh)`, `gap: 0.28rem`, `height: 2.48rem`, and `width: min(100%, 46vw, 15.5rem)`.
  - Added `/tmp-comet*/` to `.vercelignore` so Comet screenshot profiles never get uploaded to Vercel again.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - local Comet screenshot/check at `1903x904`
  - local overlay check against `C:\Users\sgdie\Dropbox\Codex\Screenshots\unnamed.png`
  - `git diff --check -- src\components\LiveAvatarSession.tsx .vercelignore AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt`
  - local `npm.cmd run build` compiled and hit only the known Dropbox `.next\export` EBUSY cleanup lock
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-81r39oc3a-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `780px`, `47.8vh`, `15.5rem`, `2.48rem`, and `0.28rem`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_374TimQtKZ3HMHwHtUEKLx2WmJwg`
  - URL `https://ai-asap-81r39oc3a-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Laptop Blue-Line Refinement Preview - 2026-05-04 10:12 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Blue-Line Refinement Preview - 2026-05-04 10:12 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-9i0wbjfsl-team-dietz.vercel.app, deployment dpl_7tXAhZuC8xsqsKdCwhxtnxvwzi77. Before any future build/deploy or smoke test, check the queued user messages first. Latest laptop screenshot `unnamed.png` blue-line pass: wide/tall laptop open prompt pills are narrower, shorter, tighter, and moved north to fit the marked torso zone. Short-height desktop and iPad/tall-tablet rules stayed untouched. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G provided `C:\Users\sgdie\Dropbox\Codex\Screenshots\unnamed.png` labeled `laptop` with blue placement lines.
  - Refined only the wide/tall laptop override in `src/components/LiveAvatarSession.tsx` for `901px+` wide and `841px+` tall viewports.
  - Open prompt pills now use `top: calc(var(--aiasap-lock-top) + 48.2vh)`, `gap: 0.3rem`, `height: 2.36rem`, and `width: min(100%, 42vw, 13.5rem)`.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - `npm.cmd run build`
  - local built-client string check found the new laptop values
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-9i0wbjfsl-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found `48.2vh`, `min(100%, 42vw, 13.5rem)`, `2.36rem`, and `0.02rem`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_7tXAhZuC8xsqsKdCwhxtnxvwzi77`
  - URL `https://ai-asap-9i0wbjfsl-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.
- Telegram smoke was sent with the preview link and laptop blue-line action line.

## Laptop2 Blue-Line Placement Preview - 2026-05-04 10:00 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop2 Blue-Line Placement Preview - 2026-05-04 10:00 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-3dstzdqye-team-dietz.vercel.app, deployment dpl_29APTXwF6KyvHgLsdykS6f63X43Z. Before any future build/deploy or smoke test, check the queued user messages first. Laptop2 blue-line placement pass only: wide/tall laptop open prompt pills now sit north in the same torso zone as the approved desktop placement. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G provided `C:\Users\sgdie\Dropbox\Codex\Screenshots\Laptop2.png` with blue placement lines.
  - Added a wide/tall laptop-only override in `src/components/LiveAvatarSession.tsx` for `901px+` wide and `841px+` tall viewports.
  - Open prompt pills now use `top: calc(var(--aiasap-lock-top) + 50.2vh)` in that laptop condition, matching the approved desktop torso-zone placement.
  - The short-height desktop rule stayed untouched. The iPad/tall-tablet override stayed untouched.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - `npm.cmd run build`
  - local built-client string check found the new `901px` / `50.2vh` rule
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-3dstzdqye-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found the new `901px` / `50.2vh` rule
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_29APTXwF6KyvHgLsdykS6f63X43Z`
  - URL `https://ai-asap-3dstzdqye-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.
- Telegram smoke was sent with the preview link and Laptop2 blue-line action line.

## iPad Header / Prompt Placement Preview - 2026-05-04 9:52 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "iPad Header / Prompt Placement Preview - 2026-05-04 9:52 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-h82su1gpt-team-dietz.vercel.app, deployment dpl_AsMRoVZPSdbEsBabA4dfH7iCCsM7. Before any future build/deploy or smoke test, check the queued user messages first. iPad/tall-tablet pass only: aiASAP logo a little bigger, Take the Leap letter spacing narrowed without changing text size, prompt pills moved north and narrowed. No Telegram smoke was sent because G explicitly said not to smoke test. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G provided `C:\Users\sgdie\Dropbox\Codex\Screenshots\iPad.png` and requested iPad-only tuning.
  - Added a tall-tablet override in `src/components/LiveAvatarSession.tsx` for `700px-900px` wide, `841px+` tall viewports.
  - `aiASAP` logo is a little bigger on iPad/tall tablet.
  - `Take the Leap` keeps the same text size but has tighter letter spacing and less left/right spread.
  - Open prompt pills move north from the previous tall-tablet placement and narrow to `min(100%, 46vw, 15rem)`.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - `npm.cmd run build`
  - local built-client string check found the new iPad values
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-h82su1gpt-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found the new iPad values
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_AsMRoVZPSdbEsBabA4dfH7iCCsM7`
  - URL `https://ai-asap-h82su1gpt-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.
- No Telegram smoke test was sent.

## Laptop Prompt Width Preview - 2026-05-04 9:45 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Laptop Prompt Width Preview - 2026-05-04 9:45 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-n48dt0ubw-team-dietz.vercel.app, deployment dpl_Cqg5ezQuu7YkjCdDzNrDsP9A5GUR. Before any future build/deploy or smoke test, check the queued user messages first. Desktop short-height prompt layout from G's perfect screenshot is locked; only the taller laptop open-prompt width was narrowed. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - G showed the laptop/taller-screen prompt pills as too wide, then showed the short-height desktop view as perfect.
  - Only changed the taller-screen open-prompt CSS in `src/components/LiveAvatarSession.tsx`: width cap is now `min(100%, 50vw, 16rem)`, max width is `16rem`, and font sizing matches the compact desktop feel.
  - The `@media (min-width: 768px) and (max-height: 840px)` desktop rule behind G's perfect screenshot was left unchanged.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - `npm.cmd run build`
  - local built-client string check found `width: min(100%, 50vw, 16rem)`
  - Vercel remote preview build
  - `npx.cmd vercel inspect https://ai-asap-n48dt0ubw-team-dietz.vercel.app` showed target `preview`, status `Ready`
  - protected root `vercel curl` returned app HTML
  - deployed client chunk check found the new `50vw, 16rem` rule
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_Cqg5ezQuu7YkjCdDzNrDsP9A5GUR`
  - URL `https://ai-asap-n48dt0ubw-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.
- Telegram smoke was sent with the preview link and action line.

## Build Your Socials Codex Doctrine Preview - 2026-05-04 9:35 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Build Your Socials Codex Doctrine Preview - 2026-05-04 9:35 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-8fseb1rm1-team-dietz.vercel.app, deployment dpl_ABmvMPpkY1VmNfXQREenLgHedPXA. Before any future build/deploy or smoke test, check the queued user messages first. Build Your Socials doctrine is super important: do not undersell what aiASAP/Codex can do. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope in this checkpoint:
  - `Build Your Socials` must explain the full aiASAP/Codex social lane and not undersell it.
  - Codex can help build the whole social machine: full brand, platform choices, gorgeous artwork, profile copy, content strategy, post copy, launch content, content calendar, command center, account-linking flows, platform-ready posts, and posting support for nearly any major site once connected.
  - User stays in the driver's seat: gas, brake, steering wheel, permissions, account ownership, and final publish/save approvals.
- Value promise: strong ROI on setup time because most planning, branding, artwork, content, setup, linking, and operation can happen by talking to 6 after permissions and account-owner steps are handled.
- Verification passed:
  - `python -m py_compile tools\update_liveavatar_context.py`
  - `git diff --check` for touched repo files
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` trailing-whitespace check
  - `npm.cmd run typecheck`
  - `npm.cmd run build`
  - LiveAvatar context push code `1000`
  - Vercel remote preview build
  - protected root metadata check
  - deployed prompt-brain social POST returned `Build Full Brand`, `Create Content`, `Link Accounts`, `Post Everywhere`
  - local built-client string check found the strengthened direct Build Your Socials response
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_ABmvMPpkY1VmNfXQREenLgHedPXA`
  - URL `https://ai-asap-8fseb1rm1-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Pocket Friend Dialogue Preview - 2026-05-04 9:28 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Pocket Friend Dialogue Preview - 2026-05-04 9:28 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-lqe8cfwhv-team-dietz.vercel.app, deployment dpl_6Gfb7sAUBX7ko6kRxWd3ofCMGEE6. Before any future build/deploy or smoke test, check the queued user messages first. Pocket-friend doctrine is now major dialogue: the more people use aiASAP and talk to 6, the more they should feel the power and ease; if you've got a phone, you've got a friend. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope shipped in preview only:
  - `tools/update_liveavatar_context.py` now makes the pocket-friend/power-and-ease doctrine a major part of 6's natural dialogue.
  - 6 should naturally explain that the more people use aiASAP and talk to him, the more amazed they should be by the power and ease of frontier AI.
  - 6 should connect that power to being in a person's pocket: pull him out any time, right when they need a buddy.
  - 6 should naturally use: `If you've got a phone, you've got a friend.`
  - 6 should tie the power to high-value life areas: relationships, financial freedom, social channels, content, business, brand, goals, lists, and next steps.
  - `PROJECT_MEMORY.md`, `STICKY_REBOOT_RULES.txt`, and `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` carry the same rule.
- Verification passed:
  - `python -m py_compile tools\update_liveavatar_context.py`
  - `git diff --check` for touched repo files
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` trailing-whitespace check
  - LiveAvatar context push code `1000`
  - local `npm.cmd run build`
  - `npm.cmd run typecheck` after build
  - Vercel remote preview build
  - protected root metadata check
  - prompt-brain default POST returned exact first four
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_6Gfb7sAUBX7ko6kRxWd3ofCMGEE6`
  - URL `https://ai-asap-lqe8cfwhv-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Prompt / Social Queue Preview - 2026-05-04 9:22 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Prompt / Social Queue Preview - 2026-05-04 9:22 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-jvln1c6o8-team-dietz.vercel.app, deployment dpl_539L2HtdNowgYh4QS3mmzbtRgkku. Before any future build/deploy or smoke test, check the queued user messages first. Current first four idea boxes are Create Financial Freedom, Build Relationships, Set & Track Life Goals, Build Your Socials. sup means Supabase only; ss means Supabase plus screenshots.
```

- Scope shipped in preview only:
  - Exact first four idea boxes: `Create Financial Freedom`, `Build Relationships`, `Set & Track Life Goals`, `Build Your Socials`.
  - Those four are sprinkled heavily through broad conversations when no stronger focused topic overrides them.
  - `Build Your Socials` explains the aiASAP/Codex social lane: brand, artwork, content, command center, account linking with permission, posting workflow, and user-controlled final approvals.
  - Root metadata now uses `aiASAP - Take the Leap` with `Easy AI for Everyone, ASAP`; old `aiASAP Life Builder` metadata is gone.
  - Social CENTCOM install helper copy no longer tells the installer to lead with Life Builder.
- Verification passed:
  - `npm.cmd run typecheck`
  - `python -m py_compile tools\update_liveavatar_context.py`
  - `git diff --check` for touched files
  - local `npm.cmd run build`
  - LiveAvatar context push code `1000`
  - Vercel remote preview build
  - protected root metadata check
  - protected `/social` copy check
  - prompt-brain default POST returned the exact first four
  - prompt-brain social POST returned `Build Full Brand`, `Create Content`, `Link Accounts`, `Post Everywhere`
  - prompt-brain broad life/goals POST returned `Set & Track Life Goals`, `Make More Money`, `Fix One Problem`, `Make Action Plan`
  - Vercel preview error logs found no logs
- Latest preview only:
  - Deployment `dpl_539L2HtdNowgYh4QS3mmzbtRgkku`
  - URL `https://ai-asap-jvln1c6o8-team-dietz.vercel.app`
  - `aiasap.ai` was not touched.

## Vercel-Default Deployment Posture - 2026-05-03

- G clarified that normal aiASAP work happens in Vercel. Codex is free to change and deploy Vercel builds as needed after reasonable checks.
- Write, push, promote, or alias any new aiASAP build to `https://aiasap.ai` or `https://www.aiasap.ai` only when G gives explicit permission for that specific domain move.
- Use Vercel deployment links/builds for review and smoke tests, plus Telegram delivery when a build link is ready.
- Domain writes always require explicit G permission plus security review.
- Preserve the current dirty worktree and keep Supabase checks gated by G saying `sup` or giving behavior feedback.
- Absolute queue-check law from G on 2026-05-04: before any final Vercel build/deploy and before any smoke test to Telegram or the thread, stop and review queued user instructions/messages first. Do not build, deploy, or smoke from stale assumptions. If the queue changes scope, handle it first.
- Current first-four idea boxes from G's 2026-05-04 evening correction: `Create Financial Freedom`, `Build Relationships`, `Set & Track Life Goals`, `Build Your Socials`. Sprinkle those four heavily through broad conversations. When users ask how aiASAP can build socials, 6 should explain the full aiASAP/Codex social lane: brand, artwork, content, command center, account linking with permission, posting workflow, and user-controlled final approvals.
- New shorthand from G: `ss` means check both Supabase and screenshots. When G says `ss`, read the latest full Supabase transcript sequence and check current Dropbox screenshots before deciding on a patch.
- Browser rule from G on 2026-05-04: do not use Microsoft Edge for aiASAP browser/screenshot work. Use Comet only. Local Comet path: `C:\Users\sgdie\AppData\Local\Perplexity\Comet\Application\comet.exe`.

## Core Doctrine + Social Mobile Fine-Tune Preview - 2026-05-04 5:25 PM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Core Doctrine + Social Mobile Fine-Tune Preview - 2026-05-04 5:25 PM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. Latest preview is https://ai-asap-mvj244y8h-team-dietz.vercel.app, deployment dpl_Av1h5nG5nz6UwiK9mpxU3Mo5jvQP. The public line is "Easy AI for Everyone, ASAP". Life Builder is a very important product lane, not the core identity. sup means Supabase only; ss means Supabase plus screenshots.
```

- G corrected the doctrine:
  - aiASAP's heart is AI as soon as possible: getting useful, friendly, state-of-the-art AI to every person in the world as fast as possible and making it easy.
  - Short public-facing line: `Easy AI for Everyone, ASAP`.
  - `Life Builder` is a very important product lane, but it is not the core identity.
- Action taken:
  - `tools/update_liveavatar_context.py` now carries the corrected doctrine and LiveAvatar context push succeeded with code `1000`.
  - `app/api/prompt-brain/route.ts` now describes the core as `Easy AI for Everyone, ASAP` and keeps Life Builder as a major lane.
  - `src/components/LiveAvatarSession.tsx` no longer says `Build a Better Life` is the core of aiASAP.
  - `src/components/SocialPostingHub.tsx` hero/profile copy now says `Easy AI for Everyone, ASAP`; mobile Social CENTCOM layout was tightened to single-column platform cards with constrained width and no old `Life Builder at its core` copy.
  - `app/layout.tsx` metadata now uses `aiASAP - Easy AI for Everyone, ASAP`.
  - `public/social-artwork/v12/manifest.json` and the approved install ZIP now carry the corrected brand rule.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`, `PROJECT_MEMORY.md`, and `STICKY_REBOOT_RULES.txt` now record the correction.
  - `.vercelignore` now excludes local screenshot/temp browser artifacts so Vercel deploys do not hit locked temp cookie files.
- Latest preview only, not production/domain:
  - Deployment `dpl_Av1h5nG5nz6UwiK9mpxU3Mo5jvQP`.
  - Preview URL `https://ai-asap-mvj244y8h-team-dietz.vercel.app`.
  - Social CENTCOM `https://ai-asap-mvj244y8h-team-dietz.vercel.app/social`.
  - `aiasap.ai` was not touched.
  - Telegram smoke test was sent with the preview link and action line.
- Verification passed:
  - `git diff --check` passed for touched repo files with normal Windows CRLF warnings only.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` trailing-whitespace scan passed.
  - `npm.cmd run typecheck` passed.
  - `python -m py_compile tools\update_liveavatar_context.py` passed.
  - `npm.cmd run build` passed locally.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-mvj244y8h-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - Protected `vercel curl /social` found `Easy AI for Everyone, ASAP` and did not find old `Life Builder content, approved once` / `Life Builder at its core` social copy.
  - Protected `vercel curl /` found the new tagline metadata and did not find old `aiASAP is a Life Builder` metadata.
  - `npx.cmd vercel logs https://ai-asap-mvj244y8h-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
- Local note:
  - Local `next dev` on `3004` and `next start` on `3005` became unreliable after screenshot/build churn because of Next devtools/local `.next` output issues. Use the verified Vercel preview as the review source unless restarting local servers cleanly.
  - Future browser/screenshot checks must use Comet only, not Microsoft Edge.

## Dinner / Nap Stand-Down - 2026-05-03 2:34 PM ET

- G said everything looks great and explicitly approved pushing the current aiASAP build to the live domain before shutting Codex down for a couple hours.
- Production/domain deploy completed:
  - Production deployment `dpl_32tTMm3gL1rZnXdjnBxC9i4QV77g`.
  - Live domain `https://aiasap.ai`.
  - Vercel production URL `https://ai-asap-8czcz14l2-team-dietz.vercel.app`.
  - Vercel aliases confirmed: `https://aiasap.ai`, `https://www.aiasap.ai`, `https://ai-asap.vercel.app`, and team aliases.
- Final user-facing changes in this shutdown batch:
  - Locked-stage/mobile/desktop pillbox and list-box visual tuning is live.
  - Final desktop pillbox pass brought left/right sides inward only; desktop font, height, vertical placement, padding, and gaps were left unchanged.
  - Final mobile pass kept pillbox dimensions unchanged and set mobile font one point smaller than the prior oversized test.
  - Prompt logic/list-guard work from the same dirty tree is included in the production deployment: relationship/dating prompts stay contextual, hot-topic idea boxes stay focused, and product-review/list-label chatter is blocked from opening lists or adding junk list items.
- Security/release gate:
  - `npm.cmd run typecheck` passed.
  - `git diff --check` passed with CRLF warnings only.
  - Deploy-relevant changed-file secret scan passed across 22 files.
  - Local `npm.cmd run build` compiled and generated static pages, then hit the known Dropbox `.next\export` cleanup lock; Vercel remote production build passed cleanly and is the final build gate.
  - `https://aiasap.ai` returned HTTP `200` and app HTML.
  - `npx.cmd vercel logs dpl_32tTMm3gL1rZnXdjnBxC9i4QV77g --no-follow --level error --since 10m` found no logs.
  - Telegram smoke test was sent with the live domain and production preview URL.
- No Supabase check was done for the final shutdown push because this was visual/layout plus production-release verification; relevant backend verification was Vercel live domain, aliases, and logs.
- Important restart posture:
  - Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
  - Read this section first, then `PROJECT_MEMORY.md`, then only check Supabase if G asks `sup` or gives post-test behavior feedback.
  - Do not revert unrelated dirty files. This workspace has many pre-existing modified/deleted/untracked files.
  - If G returns with screenshots, check `C:\Users\sgdie\Dropbox\Codex\Screenshots` first and keep mobile accepted state locked unless he explicitly changes it.
  - Post-resume 2026-05-03 rule: default to Vercel builds/links. Use `--prod` or promote/alias to `aiasap.ai` / `www.aiasap.ai` only when G gives explicit permission for that specific domain move and the security review passes.

## Evening SS Sticky-Note/List Hotfix - 2026-05-03 9:08 PM ET

- G said `ss`; checked both Dropbox screenshots and latest Supabase session `5cc464e6-f9c3-45ff-93dd-f19b6b5f9957`.
- Screenshot/transcript lessons:
  - Desktop outside background around 6 had gone flat black; G wants the warm black/brown brand-color background restored outside the centered 6 frame.
  - Generic `let's make a list` must not immediately create `New List`. 6 should first ask: `What would you like to name the list? What are we making this a list of?`
  - Feedback/review speech such as `I want him to say...`, `once it's called grocery list`, and `go-to for most everyone` must not rename the active list.
  - After `Grocery List` exists, spoken items like `let's get bread`, `coffee`, `watermelon`, and `What else do I want? I need some taco shells` must land visibly on the note. 6 should not claim items were added unless the UI state actually changes.
  - `6, let's make another list called Walmart list` should create/open `Walmart List`, not reopen or rename the previous grocery note.
- Patch:
  - `src/components/LiveAvatarSession.tsx` adds a pending generic-list-name flow and exact naming prompt before creating an unnamed list.
  - The active-list rename guard now blocks product-feedback/meta phrasing from becoming list titles.
  - List item parsing now treats `get` as an add command and strips thinking preambles like `what else do I want?` before item inference.
  - CSS restores the warm radial brand background on `html`, `body`, and `.aiasap-viewport`, with a stronger desktop override.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with only the normal Windows CRLF warning.
  - `npm.cmd run typecheck` passed.
  - Local `npm.cmd run build` passed after clearing only generated `.next\export` inside the aiASAP workspace because Dropbox/Windows locked it.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-j1bswkpm0-team-dietz.vercel.app` shows target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-j1bswkpm0-team-dietz.vercel.app` returned app HTML.
  - Deployed chunk check found the new naming prompt, `what are we making this a list of`, the warm `105, 55, 18` background color, and the item-preamble parsing string.
  - Telegram smoke test was sent.
- Latest preview only, not production/domain:
  - Deployment `dpl_415TM8YMHdH7ZZb1VZmoQoaZZEtr`.
  - Preview URL `https://ai-asap-j1bswkpm0-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.

## Evening SS List-Add + Sticky-Line Hotfix - 2026-05-03 9:24 PM ET

- G said `ss`; checked Dropbox screenshot `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 211237.png` and latest Supabase session `dcaa9206-5f70-4e8e-81e7-caf406c3a006`.
- Transcript/screenshot lessons:
  - Generic `let's make a list` now correctly asked what to name it before showing a sticky note.
  - `Walmart List` opened correctly, but spoken items did not land on the UI. Coffee, cream, sugar, and blueberries were all claimed by LiveAvatar but `list_state` stayed empty and screenshots showed blank notes.
  - G said the most important thing was getting item additions working.
  - G also said the sticky-note body ended with only half a ruled line at the bottom, wasting space; ruled lines should distribute evenly through the whole note.
- Patch:
  - `src/components/LiveAvatarSession.tsx` adds live refs for `assistantLists`, `activeListId`, and `activeList`, and uses them in the speech list-mutation path so stale LiveAvatar event handlers do not drop additions.
  - `addItemsToList` now reads from live list refs, updates refs when it mutates, and logs `list_state` add events even if React state in the handler closure is stale.
  - New-list color/item prompt now asks what to put on the named list immediately while still allowing color changes by request.
  - Sticky-note ruled background now uses integer row-count variables (`6` compact rows, `12` shopping-mode rows) so the lines divide the body evenly instead of ending with a clipped half-line.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with only the normal Windows CRLF warning.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-2azebqr1i-team-dietz.vercel.app` shows target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-2azebqr1i-team-dietz.vercel.app` returned app HTML.
  - Deployed chunk check found the new `What would you like for me to put on your...` prompt and `--aiasap-list-row-count` ruled-line CSS.
  - Telegram smoke test was sent.
- Latest preview only, not production/domain:
  - Deployment `dpl_br2pwb95bmnTgXGxQ4VxAQSgZCvx`.
  - Preview URL `https://ai-asap-2azebqr1i-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.

## Evening SS Prompt/List-Name Hotfix - 2026-05-03 9:35 PM ET

- G said `ss`; checked Dropbox screenshots:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 212627.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 212748.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 212910.png`
- Checked latest Supabase session `846d0014-9647-4bfd-b945-111868bc8b97`.
- Transcript/screenshot lessons:
  - First four home pills were `Build a Better Life`, `Make More Money`, `Build a Business`, `Set Life Goals`. G wants `Build a Better Life` first and `Set Life Goals` second; `Make More Money` and `Build a Business` should rotate later, not be on the first page.
  - G said the pillboxes had become brown and he likes gray better.
  - Generic `6, let's make a list` incorrectly used prior product-feedback context and created `Build Business`.
  - For an unnamed generic list, the sticky note should show `Name This List`, and 6 should ask `What do you want to name this list?`
  - When G said `make this a Walmart list`, the note should become `Walmart List`; commentary like `changed to lavender`, `lavender list`, `color combo`, `user can change it`, and `make this instead` must not rename the note.
- Patch:
  - `src/components/LiveAvatarSession.tsx` default first four prompts are now `Build a Better Life`, `Set Life Goals`, `Build Your Socials`, `Make More Friends`.
  - Money/business prompts remain in later rotation, not the first screen.
  - Home pill background changed from brown to neutral gray while keeping gold text/border.
  - Product-feedback/list-review speech no longer updates `lastListTopicIntentRef`, so product feedback cannot name the next generic note.
  - Generic unnamed list starts now create/open a placeholder sticky note titled `Name This List` and ask `What do you want to name this list?`
  - Pending generic name answers rename the placeholder note instead of creating an extra note.
  - Active-list rename guard blocks lavender/color/commentary feedback from becoming list titles.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with only normal Windows CRLF warning.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-m90ccajdb-team-dietz.vercel.app` shows target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-m90ccajdb-team-dietz.vercel.app` returned app HTML.
  - Deployed chunk check found `Name This List`, `What do you want to name this list`, gray pill CSS `rgba(39,42,47,0.62)`, and the new default prompt labels.
  - Telegram smoke test was sent.
- Latest preview only, not production/domain:
  - Deployment `dpl_8VWzQLohzXbo9hA2YAcMcFAtEonv`.
  - Preview URL `https://ai-asap-m90ccajdb-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.

## Evening SS Friend/Walmart List Hotfix - 2026-05-03 9:49 PM ET

- G said `ss`; checked Dropbox screenshots:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 213745.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 213659.png`
- Checked latest Supabase session `4e726677-f330-48a4-af80-76180ce09820`, 91 rows, latest `2026-05-04T01:39:25Z`.
- Transcript/screenshot lessons:
  - Starter four are approved: `Build a Better Life`, `Set Life Goals`, `Build Your Socials`, `Make More Friends`.
  - Friend-context pills must not show `Plan First Invite` or `Start Conversation`; G asked to take both off.
  - `let's make a Walmart list` must ask first: `Should I make a Walmart list?`
  - Product-feedback rehearsal like `Should I make a Walmart list? ... Yes` must not create a duplicate list.
  - First Walmart list should stay yellow. Sticky notes should not auto-change colors or prompt for color on every new note; colors change only when the user asks.
  - `put blueberries` on an active Walmart list must visibly add blueberries to the note before LiveAvatar can claim success.
- Patch:
  - `src/components/LiveAvatarSession.tsx` changes friend follow-up pills to `Meet New People` and `Reconnect With Someone`.
  - Named list starts now confirm first instead of immediately opening; Walmart uses the exact confirmation line.
  - Pending list-start confirmations are canceled during product-feedback/rehearsal speech.
  - New-list color handling no longer arms a color-choice timer or rotates the note; it leaves the sequence color in place and says color can be changed by asking.
  - Active-list add commands now run early against the live active-list ref, clearing stale color-choice state and logging the UI mutation.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with only normal Windows CRLF warning.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-6ztnospc1-team-dietz.vercel.app` shows target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-6ztnospc1-team-dietz.vercel.app -- --silent --show-error` returned app HTML through protected preview auth.
  - Deployed chunk check found `Meet New People`, `Reconnect With Someone`, `Should I make a Walmart list?`, and `You can change the color anytime by asking`; `Plan First Invite` and `Start Conversation` were absent.
  - Telegram smoke test was sent, message id `289`.
- Latest preview only, not production/domain:
  - Deployment `dpl_7qncRQxtaYWp59fyEadHQW4un4Mc`.
  - Preview URL `https://ai-asap-6ztnospc1-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.

## Evening Supabase List Mutation Hotfix - 2026-05-03 10:02 PM ET

- G said `sup`; checked Supabase only, latest session `90e7056f-0fe0-413d-89a2-351360b7be0e`, 75 rows, latest `2026-05-04T01:53:03Z`.
- Transcript lessons:
  - Coffee successfully landed on the visible Walmart list, so the early add path worked for simple items.
  - `half and half` did not land because the parser split it into rejected `half` fragments.
  - `remove coffee from the list` did not update the visible list because removal still read stale `assistantLists` instead of the live refs.
  - Product-feedback speech like `had to ask 3 times`, `before he did it`, and `changed from yellow to purple` created a duplicate grocery note, which made the color sequence look like an unwanted color change.
  - The name prompt fired during list confirmation; name capture should not interrupt active pending-list creation.
- Patch:
  - `src/components/LiveAvatarSession.tsx` preserves `half and half` as one item and normalizes it to `Half and half`.
  - Direct remove commands now run early against the live active-list ref and `removeItemsFromList` updates `assistantListsRef` / `activeListRef`, matching the add path.
  - Negative feedback like `he did not remove coffee` is treated as feedback, not as a fresh remove prompt.
  - List-review guard now blocks `had to ask`, `before he did it`, `did finally do it`, `changed from yellow to purple`, and `no more changing colors` from creating lists or changing colors.
  - Name prompts are suppressed while a list-start confirmation or generic-list naming flow is pending, and active-list checks use the live active-list id.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with only normal Windows CRLF warning.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-ie6hxptoz-team-dietz.vercel.app` shows target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-ie6hxptoz-team-dietz.vercel.app -- --silent --show-error` returned app HTML through protected preview auth.
  - Deployed chunk check found `Half and half`, `halfandhalf`, `had to ask`, `I took`, `Meet New People`, and `Should I make a Walmart list`; `Plan First Invite` and `Start Conversation` were absent.
  - Telegram smoke test was sent, message id `290`.
- Latest preview only, not production/domain:
  - Deployment `dpl_E5Rsw899v4yZyPZ6JRXrSkq7TDk6`.
  - Preview URL `https://ai-asap-ie6hxptoz-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.

## Night Stand-Down - 2026-05-03 10:08 PM ET

- G asked to shut down for the night and restart cleanly from this exact place next time.
- Current lane/posture:
  - Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
  - Stay in Codex aiASAP lane only.
  - Preserve the dirty worktree; do not revert unrelated modified/deleted/untracked files.
  - Work in Vercel previews only. Do not deploy, promote, alias, or otherwise write to `https://aiasap.ai` unless G explicitly gives permission for that specific domain move.
  - `ss` means check both Dropbox screenshots and Supabase. `sup` means Supabase only.
- Current latest preview only:
  - Deployment `dpl_E5Rsw899v4yZyPZ6JRXrSkq7TDk6`.
  - Preview URL `https://ai-asap-ie6hxptoz-team-dietz.vercel.app`.
  - Telegram smoke test sent, message id `290`.
  - `aiasap.ai` was not touched.
- Latest fixed behavior in that preview:
  - Friend prompts no longer show `Plan First Invite` or `Start Conversation`; they use `Meet New People` and `Reconnect With Someone`.
  - `let's make a Walmart list` asks `Should I make a Walmart list?` before opening.
  - Sticky notes no longer auto-cycle colors; colors change only when the user asks.
  - `half and half` is preserved as one list item.
  - `remove coffee from the list` uses live list refs and should update the visible list.
  - Feedback like `he did not remove coffee`, `had to ask 3 times`, `before he did it`, `changed from yellow to purple`, and `no more changing colors` should not create lists, rename lists, or trigger remove prompts.
  - Name prompt should not interrupt pending list confirmation or generic-list naming flow.
- Latest verification:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with normal Windows CRLF warning only.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-ie6hxptoz-team-dietz.vercel.app` showed target `preview`, status `Ready`.

  - `npx.cmd vercel curl / --deployment https://ai-asap-ie6hxptoz-team-dietz.vercel.app -- --silent --show-error` returned app HTML.
  - Deployed chunk check found the relevant new strings and confirmed removed friend prompts were absent.
- First thing next session:
  - If G says `sup`, inspect the newest Supabase transcript after message id `290` and learn whether half-and-half add, coffee remove, duplicate-list prevention, and name-prompt suppression worked.
  - If G says `ss`, check both latest Dropbox screenshots and latest Supabase transcript.
  - Keep the answer short and continue patching/deploying previews as needed.

## Supabase + Screenshots Pill/List Placement - 2026-05-03

- G asked to check `sup` for the longer recent session and said two short sessions may not have registered.
- Supabase latest session groups confirmed:
  - Tiny follow-up `f771d4f1-e0b4-4ea2-9e25-d8e58219b8ce`, 1 row at about 8:47 AM ET.
  - Tiny follow-up `74a5d039-6317-4d2c-9d0b-5e29e790fe08`, 2 rows at about 8:44 AM ET.
  - Longer evidence session `83db49f5-25d6-4d59-925f-d0cd1ef7553a`, 21 rows from about 8:41-8:42 AM ET.
- Longer-session transcript lesson:
  - G said `build a business` and asked how 6 can help.
  - G corrected the pillboxes because they showed generic labels like `Organize Daily Tasks`, `Connect With New People`, and `Set New Goals` while the active topic was business.
  - The app falsely captured `a business` as the user's name and replied `A Business, it's a pleasure to meet you`.
- Screenshot evidence checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Desktop.png`.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Mobile.png`.
  - Both mark the lower torso/chest zone for boxes. G clarified list boxes should use the same exact area, and 6's hands should stay visible as much as possible because hands make 6 feel more real and comfortable.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: idea boxes are raised and tightened so the four pills sit in the marked lower torso/chest zone instead of covering the hands.
  - Compact list boxes now use the same zone, with less height and a higher bottom offset; longer lists scroll inside the box.
  - Added short-height CSS handling for `.aiasap-compact-list-panel`.
  - Name capture now rejects topic/label words such as `a`, `an`, `the`, `build`, `business`, `company`, `startup`, `organize`, `daily`, `tasks`, `connect`, `people`, `goals`, `prompt`, `pillbox`, `pillboxes`, `boxes`, `ideas`, and list/store words.
  - `tools/update_liveavatar_context.py`: cw source now says not to treat topic phrases like `a business`, `build a business`, `a list`, or idea-box labels as names.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`: records the shared idea-box/list-box lower torso/chest zone and the hand-visibility rule.
- Verification passed:
  - Supabase longer-session transcript read and desktop/mobile screenshots inspected.
  - Touched-file secret/conflict scan clean.
  - `python -m py_compile tools\update_liveavatar_context.py` passed.
  - `git diff --check` passed for repo-touched files; mission guide trailing-whitespace scan clean.
  - `npm.cmd run build` passed.
  - `npm.cmd run typecheck` passed.
  - LiveAvatar context pushed successfully: `SUCCESS context updated code=1000`.
  - Vercel remote build passed.
  - `vercel curl / --deployment https://ai-asap-j17busgsa-team-dietz.vercel.app` returned app HTML.
  - Preview `/api/prompt-brain` POST for business product feedback returned `Business Ideas`, `Likes and Loves`, `Your Passions`, and `What You're Good At`.
  - Vercel preview error logs found no logs.
- New preview only, not production/domain:
  - Deployment `dpl_omMPeu4koyFTNMak6QdfJtnimcUQ`.
  - Preview URL `https://ai-asap-j17busgsa-team-dietz.vercel.app`.
  - Share helper failed, so the preview URL is Vercel-auth protected.
  - Telegram smoke sent after G said `t smoke test`.
- Next smoke action: open the preview on desktop and mobile. Confirm idea boxes and normal list boxes both sit in the marked lower torso/chest area and leave 6's hands visible. In a business conversation, boxes should be business discovery boxes. If 6 asks for a name and the user says `a business` or `um`, he should not capture that as a name.
- No production/domain push and no Git push was made.

## Supabase Prompt Focus / Silence Recovery - 2026-05-03

- Supabase session checked before patching: `688a7302-3d10-4bc2-82b6-809c93c848ae`, latest `conversation_messages` window.
- Transcript lesson:
  - The hard-coded intro is now correct: `Hi, I'm 6, your a-i-buddy... better today?`.
  - `Complete Your Question` appeared in idea boxes and confused G.
  - During business flow, idea boxes drifted to broad/friendship prompts like `Build a Business`, `Make More Friends`, and conversation-starter ideas instead of staying business-only.
  - App-side name capture treated `Um` as the user's name.
  - G reported 6 was silent/cut off and expected him to answer, but the feedback path stayed too quiet.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: blocks filler names like `um`, `uh`, `hmm`, and `mm`; avoids name asks during silence/cutoff, "what were you saying", and prompt-box review; treats silence/cutoff as product feedback; answers briefly and returns to the active business or AI-business topic; and refreshes idea boxes from the active topic instead of broad defaults.
  - `app/api/prompt-brain/route.ts`: blocks generic coaching labels including `Complete Your Question`; product-feedback prompt-box review now preserves focused business or AI-consultant prompts instead of falling back to generic/friend boxes.
  - `tools/update_liveavatar_context.py` and `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`: same doctrine pushed into 6's cw and mission guide.
- LiveAvatar context pushed successfully: `SUCCESS context updated code=1000`.
- Verification passed:
  - Touched-file secret/conflict scan clean.
  - `python -m py_compile tools\update_liveavatar_context.py` passed.
  - `git diff --check` passed for repo-touched files; mission guide trailing-whitespace scan was clean.
  - `npm.cmd run build` passed.
  - `npm.cmd run typecheck` passed.
  - Vercel remote build passed.
  - `vercel curl / --deployment https://ai-asap-d0ppfpt9b-team-dietz.vercel.app` returned app HTML.
  - Preview `/api/prompt-brain` POST for business product feedback returned `Business Ideas`, `Likes and Loves`, `Your Passions`, `What You're Good At`.
  - Preview `/api/prompt-brain` POST for AI-boom/AI-consultant returned `AI Service Ideas`, `Pick Customer Type`, `Choose First Service`, `Write First Pitch`.
  - Preview `/api/prompt-brain` POST for `Complete Your Question` prompt-box review with business history returned the early business prompts and did not return `Complete Your Question`.
  - Broad Vercel error logs only showed two malformed PowerShell JSON probe attempts; tight post-fix log window found no logs.
- New preview only, not production/domain:
  - Deployment `dpl_EaLsrTtiKLoWcrNZ88TK1dobn2n5`.
  - Preview URL `https://ai-asap-d0ppfpt9b-team-dietz.vercel.app`.
  - Share helper failed, so the preview URL is Vercel-auth protected.
  - Telegram smoke is pending action-time confirmation.
- Next smoke action: start 6, choose or say `Build a Business`, ask what `Complete Your Question` means if it appears, say 6 is silent/cut off, and say `Um` when asked for a name. Expected: no `Complete Your Question`, business boxes stay business-only, 6 answers silence/cutoff and returns to business, and `Um` is not captured as the name.
- No production/domain push and no Git push was made.

## Supabase Leak / Business Discovery / Two-List Swipe - 2026-05-03

- Supabase session `1d21a783-3815-4682-84e2-510d0e848361` showed hidden name guidance leaking into user transcript/product feedback rows as `[Private guidance for 6: ...]`. That likely confused/stalled 6.
- Same transcript showed 6 jumped to generic business ideas like `Online Tutoring` before asking what the user liked/loved. G corrected that the first move is asking what the user likes, loves, is good at, and wants to build around.
- Same transcript lesson: once the path narrowed to AI consultant / AI boom, the four idea boxes should be concrete AI-consultant next steps that direct the user toward things they can do.
- Latest patch: `src/components/LiveAvatarSession.tsx` strips any future private-guidance leak from user text, stops appending hidden guidance to LiveAvatar user messages, asks the name through app-side speech after avatar responses, adds one-time spoken two-list navigation education, and adds AI-consultant idea-box prompts. `app/api/prompt-brain/route.ts` now runs deterministic focused-prompt rules before falling back when `OPENAI_API_KEY` is absent.
- Latest cw/mission updates: business discovery before generic ideas, AI consultant next-step boxes, and two-or-more-list guidance: users can swipe left/right with their thumb or simply ask 6 to switch/open next/previous/named lists.
- Latest preview deployment only, not production/domain: `dpl_P6EaCisBdYPouEHwL7D8eaBrUY13`.
- Latest preview URL: `https://ai-asap-amnuqbnm4-team-dietz.vercel.app`.
- Verification passed: Supabase transcript read, touched-file secret/conflict scan, Python `py_compile`, `git diff --check` with CRLF warnings only, `npm.cmd run build`, serial `npm.cmd run typecheck`, LiveAvatar context push code `1000`, Vercel remote build, protected `vercel curl / --deployment`, deployed prompt-brain POST returned `AI Service Ideas`, `Pick Customer Type`, `Choose First Service`, and `Write First Pitch`, corrected Telegram smoke, and tight final Vercel preview error logs found no logs.
- Earlier broad Vercel log window showed only the malformed PowerShell JSON prompt-brain smoke attempts made by Codex while validating the endpoint.
- Vercel share helper failed, so the preview URL is Vercel-auth protected.
- Telegram smoke action: start 6, say build a business then give me ideas; confirm no private guidance appears and 6 asks what you like/love before generic ideas. Then say AI boom/AI consultant and confirm boxes are `AI Service Ideas`, `Pick Customer Type`, `Choose First Service`, and `Write First Pitch`. Create two lists and confirm 6 says you can swipe with your thumb or ask him to switch lists.
- No production/domain push and no Git push was made.

## Focused Idea Boxes / Make More Friends / Spoken Brand - 2026-05-03

- Current-session name relationship patch: 6 should ask by the third meaningful 6 line, "And what should I call you?" This applies during lists, product feedback, and other live flows; only literal list-naming or interruption should delay it briefly. If the user gives a name, 6 acknowledges warmly and keeps helping. The app tracks the name only for the current beta session, avoids false captures from casual "I'm ..." phrases unless 6 just asked, and nudges LiveAvatar to use the name naturally every 6-10 meaningful interactions.
- Name-ask timing refinement: the fixed intro is considered the first line of banter. Target flow is fixed intro as line 1, user small talk, one useful 6 response as line 2, user keeps talking, then 6 answers and ends line 3 with "And what should I call you?" Do not ask for the name in the first generated reply after the intro. If 6 is interrupted or the name ask does not actually get spoken, ask immediately after the current spoken task clears.
- Files touched for this patch: `src/components/LiveAvatarSession.tsx`, `tools/update_liveavatar_context.py`, `PROJECT_MEMORY.md`, `AIASAP_REBOOT_HANDOFF.md`, and `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`.
- Latest name-timing preview deployment only, not production/domain: `dpl_8XqJJM2P8FHc3C9c3rZuVrK1JJm9`.
- Latest name-timing preview URL: `https://ai-asap-4ovrohsj7-team-dietz.vercel.app`.
- Latest name-timing verification passed: touched-file secret/conflict scan, Python `py_compile`, `git diff --check` with CRLF warnings only, `npm.cmd run typecheck`, `npm.cmd run build`, LiveAvatar context push code `1000`, Vercel remote build, protected `vercel curl / --deployment`, Telegram smoke, and Vercel preview error logs found no logs.
- Vercel share helper failed, so the latest preview URL is Vercel-auth protected.
- Latest Telegram smoke action: start 6, answer the intro, let 6 reply once, answer again or start a list. The next 6 reply should end with "And what should I call you?" even if a list is active. If interrupted before asking, 6 should ask immediately after the current spoken task clears.
- No production/domain push and no Git push was made for the latest name-timing patch.
- Current-session name preview deployment only, not production/domain: `dpl_6sfwpHkrWYJUqhDisjt6a73DpQ8A`.
- Preview URL: `https://ai-asap-gufqlaui7-team-dietz.vercel.app`.
- Verification passed: touched-file secret/conflict scan, Python `py_compile`, `git diff --check` with CRLF warnings only, `npm.cmd run typecheck`, `npm.cmd run build`, LiveAvatar context push code `1000`, Vercel remote build, protected `vercel curl / --deployment`, Telegram smoke, and Vercel preview error logs found no logs.
- Vercel share helper failed, so the preview URL is Vercel-auth protected.
- Telegram smoke action: start 6; after a couple normal replies he should ask what to call you. Say a test name like Sam. He should acknowledge it, then later use Sam naturally without saying it every answer.
- No production/domain push and no Git push was made.
- Follow-up list-fix preview after Supabase smoke failure: `dpl_DNXUiTiTgVfvzCC5dHSfvX7xxUhf`.
- Follow-up preview URL: `https://ai-asap-3hmclcl9g-team-dietz.vercel.app`.
- Supabase session `4c30472c-c761-470f-9a57-b1df4133d16e` showed intro fixed but lists still failing before the follow-up patch: G said `let's make a list` and `Okay, 6. Let's, um, let's do a grocery list`; `activeStickyNote` stayed null and no `list_state` rows appeared.
- Screenshot checked: `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 072148.png`; idea boxes are in the intended lower mobile zone and Terms remains visible.
- Follow-up patch: explicit list starts bypass product-review quiet mode and confirmation, direct `6.` addresses count as direct address, and `let's do a grocery list` opens immediately.
- Follow-up verification passed: `git diff --check`, touched-file secret/conflict scan, `npm.cmd run typecheck`, `npm.cmd run build`, Vercel remote build, protected `vercel curl`, Telegram smoke, and Vercel error-log check.
- Supabase schema note: active project reports `app_events`, `feedback_events`, and `preference_candidates` missing from PostgREST schema cache; app feedback is currently falling back into `conversation_messages`.
- Latest preview deployment only, not production/domain: `dpl_3MzVbKXNH9cTsJabCVynLAa63MeP`.
- Preview URL: `https://ai-asap-4r079f8kr-team-dietz.vercel.app`.
- Verification passed: `git diff --check`, touched-file secret/conflict scan, Python `py_compile`, `npm.cmd run typecheck`, `npm.cmd run build`, LiveAvatar context push code `1000`, Vercel remote build, and protected `vercel curl / --deployment`.
- Vercel share helper failed, so the preview URL is Vercel-auth protected.
- Telegram smoke test was sent. Test action: start 6; intro should say `a-i-buddy` and `better today`; say `Create a list of my strengths and weaknesses`; check list opens; talk business or friends and confirm all four idea boxes stay focused.
- Vercel preview error logs returned no logs.
- No production/domain push and no Git push was made.
- Focused idea-box rule: when the user is hot on one subject, all four idea boxes stay inside that subject and point to forward-thinking next actions.
- Supabase business idea-box lesson from session `40770eba-fe48-4a24-99dc-34cd2a1ceeb9`: early `Build a Business` boxes should be discovery-level: `Business Ideas`, `Likes and Loves`, `Your Passions`, and `What You're Good At`. Do not show `Pick First Customer`, `Write First Offer`, `Market Your Product`, or `Make More Friends` at the beginning of a business conversation.
- Supabase-driven business idea-box preview deployment only, not production/domain: `dpl_D1rZfMgriPEBU38WgNGQXW5LHFfA`.
- Supabase-driven business idea-box preview URL: `https://ai-asap-9w6swskdg-team-dietz.vercel.app`.
- Verification passed: Supabase full latest transcript read, touched-file secret/conflict scan, Python `py_compile`, `git diff --check` with CRLF warnings only, `npm.cmd run typecheck`, `npm.cmd run build`, LiveAvatar context push code `1000`, Vercel remote build, protected `vercel curl / --deployment`, Telegram smoke, and Vercel preview error logs found no logs.
- Vercel share helper failed, so the preview URL is Vercel-auth protected.
- Telegram smoke action: start 6 and choose `Build a Business`; confirm the four idea boxes stay early-stage business discovery, not `Pick First Customer`, `Write First Offer`, `Market Your Product`, or `Make More Friends`.
- No production/domain push and no Git push was made for this patch.
- `Make More Friends` is now a major aiASAP lane for friendship, community, and real human-to-human interaction.
- Safety/legal posture for friendship/dating/human-connection help: lawful, consent-driven, privacy-respecting, and non-manipulative. No harassment, pressure, deception, stalking, scraping private information, or ignoring boundaries.
- Spoken brand rule, corrected by G on 2026-05-04: every time 6 speaks the company name, say `a-i-ASAP`; written/UI/docs brand remains `aiASAP`.
- Exact hard-coded intro now uses dashes: `Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?`

## Explicit List / Relationship Preview Smoke - 2026-05-03

- Preview deployment only, not production/domain: `dpl_6aLCVT4QZvnN6hJMPgwSukWz5EqK`.
- Preview URL: `https://ai-asap-itnnttlw4-team-dietz.vercel.app`.
- Vercel remote build passed and deployment status is `READY`.
- `vercel curl / --deployment https://ai-asap-itnnttlw4-team-dietz.vercel.app` returned app HTML through protected preview auth.
- Vercel share helper failed, so the preview URL is Vercel-auth protected.
- Telegram smoke test was sent with action line: say `Let's make a list` and `I want a girlfriend`; the first should open a visible list, and dating prompts should appear only in romance context.
- Vercel preview error logs returned no logs.
- No production/domain push and no Git push was made.

## Supabase List-Start Lesson - 2026-05-03

- Latest smoke-test Supabase session `0af5a758-e098-4dbd-9f4d-3f911f8711dc` had mobile viewport `392x711`.
- User explicitly asked for a visible strengths/weaknesses list, including "Create a list of my strengths and weaknesses" and "go ahead and make a list."
- 6 talked about making the list but no active sticky note/list appeared; app-state fallback rows showed `activeStickyNote:null` and `visibleItems:[]`.
- Patch target: explicit commands like `Let's make a list`, `Create a list`, `Go ahead and make a list`, or `Create a list of/about/for X` should open a visible list immediately. Casual list mentions and product-review speech should remain guarded.
- MVP learning doctrine from G: treat this like a simple helpful feed algorithm. Supabase transcript/app-state evidence should raise common useful idea boxes, lower triggers users complain about, and let Codex brief G from user evidence rather than guesses. Keep default feed changes human-reviewed for MVP.
- Relationship/dating doctrine added in same patch stream: when a user clearly wants a boyfriend, girlfriend, partner, specific guy/girl, crush, or help asking someone out, 6 can help them get that guy or girl respectfully. Contextual prompts can include `Get That Guy`, `Get That Girl`, `Win Them Over`, `Plan First Message`, `Ask Them Out`, and `Plan a Date`. Guardrails: no stalking, harassment, manipulation, pressure, jealousy games, ignoring a no, or forcing someone who is not interested.

## Prompt Pill / Idea-Box Feed Batch - 2026-05-03

- G is batching prompt-pill changes and said not to worry about smoke tests right now.
- Local patch only so far; no LiveAvatar context push, Vercel preview, Telegram smoke, production/domain push, or Git push yet.
- Primary idea-box/prompt-pool doctrine now includes: `Build a Business`, `Build a Better Life`, `To Do List`, `Build Your Socials`, `Make More Money`, `Shopping List`, `Plan Your Weekend`, `Market Your Product`, `Market Your Service`, and `Next Vacation Ideas`.
- Normal-user wording: 6 should call them `idea boxes`. Internal/developer wording can remain prompt pills.
- 6 can say: "Those little boxes below are idea boxes. They are just quick ideas for us to talk about. Tap one, or just tell me what you need."
- Mission line: aiASAP is a tool for the mass adoption of AI, built to help people take the leap. 6 should know and be able to say this naturally.
- Product behavior: the idea-box feed should learn from what people generally ask aiASAP to do, like a simple helpful recommendation feed, not engagement bait.
- Local files updated: `src/components/LiveAvatarSession.tsx`, `app/api/prompt-brain/route.ts`, `tools/update_liveavatar_context.py`, `PROJECT_MEMORY.md`, and `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`.
- Added cw doctrine: 6 knows the current major site features, can offer a complete feature list, and should do the matching current feature when the user picks one.
- Feature-list scope: voice conversation, idea boxes, visible lists/sticky notes, add/remove/close/switch/rename/style lists, planning, online lookup with consent and city/ZIP, Make More Money/Build a Business/social/marketing/better-life conversations, current-session context, session controls, product feedback/transcript learning, and honest beta limits.
- Make More Money doctrine: 6 gives the vibe-coding backstory, explains plain-language work with AI, says that where aiASAP can already act it can `git her done`, then asks what the user loves and helps turn that into money/business ideas, offer, customer, price, first message, checklist, and next action.
- Mass-adoption doctrine: 6 knows aiASAP is specifically intended to prove AI can be used by everyone, including G's 91-year-old dad, older users, first-time users, and people who say technology is not for them. 6 should avoid insulting language, tell the SG Dietz founder/vibe-coding story, frame aiASAP as the next stage/future of websites, and use "If you've got a phone, you've got a friend" naturally.
- Overpromise guard: "do nearly everything by talking to me" is the full-build direction, not a claim that every feature is live today. 6 should explain current beta limits and then help with the closest current feature.
- Mom-and-pop doctrine: 6 should speak directly to mom-and-pop businesses, small local businesses, family shops, solo operators, tradespeople, landscapers, home service companies, local restaurants, and small retailers. 6 can say "Absolutely. This can help you build and grow your business," then help with offers, pricing, customer lists, marketing copy, service menus, social posts, website wording, follow-up messages, checklists, local promotion ideas, and next steps.
- Positioning doctrine: "The Smartest System in the World" is founder ambition/positioning, not a measured technical claim.
- Rule/bible update: 6 should be able to say, "If you wanna know what I can do, just ask," then accurately explain and use the current feature set.
- Standing rule: every future aiASAP behavior/feature update must keep 6's LiveAvatar context window current with what the site can do now and what it cannot do yet.
- Language refinement: G clarified 6 may use the word `retarded` when appropriate because many people proudly joke that they are technologically retarded / tech illiterate. 6 should only use it when the user self-describes that way or clearly uses that blunt language first; never as an insult, diagnosis, or label for strangers/groups. Default first-contact wording remains respectful.
- G said no smoke test is needed for this batch item. When G says the batch is ready for preview: run local checks, deploy Vercel preview, verify protected preview with `npx.cmd vercel curl / --deployment <preview-url>`, send Telegram smoke, and check Vercel error logs.

## Startup Bypass Drill Refresh - 2026-05-03

- G flagged that repeated startup discovery is unacceptable.
- Standing order: on startup, read `C:\Users\sgdie\Dropbox\Codex\AI_ASSISTANT_REBOOT_RULES.md`, `PROJECT_MEMORY.md`, and `AIASAP_REBOOT_HANDOFF.md`, then operate from them without making G restate known routes.
- Use the known bypass drill immediately:
  - Vercel preview deploy: `npx.cmd vercel deploy --yes` from `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
  - Protected preview verification: raw browser fetch may return `401`; use `npx.cmd vercel curl / --deployment <preview-url>`.
  - Share link: try the Vercel share helper once; if it fails, report protected-preview status and send the preview URL anyway.
  - Telegram smoke: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\send_telegram_smoke_test.ps1 ...`.
  - If Telegram/Vercel/network fetches are sandbox-blocked, rerun the same operation with escalation.
  - Post-smoke Vercel logs: `npx.cmd vercel logs <deployment-id> --no-follow --level error --since 10m`.
  - Dropbox `.next\export` cleanup or webpack cache locks after a successful compile are non-blocking when typecheck, secret scan, and Vercel remote build pass.
  - If `npm.cmd` or `npx.cmd` intermittently cannot be found in the sandbox, retry the same operation with escalation.

## Startup Bypass Preview Smoke - 2026-05-03

- Preview deployment only, not production/domain: `dpl_AHiEykg7rU6k638amRxRqdSvuamL`.
- Preview URL: `https://ai-asap-nw2pyffjj-team-dietz.vercel.app`.
- Vercel remote build passed and deployment status is `READY`.
- `vercel curl / --deployment https://ai-asap-nw2pyffjj-team-dietz.vercel.app` returned app HTML through Vercel protected preview auth.
- Vercel share helper failed once, so the Telegram smoke test and thread smoke link use the protected preview URL.
- Telegram smoke test was sent with action line: startup bypass drill written; test To Do List mobile placement too.
- Vercel preview error logs returned no logs.
- No production/domain push and no Git push was made.

## Deploy Rule Refresh - 2026-05-03

- G clarified the deploy ROE: every assistant change, rewrite, rule update, or code update gets a Vercel preview deploy after reasonable checks.
- Every assistant change/rewrite also gets a Telegram smoke test and a smoke-test link in the conversation thread.
- Do not wait for separate G approval for Vercel preview deploys.
- Production/domain promotion is still gated: no push/promote to `aiasap.ai`, `aiASAP.ai`, `iSolveUrProblems.ai`, or another live domain without explicit G approval plus security review.
- This supersedes older lines that said new Vercel preview iterations require G approval.

## Mobile List / Rules Preview Smoke - 2026-05-03

- Preview deployment only, not production/domain: `dpl_FiVyC99LVFWPWxRMDbP5DCGGjzrS`.
- Preview URL: `https://ai-asap-o975hbk63-team-dietz.vercel.app`.
- Vercel remote build passed and deployment status is `READY`.
- `vercel curl / --deployment https://ai-asap-o975hbk63-team-dietz.vercel.app` returned app HTML through Vercel protected preview auth.
- Telegram smoke test was sent with action line: test on phone, start a To Do List, and confirm the list box sits above Terms over 6's lower torso/hands.
- Vercel preview error logs returned no logs.
- Raw browser fetch returned `401` because the preview is Vercel-auth protected, and the share-link helper could not create a temporary share link. Use the preview URL above through an authenticated Vercel session if needed.
- No production/domain push and no Git push was made.

## Mobile List Placement Correction - 2026-05-03

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- G pointed to Dropbox mobile screenshot `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260502-165223~2.png` and said that is where the list box needs to be.
- Patch: compact mobile active-list card in `src/components/LiveAvatarSession.tsx` stays broad at `86vw`, moves lower into the red-marked lower avatar-frame zone over 6's lower torso/hands, and remains above the Terms footer.
- Desktop `md:` list-card geometry was left unchanged.
- `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` now carries the same mobile placement doctrine.
- Verification: `git diff --check -- src\components\LiveAvatarSession.tsx PROJECT_MEMORY.md AIASAP_REBOOT_HANDOFF.md` passed with existing CRLF warnings; `npm.cmd run typecheck` passed; touched-file secret scan was clean; local dev server returned HTTP `200` at `http://127.0.0.1:3001`.
- Build note: `npm.cmd run build` compiled successfully twice, then failed during generated `.next\export` cleanup / webpack cache rename because Dropbox held locks. No TypeScript or compile error was found.
- Deployed with the 2026-05-03 mobile list/rules preview smoke above. No production/domain push and no Git push.

## Reboot SOP Refresh - 2026-05-03

- G restated the AI assistant reboot rules for Codex and Claude.
- Root shared SOP now lives at `C:\Users\sgdie\Dropbox\Codex\AI_ASSISTANT_REBOOT_RULES.md`.
- The old 22-item rule list was streamlined into grouped operating sections so future assistants can understand it faster.
- Codex lane remains aiASAP. Claude lane remains iSolve unless G explicitly redirects.
- Rule 20 shorthand map now includes `cw` as context window in LiveAvatar.com, along with `sup` for Supabase, `t` for Telegram, and `db` for Dropbox.
- Rule 22 grants permission to run smoke tests through Vercel and send them to G on Telegram and in the conversation thread.
- Updated 2026-05-03: Vercel preview deploys and Telegram/thread smoke tests happen after every assistant change/rewrite. Only production/domain pushes need explicit G approval plus security review.
- LiveAvatar IDs for Codex/aiASAP remain `3cbe98e4-50ff-4e48-8954-7685fcf09dac`, `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930`, and `a65a59af-39bd-4f57-8cc6-235449ca3348`.
- This was a documentation/continuity update only. No code patch, Vercel preview, production/domain push, Git push, or smoke test was made.

## Preview Smoke Deploy - 2026-05-02 4:51 PM ET

- G approved a new Vercel preview smoke test.
- Security gate before deploy: `git diff --check`, touched-file secret scan, and `npm.cmd run typecheck` passed.
- Preview deployment only, not production/domain: `dpl_6WPirrb8xfGX4MGBABgLMgsSxrKx`.
- Preview URL: `https://ai-asap-2hf3dflmo-team-dietz.vercel.app`.
- Verified temporary share URL: `https://ai-asap-2hf3dflmo-team-dietz.vercel.app/?_vercel_share=UIQ4FH9p1pRsR4V4mBNnzKXRKYRRNDho`.
- Vercel remote build passed and deployment status is `READY`.
- Authenticated `vercel curl / --deployment ai-asap-2hf3dflmo-team-dietz.vercel.app` returned app HTML.
- Direct share URL fetch returned HTTP `200` and app HTML.
- Vercel preview error logs returned no logs.
- Telegram smoke test was sent twice: first raw protected URL, then corrected verified share URL with action line: start any list, confirm yes; list should match the red outline; close it and pillboxes come back.
- No production/domain push and no Git push was made.

## Opening Lead / List Confirmation Correction - 2026-05-02 3:37 PM ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- G said `Sup and db`; rule 20 maps that to Supabase and Dropbox.
- Latest Dropbox screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 152116.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 152136.png`
- Latest Supabase session checked: `2ea76fa6-121f-40cd-b25a-6990dcfc36e6`, 24 rows from about 3:21:09-3:21:44 PM ET.
- Transcript/screenshot lessons:
  - The old preview still used opening leads like `Find Places to Hike`.
  - The old preview opened a blank `Grocery List` / list box from prompt-review speech before the user clearly asked for a list and before 6 confirmed.
  - The active list box was too small and overlapped the terms line.
  - G wants generic opening leads that apply to most people: `To Do List`, `Make More Money`, `Shopping List`, `Plan Your Weekend`, `Next Vacation Ideas`, and similar broad everyday leads.
  - `Make More Money` should be used often because it can dramatically help people.
  - Phrases like `Make More Money should be a prompt often used` are product-review feedback, not normal user money tasking.
- Local patch only, not deployed:
  - `src/components/LiveAvatarSession.tsx` default opening leads now use `To Do List`, `Make More Money`, `Shopping List`, and `Plan Your Weekend`, with broader generic pool examples like `Next Vacation Ideas`, `Save Money`, `Plan Dinner`, and `Fix Something`.
  - `Take a Hike` is blocked as a prompt, and `Find Places to Hike` only appears when hiking/trails/outdoors are actually in context.
  - Opening-lead/list-box product review speech is guarded so it does not open a list, search, ZIP prompt, or list panel.
  - Tapping a fresh list lead asks confirmation first; a list opens only after a clear yes. Repeating the list label is not enough confirmation.
  - Full-screen shopping mode requires an explicit full-screen/store-mode request, and the normal active list panel is wider, taller, and lifted above the terms line.
  - `app/api/prompt-brain/route.ts`, `tools/update_liveavatar_context.py`, and `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` carry the same prompt/list doctrine.
- LiveAvatar context update succeeded with code `1000`.
- Verification passed: `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check`, and bundled Python `py_compile`.
- Local server was started at `http://127.0.0.1:3001`; direct HTTP returned `200`. Headless Edge screenshot automation timed out, so visual verification still needs G/browser review on the local or next Vercel preview.
- No Vercel preview deploy, Telegram smoke test, production/domain push, or Git push was made because G approval is required before a new Vercel iteration.
- Next move: ask G to approve a new Vercel preview smoke test. After approval, deploy preview, verify protected share, and send Telegram smoke test.

## Start Text Weight Correction - 2026-05-02

- G said `To Talk To 6` was too bold and smudged together.
- Local patch only, not deployed: `src/components/LiveAvatarSession.tsx` now renders the second start line as plain `To Talk To 6`, uses a cleaner system font stack, lighter `650` weight, and removes the same-color stroke shadow that was making the letters blur together.
- Verification passed: `git diff --check -- src/components/LiveAvatarSession.tsx`, touched-file secret scan, `npm.cmd run typecheck`, and `npm.cmd run build`.
- No Vercel preview deploy, Telegram smoke test, production/domain push, or Git push was made.

## Supabase Codec/List Hardening - 2026-05-02 3:09 PM ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- G said `sup`; rule 20 maps that to Supabase.
- Latest deployed Vercel preview confirmed by CLI: `https://ai-asap-7jiqi9cv5-team-dietz.vercel.app/?_vercel_share=Qo2iclEeJLOO1xo4YFsNhpSSKVGN1nhd`. Cookie-aware check returned HTTP `200`.
- Latest deployed preview is still old and does not include this local hardening.
- Latest Supabase session checked: `4091d314-2de5-46dd-9d80-60847cb44c08`, 76 rows from about 2:56:06-2:57:29 PM ET.
- Latest Dropbox screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 145602.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 145635.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 145659.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 145720.png`
- Transcript/screenshot lessons:
  - Codex/product-review speech was misread into codec prompt pills: `Compare Popular Codecs`, `Explain Video Codecs`, `Explain Audio Codecs`, `List Codec Uses`, and `Explain Different Codecs`.
  - The old deployed preview still opened a blank `Grocery List` from rehearsal/product-review speech instead of asking confirmation first.
  - Product-review fragments were added as grocery items: `Or let me`, `Let me make sure 6 can`, `He's`, and `Putting`.
  - G still sees the old active list panel as too thin.
- Local patch only, not deployed:
  - `src/components/LiveAvatarSession.tsx` now blocks codec prompt artifacts, treats codec/C-O-D-E-C-S label questions as product review, removes `Find Places to Hike` from generic defaults, keeps hiking prompts only in hiking context, blocks the new junk list fragments, and widens the active list panel to `39rem`.
  - `app/api/prompt-brain/route.ts` now blocks codec prompt generation, treats Codex/codecs label review as fallback/product context, and uses `To Do List` instead of generic hiking in fallback prompts.
  - `tools/update_liveavatar_context.py` now tells 6 that Codex/codecs confusion during app review is product feedback, not a codec topic, and blocks the new filler fragments.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` now carries the same prompt/list doctrine.
- Verification passed: `git diff --check`, bundled Python `py_compile`, token-shaped secret scan, `npm.cmd run typecheck`, `npm.cmd run build`, and LiveAvatar context update code `1000`.
- Telegram operational reply sent to G confirming the voice-note lane and latest Vercel link: message id `223`.
- G correctly flagged that message `223` was not a proper smoke test. Current deployed preview smoke test sent to Telegram as message id `224`.
- No Vercel preview deploy, production/domain push, or Git push was made because G approval is required before a new Vercel iteration.
- Next move: ask G to approve a new Vercel preview smoke test. After approval, deploy preview, verify protected share, and send Telegram smoke test.

## Shorthand Rule Refresh - 2026-05-02 Afternoon ET

- G added rules 20-21.
- Rule 20: `sup` means Supabase, `t` means Telegram, and `db` means Dropbox.
- Rule 21: if a shorthand or phrase is unclear, check `STICKY_REBOOT_RULES.txt` first before guessing or asking G.
- Older handoff headings that say `Rule 20 Transcript Hardening` are historical labels only; current rule 20 is the shorthand map above.
- This is a continuity-only update. No code patch, Vercel preview, production push, or smoke test was made for this refresh.

## Supabase Screenshot Correction - 2026-05-02 Afternoon ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- G said `supabase and check screenshots in dropbox`.
- Latest Dropbox screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 143410.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 143450.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 143546.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 143559.png`
- Supabase latest full `conversation_messages` session was `91db9122-afc1-4406-afe6-89336402f955`, 80 rows from about 2:34:19-2:36:08 PM ET.
- Transcript/screenshot lessons:
  - Prompt-label review speech like `Find places to hike comes up`, `they should not come up`, and `What does Explore Plan This Weekend mean` still triggered hike/weekend search consent or ZIP boxes.
  - Grocery-list rehearsal speech should make 6 ask `Want me to start a grocery list for you?`, wait for yes, then open the list.
  - Product-review speech created/opened the Grocery List and added junk items `Of` and `It's`.
  - The active Grocery List panel was too small; G wants it much wider, nearly touching the avatar box sides, above the terms line, and up toward the top button.
- Local patch only, not deployed:
  - `src/components/LiveAvatarSession.tsx` now treats prompt-label review and grocery-list rehearsal speech as feedback, blocks `of`/`it's` filler list items, asks for confirmation before a fresh grocery/shopping/to-do list start, maps `Explore Plan This Weekend` back to `Plan This Weekend`, and enlarges the active list panel.
  - `app/api/prompt-brain/route.ts` now blocks the same prompt-label review phrases and maps `Explore Plan This Weekend` to `Plan This Weekend`.
  - `tools/update_liveavatar_context.py` now carries the same product-review/list-search rules, and the LiveAvatar context update succeeded with code `1000`.
- Verification passed: `git diff --check` on touched files, bundled Python `py_compile`, token-shaped secret scan, `npm.cmd run typecheck`, `npm.cmd run build`, and temporary localhost dev-server HTTP `200`.
- No Vercel preview, production/domain push, or smoke test was made because G approval is required before a new Vercel iteration.
- Next move: get G approval to deploy a new Vercel preview smoke test, then send Telegram smoke test with the new preview link.

## Reboot Rule Refresh - 2026-05-02

- G restated the AI assistant reboot rules for Codex and Claude.
- Codex lane remains aiASAP. Claude lane is iSolve unless G explicitly redirects.
- The prior numbering had 19 rules. The full Supabase transcript doctrine is rule 19; the current rule 20 is the shorthand map.
- Rule 19: until otherwise mentioned, Supabase keeps a transcript of every word from G, any user, and 6, so assistants can inspect it, learn how to improve the site, and brief G with important product information when appropriate.
- LiveAvatar operational IDs for Codex/aiASAP remain `3cbe98e4-50ff-4e48-8954-7685fcf09dac`, `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930`, and `a65a59af-39bd-4f57-8cc6-235449ca3348`.
- Telegram reboot line-alive text was sent successfully after this refresh; it stated that the text path works and G voice notes are accepted by the bot path.
- No code patch, Vercel preview, production push, or domain promotion was made for this rule refresh.

## Start Prompt Capitalization / Common Desktop Tune - 2026-05-02

- G dropped four screenshots from the preview and said the common third/fourth view is the target: the avatar box should be centered under the `aiASAP` name and above the terms line; nothing will be perfect in every edge window.
- Patch: `src/components/LiveAvatarSession.tsx` now keeps normal desktop views overflow-hidden so they do not show the always-on scrollbars from the previous minimum-canvas guard.
- Short-window fallback now only scrolls for true crunch viewports under 520px tall.
- Start prompt line now reads `TAP/CLICK ANYWHERE` in caps and larger text.
- Second line remains `TO TALK TO 6`.
- Start prompt lifted slightly higher for desktop.
- Verification: `git diff --check` passed, `npm.cmd run typecheck` passed, credential scan clean, local `npm.cmd run build` compiled but Dropbox locked `.next\export` cleanup twice, Vercel preview remote build passed, preview root returned HTML, and preview error logs showed no logs.
- Latest preview only, not production: `dpl_EeUTn38QSmkgJ9jJKeGmp11gybFr`, `https://ai-asap-4r6mhfi3n-team-dietz.vercel.app`.

## Start Prompt / Short-Window Guard - 2026-05-02

- G dropped screenshots showing the avatar at full height on a tall desktop view, then crushed into a tiny strip when the browser window was short on a 34-inch curved monitor.
- Patch is local only in `src/components/LiveAvatarSession.tsx`; no Vercel preview, LiveAvatar context push, or production/domain push.
- Start prompt copy changed to:
  - `Tap/Click Anywhere`
  - `TO TALK TO 6`
- Desktop start prompt lifted toward 6's stomach instead of sitting on his hands.
- Desktop avatar stage moved slightly down so the top of the avatar frame has more separation from the `aiASAP` logo.
- Added short desktop viewport fallback: the app keeps a minimum desktop canvas and scrolls instead of compressing the logo/avatar/prompt/footer into a tiny top strip.
- Verification passed: `git diff --check -- src/components/LiveAvatarSession.tsx`, `npm.cmd run typecheck`, and `npm.cmd run build` after one known Dropbox `.next\export` lock rerun.

## Local Lingo Note - 2026-05-02

- G wants this in 6's lingo occasionally: "If you've got a phone, you've got a friend."
- Added locally to `tools/update_liveavatar_context.py` and `PROJECT_MEMORY.md`.
- Not pushed to LiveAvatar context, Vercel preview, or production.

## ROE Refresh - 2026-05-01 Evening ET

- Lane remains `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- G restated the Codex/Claude reboot rules and added rules 17-19.
- Rule 17: before doing aiASAP work, confirm full transcript capture for every word from `6` and all users. Current aiASAP path is `conversation_messages` with user/assistant rows, `USER_TRANSCRIPTION` hard-log rows as `user_transcription_event`, and LiveAvatar transcript sync as backup.
- Rule 18: the aiASAP avatar name is only `6`, never `Six`, except when quoting an existing bug or transcript.
- Rule 19 correction from G on 2026-05-02: forget non-aiASAP build-specific details. Codex keeps only the operative boundary: stay in aiASAP unless G explicitly redirects.
- Transcript doctrine now lives under rule 19: until G says otherwise, Supabase must keep a transcript of every word from G, any user, and `6`, so assistants can inspect it, learn how to improve the site, and brief G with important product information when appropriate. Treat G's `supabass` wording as Supabase here. Current rule 20 is the shorthand map.
- Keep the domain reminder active: backorder `aiASAP.com` and other useful aiASAP domains when the domain lane is active.
- LiveAvatar context-window/SW changes should be made automatically through the connected route, local env, helpers, API, or dashboard when aiASAP behavior/context changes.
- Codex / aiASAP operational IDs remain `3cbe98e4-50ff-4e48-8954-7685fcf09dac`, `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930`, and `a65a59af-39bd-4f57-8cc6-235449ca3348`.
- No code patch, Vercel push, or production/domain promotion was made for this ROE refresh.

## Overwatch Five-Screenshot Correction - 2026-05-01 Late ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G said `get ready, and check out the transcript, you work while I am talking to 6. go!`, then clarified there were five screenshots.
- Supabase latest session checked: `1c43fe76-e255-410d-9383-c1d33adacb84`, 184 rows from about 9:51:14-9:55:26 PM ET.
- Counts: `assistant:24`, `user:160`; sources included `liveavatar_api:84`, `user_transcription_event:78`, `product_feedback:9`, `list_state:7`, and `assistant_app_repeat:6`.
- Dropbox screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 215059.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 215142.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 215326.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 215345.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 215456.png`
- Findings:
  - Very short desktop prompt pills were too large and awkward in the middle of the avatar stage.
  - `Date Night Ideas` should not be a default unless the user is actually talking about dating.
  - `Local Hikes` should become `Find Places to Hike`.
  - Blank Grocery/Walmart lists should start at the same full size as the two-item list, not short and low.
  - `Hey, 6, take off "I'm gonna"` was misread as item 6.
  - `take that list down, 6` did not reliably close the list.
  - Product-review phrases like `let's stop it here`, `just go ahead`, and `make those changes` were added as list items.
- Patch:
  - `src/components/LiveAvatarSession.tsx` default prompts now use `Plan This Weekend`, `Make a Grocery List`, `Find Places to Hike`, `Find Nearby Events`; date-night prompts only appear in dating/romance context.
  - Short desktop prompt pills now use a compact 2x2 layout in the tiny-height breakpoint.
  - Blank active-list panels now use the same full-size geometry as populated list panels, and `Blank list` uses the active list accent color.
  - Direct 6-addressed remove/close commands ignore `6` as a name and handle quoted item removal plus `take list down` correctly.
  - Product-review guards now block low/full-size/blank-list/color/change phrases from list item mutations.
  - `app/api/prompt-brain/route.ts` fallback prompts match the new defaults and the prompt-brain instruction says Date Night Ideas is dating-only.
  - `tools/update_liveavatar_context.py` was updated and LiveAvatar context update succeeded with code `1000`.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts tools/update_liveavatar_context.py` passed with CRLF warnings only.
  - Strict touched-file secret scan was clean.
  - First parallel typecheck hit the known `.next/types` build race; serial `npm.cmd run typecheck` passed.
  - Local `npm.cmd run build` passed.
  - Bundled Python `py_compile` passed for `tools/update_liveavatar_context.py`.
  - Vercel remote build passed.
  - Protected preview root returned HTTP `200`.
  - Preview `/api/prompt-brain` returned `Plan This Weekend | Make a Grocery List | Find Places to Hike | Find Nearby Events` for the date-label-review phrase.
  - Preview `/api/liveavatar/debug-token` showed FULL mode, primary voice `a65a59af-39bd-4f57-8cc6-235449ca3348`, and `used_fallback_voice=false`; session token was not printed.
  - Vercel preview error logs for the deployment returned no logs.
- Latest preview only, not production:
  - Deployment: `dpl_DMn5hKgpuh5ntgMRUtqJou4QSmnC`
  - URL: `https://ai-asap-jph3sfh6q-team-dietz.vercel.app?_vercel_share=vMLt0JazzR7euYSE9bQj3hfopN8VGF4A`
  - Telegram smoke test sent, message id `202`.
  - Smoke action line: `Default date prompt removed; blank lists full-size; remove/close list commands fixed. Test default pills, Grocery/Walmart blank list, and Hey 6 take off.`
- Next move:
  1. G should run the latest Telegram smoke link, then say `sup`.
  2. On `sup`, read the newest full `conversation_messages` session before patching.
  3. Verify default pills no longer show Date Night Ideas, short desktop pills are contained, blank Grocery/Walmart panels are full-size, `Hey, 6, take off "item"` removes by item not index 6, `take that list down, 6` closes, and review phrases do not become items.
  4. Do not promote to production/domain without G approval and a security review.
- Stand-down note: G ended the night because it was after bedtime. Tomorrow, resume from this section and use the latest preview above. Do not restart from old previews.

## Rule 20 Transcript Hardening - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Supabase pre-check found no newer G/user smoke session after `897eae84-a663-4b53-8fa4-84e007815455`, so this was a doctrine-driven transcript hardening pass.
- Patch:
  - `src/liveavatar/useAvatarActions.ts` now dispatches `aiasap:assistant-repeat` after successful app-triggered `repeat()` speech.
  - `src/components/LiveAvatarSession.tsx` listens for that event and queues an assistant `conversation_messages` row with source `assistant_app_repeat`.
  - This strengthens rule 20 by hard-logging app-triggered 6 speech immediately, while LiveAvatar transcript sync remains the backup official transcript lane.
- Verification passed:
  - `git diff --check -- src/liveavatar/useAvatarActions.ts src/components/LiveAvatarSession.tsx` passed with CRLF warnings only.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed locally.
  - Touched-file secret scan was clean.
  - Vercel preview build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - Preview `/api/conversation/log` smoke returned `200`.
  - Supabase confirmed smoke row `assistant_repeat_smoke_20260501_1719` with source `assistant_app_repeat`.
  - Vercel error logs showed no logs/errors after the preview smoke.
- Latest preview only, not production:
  - Deployment: `dpl_FXFUa9xv8XwTWvEVYPbfey9bgboe`
  - URL: `https://ai-asap-94w57htoa-team-dietz.vercel.app?_vercel_share=JAh569MTQEEFd46xEfLtSoU1hT18pqAV`
  - Telegram smoke test sent, message id `189`.
  - Smoke action line: `Rule 20 transcript hardening: 6 repeat speech logs to Supabase; test fresh start/list/weekend, then say sup.`
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session.
  2. Verify both user rows and assistant `assistant_app_repeat` / `liveavatar_api` rows landed.
  3. Compare product-feedback speech against the old list/search defects before patching again.

## Supabase Screenshot Correction 3 - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G asked for `sup, screenshots`, then asked to see the full transcript captured by the system.
- Supabase latest session `c971e5f8-e72d-43f8-9426-5c99da7b864b` had 62 rows from about 6:12:10-6:13:17 PM ET.
- Counts: `assistant:2`, `user:60`; sources included `user_transcription_event:28`, `liveavatar_api:27`, `product_feedback:6`, and `assistant_app_repeat:1`.
- Rule 20 hard logging worked: `assistant_app_repeat` and `liveavatar_api` both captured the 6 greeting. `product_feedback` captured screenshot phrases.
- No `list_state` rows were created, so the false-list guard held during this layout-only review.
- Full captured transcript was pasted back to G in chat. The transcript included duplicate capture lanes by design.
- Screenshot/readback lesson:
  - Short desktop start text was too low after the previous patch.
  - Desktop copy should say `Tap or Click Anywhere`; mobile can still say `Tap Anywhere`.
  - In the short 1535x726 desktop window, the prompt pills were too huge and narrow for the avatar frame.
  - In the tall/full-size 1535x1260 window, G said the name and pillboxes looked great, so the patch must preserve that view.
- Patch in `src/components/LiveAvatarSession.tsx`:
  - Raised the desktop start prompt from `calc(8vh+4.25rem)` to `calc(8vh+7rem)`.
  - Changed desktop start copy to `Tap or Click Anywhere`, while mobile remains `Tap Anywhere`.
  - Added `aiasap-thought-prompts` / `aiasap-thought-prompt` classes.
  - Added a short-desktop-only media query for `min-width: 768px` and `max-height: 840px` that lowers and constrains prompt pills to fit inside the short avatar frame.
  - Tall/full-size desktop keeps the larger prompt sizing G liked.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with CRLF warning only.
  - Touched-file token-shaped secret scan was clean.
  - First parallel typecheck/build hit the known `.next/types` race; serial rerun of `npm.cmd run typecheck` passed.
  - First build compiled but Dropbox/Windows locked `.next\export`; serial rerun of `npm.cmd run build` passed.
  - Vercel preview remote build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - Vercel error-log check after the smoke showed no logs.
- Latest preview only, not production:
  - Deployment: `dpl_4CHC7CM4bvqdHYkGQMmjvY87NMp3`
  - URL: `https://ai-asap-cxost9rg0-team-dietz.vercel.app?_vercel_share=UL8eTN1BUBNv7yPuuP48AWl0tE2MVZho`
  - Telegram smoke test sent, message id `192`.
  - Smoke action line: `Short desktop layout patch: start text raised, desktop says tap/click, short-window pills contained; test 3 screenshots then say sup.`
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session.
  2. Compare screenshots against the three specific views: start screen short desktop, prompt pills short desktop, and tall/full-size prompt stack.
  3. Keep this preview in preview lane only until G approves production/domain and a security review is complete.

## Supabase Screenshot Correction 4 - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G reviewed the transcript and said it looked good enough to learn from, then told Codex to keep working.
- Supabase latest session for this pass was `8f27b7dd-00a4-482c-b1e6-c44eac979792`, 82 rows from about 6:24:47-6:26:30 PM ET.
- Counts: `assistant:5`, `user:77`; sources included `liveavatar_api:37`, `user_transcription_event:34`, `product_feedback:8`, `preference_candidate:2`, and `assistant_app_repeat:1`.
- Screenshot lesson:
  - Short desktop start screen looked good overall.
  - aiASAP logo/name could be a little bigger.
  - First short-window avatar box could be a little shorter.
  - Prompt labels were correct: `Plan This Weekend`, `Date Night Ideas`, `Local Hikes`, `Find Nearby Events`.
  - Tall/full-size view looked very good and should be preserved.
- Transcript lesson:
  - Transcript capture was usable.
  - 6 still answered product-review/test speech through the LiveAvatar general chat path (`I hear you`, `Nice work`, and a weekend-list prompt). That should stay quiet during screenshot/transcript review.
- Patch in `src/components/LiveAvatarSession.tsx`:
  - Broadened feedback/test guards for `talked to me`, transcript review, smoke test, count-to-10, click-out, stand-down, and ruined-it language.
  - Product-review/test speech still logs to `conversation_messages`, but no longer logs as a user preference or routes into the general 6 response queue.
  - Slightly increased the aiASAP logo clamp from `2.05rem/4vh/3.25rem` to `2.18rem/4.25vh/3.55rem`.
  - Added `aiasap-avatar-video` and short-desktop-only `height: 86vh` so only short desktop windows get a slightly shorter avatar frame.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with CRLF warning only.
  - Touched-file token-shaped secret scan was clean.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel preview remote build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - Vercel error-log check after smoke showed no logs.
- Latest preview only, not production:
  - Deployment: `dpl_GA5ES3NXL6RYyFmKrqkU5ZMk1Am5`
  - URL: `https://ai-asap-j7w6hwdz7-team-dietz.vercel.app?_vercel_share=LYBMOsPvmfa1NviW1ta2w5oCbRw771c0`
  - Telegram smoke test sent, message id `193`.
  - Smoke action line: `Transcript guard + polish: 6 should stay quiet during screenshot/transcript review; name slightly bigger, short box shorter. Test review talk, then say sup.`
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session and paste the transcript first if asked.
  2. Verify review/test speech logs but does not trigger general 6 replies or `preference_candidate` rows.
  3. Compare screenshots for bigger logo, shorter short-window avatar frame, and preserved tall/full-size layout.
  4. Keep this preview in preview lane only until G approves production/domain and a security review is complete.

## Supabase Screenshot Correction 5 - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G asked for `Superbase and screenshots`.
- Supabase latest session `03f89ce4-4904-4835-a9ad-2afd1872ee1d` had 102 rows from about 6:39:32-6:42:05 PM ET.
- Counts: `assistant:6`, `user:96`; sources included `liveavatar_api:49`, `user_transcription_event:46`, `product_feedback:6`, and `assistant_app_repeat:1`.
- Transcript lesson:
  - Full transcript capture is working and usable.
  - No `list_state` or `preference_candidate` rows appeared, so the list/preference pollution guard held.
  - LiveAvatar still answered product-review talk through its own FULL voice path at rows 22, 47, 57, and 102, so app-side queue blocking alone was not enough.
- Screenshot lesson:
  - `Screenshot 2026-05-01 183924.png`: start text is a little low and should move up slightly.
  - `Screenshot 2026-05-01 184018.png`: tall/full-size prompt view looks good and should be preserved.
  - `Screenshot 2026-05-01 184058.png`: bad prompt labels appeared: `Adjust Box Spacing`, `Compare Font Sizes`, `Review Layout Options`, `Optimize Text Alignment`.
  - G wants `Plan This Weekend`, `Date Night Ideas`, `Local Hikes`, and `Find Nearby Events` to appear as soon as weekend plans are mentioned.
- Patch:
  - `src/components/LiveAvatarSession.tsx` now interrupts avatar speech while the product-review quiet window is active, not just queued app replies.
  - Client prompt fallback blocks the four bad layout-review labels and forces the concrete weekend/default prompts immediately for weekend/product-review terms.
  - Desktop start text raised slightly from `calc(8vh+7rem)` to `calc(8vh+7.55rem)`.
  - Desktop avatar stage is nudged down slightly, `0.48rem` in short desktop windows and `0.35rem` in taller desktop windows.
  - `app/api/prompt-brain/route.ts` blocks the four bad layout-review labels server-side and returns safe default prompts for weekend/review context.
  - `tools/update_liveavatar_context.py` added a product-review no-talk rule, and the LiveAvatar context window update succeeded with code `1000`.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts tools/update_liveavatar_context.py` passed with CRLF warnings only.
  - Touched-file token-shaped secret scan was clean; matches were env variable names only.
  - `npm.cmd run typecheck` passed.
  - Local `npm.cmd run build` passed.
  - `tools/update_liveavatar_context.py` passed `py_compile`.
  - Vercel preview remote build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - Preview `/api/prompt-brain` returned `Plan This Weekend | Date Night Ideas | Local Hikes | Find Nearby Events` and zero bad layout prompts.
  - Preview `/api/liveavatar/debug-token` confirmed FULL mode with `voice_id,context_id` and fallback false; session token was not printed.
  - Vercel error-log check after smoke showed no logs.
- Latest preview only, not production:
  - Deployment: `dpl_9uSd9LQCxUBrDv7Yxdd4AfKw8yCo`
  - URL: `https://ai-asap-3fh0znord-team-dietz.vercel.app?_vercel_share=qGwmEbVU3BQAAo976wU5BWBG4KZcY3C2`
  - Telegram smoke test sent, message id `194`.
  - Smoke action line: `Review quiet + layout: 6 should stay quiet during screenshot talk; weekend pills snap in; test 3 screenshots then say sup.`
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session.
  2. Verify screenshot/review speech logs but does not produce LiveAvatar assistant replies, `preference_candidate`, or `list_state` rows.
  3. Compare screenshots against start-text lift, desktop box spacing, preserved tall prompt view, and immediate weekend prompt labels.
  4. Keep this preview in preview lane only until G approves production/domain and a security review is complete.

## Supabase Screenshot Correction 2 - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G asked for `sup plus screenshots`.
- Supabase latest session `d5239a4b-751f-47b4-8ece-15da71d9d12f` had 178 rows from about 5:52:57-5:56:23 PM ET.
- Counts: `assistant:10`, `user:168`; sources included `liveavatar_api:81`, `user_transcription_event:77`, `product_feedback:16`, `assistant_app_repeat:3`, and `list_state:1`.
- Rule 20 hard logging still worked: `assistant_app_repeat` captured the greeting, `I started the Grocery List...`, and `I closed that box.`
- The previous false-list fix worked: no false `Now To Do List` was created from layout/product speech. The only `list_state` row was the legitimate Grocery List after G said `Um, start a grocery list.`
- New screenshot/transcript defects:
  - Start overlay text `TAP ANYWHERE / To Talk to 6` sat too high over the avatar.
  - Prompt labels could still become generic coaching labels like `Complete Your Thought`, `Clarify your thought`, `Improve conversation flow`, `Practice speaking clearly`, and `Explain your idea`.
  - G wanted concrete labels such as `Plan This Weekend`, `Date Night Ideas`, `Local Hikes`, and `Find Nearby Events`.
  - Blank Grocery List panel was too big and cramped the screen.
  - The four active-list bottom pills looked awkward under a blank list and should not show while the sticky note/list is open.
  - The `aiASAP` logo was too close to or inside the top avatar box in the tall/wide view.
- Patch:
  - `src/components/LiveAvatarSession.tsx` changed default prompt labels to concrete local-life prompts and blocked the bad coaching labels.
  - Start overlay moved lower; top logo overlay moved upward/clearer.
  - Blank active-list panel now uses a smaller compact height and centered `Blank list` text.
  - Bottom prompt/action pills are hidden while any sticky note/list is open.
  - Date-night/local-event lookup intents are recognized so prompt taps can route to useful search behavior.
  - `app/api/prompt-brain/route.ts` now falls back to concrete prompts for prompt/layout feedback context and blocks the bad coaching labels server-side.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts` passed with CRLF warnings only.
  - Touched-file token-shaped secret scan was clean.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed locally.
  - Vercel preview remote build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - `/api/prompt-brain` preview smoke returned safe concrete prompts.
  - A fresh Vercel error-log check after the corrected route smoke returned no logs; the earlier prompt-brain error was from the first manual route smoke window.
- Latest preview only, not production:
  - Deployment: `dpl_HYtgK4SuHg5tYWMDcYwTYEE2pLJm`
  - URL: `https://ai-asap-24oqqzr2w-team-dietz.vercel.app?_vercel_share=GdbMB5pqcTF2KJOJZbCPXsJDGhmdASDP`
  - Telegram smoke test sent, message id `191`.
  - Smoke action line: `Sup/screens patch: start text lower, bad prompt labels blocked, blank list compact/no bottom pills; test start, prompts, grocery blank list, then say sup.`
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session.
  2. Verify no false list from layout/product speech, no generic prompt labels, compact blank list, no bottom pills while the list is open, and rule 20 transcript rows still land.
  3. Keep this preview in preview lane only until G approves production/domain and a security review is complete.

## Supabase Screenshot Correction - 2026-05-01 Evening ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G asked for `sup and screenshots`.
- Supabase latest session `1bc7c2a6-5291-48ae-83dd-319aab654698` had 129 rows from about 5:25:01-5:27:38 PM ET.
- Counts: `user:122`, `assistant:7`; sources included `liveavatar_api:54`, `user_transcription_event:54`, `product_feedback:14`, `assistant_app_repeat:3`, `list_state:2`, `preference_candidate:2`.
- Rule 20 hard logging worked: `assistant_app_repeat` captured the greeting, `I started the Now To Do List...`, and `I closed that box.`
- Bug found: layout/product speech such as `what do I want to do now`, `going to open it up`, and `lengthening` still created a false `Now To Do List`.
- Screenshot/readback lesson: desktop/tall avatar frame needed to be bigger; prompt pills needed to sit lower and read larger; G liked the taller view but wanted `6`'s box and pillboxes bigger.
- Patch in `src/components/LiveAvatarSession.tsx`:
  - Blocks `what do I want to do`, `want to do now`, `going to open it up`, `lengthening`, and `pulling it all the way down` from list intent.
  - Blocks `now`, `right`, and `actually` as To Do scope names so `to do now` cannot become `Now To Do List`.
  - Raises desktop avatar frame from `82vh`/`62rem` to `88vh`/`74rem`.
  - Moves the default desktop prompt stack lower and increases desktop/XL prompt pill size and text.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx` passed with CRLF warning only.
  - Touched-file token-shaped secret scan was clean.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed locally.
  - Vercel preview remote build passed.
  - Protected preview share link verified with cookie-aware HTTP `200`.
  - Vercel error logs showed no fresh errors.
- Latest preview only, not production:
  - Deployment: `dpl_9dT2p3bgDMHRi3wDiqMWJH7NnYCn`
  - URL: `https://ai-asap-5zq4mg9si-team-dietz.vercel.app?_vercel_share=nVbSVL2nBKXbszT63Eb8TIflA4yANPOD`
  - Telegram smoke test sent, message id `190`.
  - Smoke action line: `Transcript/layout fix: layout talk should not create Now To Do List; prompt pills lower/bigger. Test fresh start, talk about the box/lengthening, then say sup.`
- Note: several intermediate preview deployments were created while routing around Vercel share-link response parsing; use only the latest URL above.
- Next move:
  1. After G tests and says `sup`, read the newest full `conversation_messages` session.
  2. Verify no false `Now To Do List` from layout/product speech.
  3. Verify user and assistant transcript rows still land, including `assistant_app_repeat`.

## Pause / Dinner Handoff - 2026-05-01 3:08 PM ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- G needed to step away for errands/dinner and asked how to avoid full restart after Codex restarts.
- Best continuation rule: on restart, read `PROJECT_MEMORY.md` and this file first, then resume from this exact section. Do not reconstruct from old previews.
- Latest user request before pause: `check sup and screen shots`.
- Supabase evidence:
  - Latest full transcript source is `conversation_messages`.
  - Latest session checked: `897eae84-a663-4b53-8fa4-84e007815455`, 114 rows from 2:48:34-2:51:16 PM ET.
  - Counts: `assistant:18`, `user:96`.
  - Sources: `list_state:7`, `liveavatar_api:50`, `preference_candidate:1`, `product_feedback:10`, `user_transcription_event:46`.
  - Conclusion: hard transcript lane works. The remaining problem is interpretation: product-feedback speech was still being treated as user intent.
  - Bug found: one separate session logged `[USER HAS BEEN SILENT FOR 10 SECONDS]` as `user_transcription_event`; patch now skips internal signals before queueing hard transcript rows.
- Dropbox screenshots reviewed:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260501-144924.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260501-131645.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260501-131636.png`
  - Visual takeaways: brand colors looked good, To Do List rows were too high under the title, and the app still put feedback fragments into the list.
- Latest patch:
  - `src/components/LiveAvatarSession.tsx`
    - Stops logging internal silence/system markers as user transcript events.
    - Blocks UI transcript feedback phrases such as `came up after`, `box came up`, `went away`, `plan weekend plans`, and `we just planned this weekend` from list/search intent.
    - `Plan This Weekend` now asks for confirmation first instead of immediately opening the lookup box.
    - Weekend lookups ask preference/location flow before showing results.
    - Active mobile list with 4 or fewer items stays anchored at the top; list scroll area gets a little top/bottom padding.
    - Prompt text normalizes `Plan Weekend Plans` / `Weekend Plans` to `Plan This Weekend`.
  - `app/api/prompt-brain/route.ts`
    - Blocks `plan weekend plans`, `went away`, and `box came up` feedback from prompt pills and falls back to safe defaults for those contexts.
  - `app/api/online-search/route.ts`
    - Adds current Eastern date to online search requests.
    - Filters alcohol-first broad weekend results like beer/bourbon/wine/bar-crawl unless explicitly requested.
- Verification passed before pause:
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts app/api/online-search/route.ts` passed with CRLF warnings only.
  - Strict literal secret scan on touched files found no actual secrets, only local storage key names.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed locally.
  - Vercel preview remote build passed.
  - Protected preview share link verified with HTTP `200`.
- Latest preview only, not production:
  - Deployment: `dpl_949g5B9rPhWVzGWR1o19Yq4Av4Uv`
  - Preview URL: `https://ai-asap-hvhbs3nt9-team-dietz.vercel.app?_vercel_share=OrMEU7wD41YL9X4PwYdH5qZMIggtRKDF`
  - Telegram smoke test sent, message id `186`.
  - Smoke action line: Plan This Weekend should ask before opening search; say yes, give ZIP, answer preferences; To Do List feedback should not create junk items.
- Next move when G returns:
  1. If G has tested the Telegram smoke link, check Supabase latest `conversation_messages` and compare against the defects above.
  2. If not tested yet, ask G to use the Telegram smoke link. Do not patch blindly.
  3. Do not promote to production/domain without G approval and a security review.

## Spacing-Only Chunk - 2026-05-01 Afternoon ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Latest spacing-only preview deployment: `dpl_GmfN7k6eYVZwsbN5J1uGx2k9TkBE`.
- Latest smoke URL: `https://ai-asap-apymrcb4p-team-dietz.vercel.app?_vercel_share=0kCm3DrwHPv76uAwyN1mnedfQvu623LR`.
- G asked to chunk the work into little pieces, get spacing right, check screenshots, and not check Supabase.
- Screenshots reviewed: `Screenshot 2026-05-01 144245.png` and `Screenshot 2026-05-01 144305.png`.
- Fix in `src/components/LiveAvatarSession.tsx`: desktop avatar frame height raised from `77vh` to `82vh`; default prompt stack moved lower from `md:bottom calc(11.5vh + 9rem)` to `calc(11.5vh + 4.75rem)`; mobile prompt lift lowered from `6.15rem` to `5.15rem`.
- Checks passed: `git diff --check` (CRLF warning only), strict literal secret scan, `npm.cmd run typecheck`, Vercel remote preview build, protected preview link `200`, Telegram smoke sent, and Vercel logs clean. Supabase intentionally not checked for this spacing-only chunk.

## Transcript Hard-Log Fix - 2026-05-01 Afternoon ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Latest transcript hard-log preview deployment: `dpl_EEUneMyhHZavk6pC2yZSAtnRVmYp`.
- Latest smoke URL: `https://ai-asap-hylxdn2ls-team-dietz.vercel.app?_vercel_share=Hfi6PMTZ9uomYgCsRmcUmHLIJZTXLgTT`.
- Reason: G said it is very important every single thing he says gets into the transcript so Codex can inspect it.
- Fix in `src/components/LiveAvatarSession.tsx`: every non-empty `USER_TRANSCRIPTION` event is now immediately queued and batch-written to `/api/conversation/log` with source `user_transcription_event`, using the LiveAvatar session id when available and a client fallback id if needed. The existing 20-second LiveAvatar official transcript sync remains as backup.
- Fix in `app/api/conversation/log/route.ts`: route now accepts either one entry or an `entries` batch, validates each entry, and inserts all rows into `conversation_messages`.
- Verification passed: `git diff --check` (CRLF warnings only), strict literal secret scan, `npm.cmd run typecheck`, Vercel remote preview build, protected preview share link `200`, `/api/conversation/log` batch smoke returned `{"ok":true,"stored":2}`, Supabase confirmed both smoke rows landed with source `user_transcription_event`, and Vercel logs showed no fresh errors.
- Local `npm.cmd run build` compiled twice but hit the known Windows/Dropbox `.next\export` cleanup lock; Vercel remote build passed.
- Next validation: G should speak a short unique phrase in the preview, then say `sup`; inspect latest `conversation_messages` for `user_transcription_event` rows in addition to `liveavatar_api` rows.

## 34-Inch + Mobile Screenshot Correction - 2026-05-01 Afternoon ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Latest verified preview deployment: `dpl_CgsuWqTtGxg5gttPBjCAuwEQxEKu`.
- Latest smoke URL: `https://ai-asap-hv5qozgq8-team-dietz.vercel.app?_vercel_share=CbwEDeo7EBhDIDzhn8ztgsFs8SXlkM2o`.
- Dropbox screenshots reviewed from `C:\Users\sgdie\Dropbox\Codex\Screenshots`: the 34-inch wide/short browser made the `aiASAP` logo balloon, prompt/result row borders still read white/gray, and the latest To Do List captured filler fragments.
- Supabase latest full transcript remains `conversation_messages` session `ac7a29e7-dc72-4255-8512-10a6d4e74e64`, 67 rows from 1:50:44-1:54:04 PM ET (`assistant:18`, `user:49`). `list_state` rows show the bad item chain: `Why can't he`, `Why`, `So Six told me he couldn't`, `There`, `All right`, `Before moving forward`.
- Fixes in `src/components/LiveAvatarSession.tsx`: logo size now uses a viewport-height clamp for short wide windows, avatar frame/result rows/prompt pills force brand amber/dark styling, museum lookup intent is recognized, repeated lookup result names are trimmed, and the bad filler fragments are blocked from list items and thought prompts.
- Fixes in `app/api/prompt-brain/route.ts`: feedback/filler context such as `why can't he`, `six told me`, `there`, `all right`, and `before moving forward` returns safe default pills instead of model-generated coaching labels.
- Fixes in `app/api/online-search/route.ts`: repeated-name result lines like `Name: Explore the Name...` collapse to the useful name.
- Checks passed: `git diff --check` (CRLF warnings only), strict literal secret scan, `npm.cmd run build`, `npm.cmd run typecheck`, Vercel remote preview build, protected preview home `200`, `/api/prompt-brain` fallback smoke, `/api/online-search` museum weekend smoke with 4 museum results, `/api/liveavatar/debug-token` redacted smoke with FULL voice/context and `used_fallback_voice=false`, and Supabase tail check.
- Local build still may need `.next\export` cleared if Windows/Dropbox locks cleanup; the rerun passed after clearing only that build artifact.
- Next move: wait for G feedback on this smoke test. When G says `sup` or reports behavior, read the newest full `conversation_messages` session and compare against the old bad list chain above.

## Mobile Screenshot Fix Checkpoint - 2026-05-01 Afternoon ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Latest verified preview deployment: `dpl_2SGmhuAYRBoAVAW38i7HAYttMsq9`.
- Latest smoke URL: `https://ai-asap-c2do8wv1i-team-dietz.vercel.app?_vercel_share=Q13QnngwY01L2EFcf9oBHfSJ5Ky0Sbyi`.
- Telegram smoke test sent with action line: ask for things to do this weekend, give `21093`, confirm 4 usable options; open To Do List and confirm tall box plus 4 pills; say `Stop` and confirm session closes.
- Dropbox screenshots reviewed: `Screenshot_20260501-123647.png`, `123734.png`, `123831.png`, `123855.png`, `123907.png`.
- Supabase latest mobile transcript checked. Canonical full transcript is `conversation_messages`; latest session `252055e2-cfb5-447e-8c42-ef67efac667a` had 80 rows from 12:36:45-12:39:59 ET with both roles (`user:62`, `assistant:18`). `transcript_events` is user-only and should not be treated as the full transcript view.
- Fixes in `src/components/LiveAvatarSession.tsx`: bigger full-size brand-color online lookup box, brand-color X ring, fresh-user reset on reload/start, bare `Stop` as a direct session shutdown, taller fixed active To Do/List panel, four action pills moved lower, and stronger product-feedback/filler guards so `Everything`, `Ford`, `Now`, `4 boxes`, and screenshot/layout talk cannot become list items.
- Fixes in `app/api/online-search/route.ts`: broad weekend searches return 4 options, filter `Market of Crafts Galore` / gem-jewelry / craft-style junk, strip metadata-only date/address lines, and backfill safe Timonium-area options when search results are too thin.
- Fixes in `app/api/prompt-brain/route.ts`: bad generic/product-review pills are blocked.
- Checks passed: `git diff --check`, `npm.cmd run typecheck`, strict literal secret scan, Vercel remote preview build, preview home `200`, `/api/online-search` `200` with 4 lines and no bad craft/gem entries, `/api/prompt-brain` `200` with bad words absent, and `/api/liveavatar/debug-token` `200` with `voice_id` + `context_id` and `used_fallback_voice=false`.
- Local `npm.cmd run build` compiled but hit a Dropbox/Windows lock on `.next\export` cleanup after the final backend-only patch. Vercel remote build passed and is the deploy gate for this preview.
- Next move: wait for G mobile feedback from the Telegram smoke test. If he says `sup`, `check sup`, or reports behavior, read every word of the latest `conversation_messages` session before patching.

## MVP Preview Checkpoint - 2026-05-01 Late Morning ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Production/domain was not pushed.
- Current verified preview deployment: `dpl_8jyzUVbJXCF1K1x6zJ8La7wRRaxo`.
- Verified preview smoke URL: `https://ai-asap-igz0t9102-team-dietz.vercel.app?_vercel_share=ITgGW906gmropJAG4QdDCmKRmSJhFbvT`.
- Telegram smoke test sent with action line: test fresh start, close box, more/4th, waterfalls/hikes, links, Terms, and pills.
- Checks passed before deploy: `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check`, stale-route scan, and source secret-pattern scan.
- Vercel remote preview build passed. Route table still shows `/` first-load JS at `108 kB`.
- Fixed `.vercelignore` so public PNG assets are not excluded; root smoke screenshots and Edge temp profiles are ignored instead.
- Added `app_events` fallback to `conversation_messages` when live Supabase event tables are not installed yet.
- Synced Vercel envs from local `.env`; Preview now has `OPENAI_API_KEY`, LiveAvatar IDs/keys, and Supabase service envs. Redeployed after env sync.
- Verified protected share flow: `_vercel_share` link sets bypass cookie, then preview returns `200`.
- Verified preview `/api/online-search` with share cookie and `waterfalls` near `21093`; it returned 5 results.
- Security action: local env readiness checks exposed service secrets in tool output during this thread. Do not repeat any values. Rotate through Shelly/BotFather/provider dashboards when G is ready: Telegram bot token, OpenAI API key, LiveAvatar API key, and Supabase service-role key. After rotation, update local `.env` and Vercel envs, then redeploy preview.

## Emergency Computer Reboot Handoff - 2026-04-30 Late ET / 2026-05-01 UTC

G is rebooting the computer because the workspace slowed down badly. This is likely system/file-lock pressure, not mission confusion.

### Reboot Rules Update - 2026-05-01

- G restated the 16-rule Codex/Claude reboot ROE. `STICKY_REBOOT_RULES.txt` and `PROJECT_MEMORY.md` now carry the current version.
- Security action: local env readiness checks exposed service secrets in tool output during this thread. Do not repeat any values. Rotate through Shelly/BotFather/provider dashboards when G is ready, then update local `.env` and Vercel envs.
- Supabase transcript history is the source of truth for G/operator beta feedback. Read every word in the latest full transcript sequence when G says `sup`, `check sup`, `check soup`, or gives real test feedback that needs diagnosis.
- Telegram remains the default alert lane; after reboot, reconnect and send a live-line text that confirms the bot can accept and understand G voice notes.
- Use real military lingo all the time; this organization is built for speed and efficiency.
- Codex / aiASAP LiveAvatar operational IDs from G: `3cbe98e4-50ff-4e48-8954-7685fcf09dac`, `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930`, `a65a59af-39bd-4f57-8cc6-235449ca3348`.
- Non-aiASAP LiveAvatar IDs/build details are removed from operative Codex context. Codex uses only aiASAP IDs unless G explicitly provides new values for an approved task.

### Post-Reboot Continuation - 2026-05-01 Morning ET

- Read `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` and this handoff.
- Verified the local Supabase-driven lookup-box patches in `src/components/LiveAvatarSession.tsx`: close intent, commentary detection, more/fourth reuse, five result rows, narrower/lower panel, Terms lift, and lookup state in feedback payload.
- Checks passed: `npm.cmd run typecheck`, stale Grok/media/custom/Google-integration grep, token-shaped secret scan except safe `.env.example` placeholder, `git diff --check` with only normal CRLF warnings, and `npm.cmd run build`.
- Preview-only deploy completed. Production/domain was not pushed.
- Deployment id: `dpl_7gfdxL7K6MEMq82uoSU6bkssKE9m`.
- Raw preview URL: `https://ai-asap-9v2sixesf-team-dietz.vercel.app`.
- Vercel preview protection returned `401` on raw links, same as the previous preview. A temporary share link was created with the Vercel API and verified by `curl -I` redirect/cookie.
- Share smoke link sent to Telegram: `https://ai-asap-9v2sixesf-team-dietz.vercel.app?_vercel_share=frfbV4xcb69PrDkrJKLuHm9fn6CCAXN1`.
- Telegram smoke test line sent: `HQ line alive for text/voice notes; test close box, 4th/more, hiking/waterfalls, links, Terms, pills.`
- Backend checks follow the current 2026-05-01 ROE: after every smoke test when appropriate, check Supabase or the relevant backend, report what the data shows, and carry the learning forward. For user-behavior smoke tests, wait for G feedback or `sup/check sup/check soup`, then read every word in the latest full transcript sequence.

### Lane and ROE

- Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP` only.
- Do not touch non-aiASAP lane.
- Read `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` first after reboot. It is the controlling MVP doctrine.
- Production/domain `https://aiasap.ai` was not pushed in this pass.
- Vercel previews are allowed without approval; production/domain promotion still requires explicit G approval.
- Use military lingo.
- Telegram remains smoke-test lane.
- Supabase checks happen after smoke tests when appropriate. For transcript/user-behavior diagnosis, when G says `sup`, `check sup`, or `check soup`, inspect the full latest transcript sequence, not only structured event rows.

### Important new doctrine from G

- Supabase transcript history is the source of truth for G/operator beta feedback.
- During G/operator beta sessions, nearly everything G says to 6 should be treated as training/product feedback for Codex unless it is clearly a normal user task.
- Every Supabase check should read every word in the full transcript sequence and learn everything actionable: layout feedback, box behavior, links, sticky note behavior, voice weirdness, and praise.
- Structured feedback rows are only flags. The full transcript is source of truth.
- This doctrine has been written into `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`.

### Latest deployed preview before reboot

- Preview smoke link already sent to Telegram: `https://ai-asap-fawpbr5w4-team-dietz.vercel.app`
- Deployment id: `dpl_2Cpo3h6DdUTgPtRezGdrP9iuQvwy`
- This preview did not include the very latest post-Supabase patches listed below.
- Production/domain was not touched.

### Latest Supabase intel from G mobile test

- Latest key session: `fdd08cf4-5b2f-4d2c-9cca-f30ee2dc77c0`
- Mobile viewport captured in fallback product feedback rows: `392x711`.
- New event tables `feedback_events`, `preference_candidates`, and `app_events` are not live in Supabase yet; reads returned 404.
- `/api/app-events/log` fallback worked: product feedback and preference candidates were written into `conversation_messages` with sources `product_feedback` and `preference_candidate`.
- G liked the exact intro/startup: intro line was correct and captured.
- G said the changes looked great overall, but the lookup/sticky-note box behavior needs next strike.

### What the transcript taught us

- 6 treated G's design commentary as new user lookup intent.
- The visible lookup box changed unexpectedly from weekend plan to other event/park results.
- G did not want random broad weekend ideas without 6 asking what kind of weekend activity he wanted.
- `Plan the weekend` should likely ask preference first instead of immediately populating random results.
- When G asked for hiking/waterfalls, the app should preserve context and not erase earlier box rows in a confusing way.
- G asked for a fourth item in the box. That should add/extend the current lookup result box, not prompt a generic LiveAvatar response.
- G said old rows disappeared and new rows appeared without logical sense. Preserve old visible rows while adding/loading more unless the user explicitly switches topics.
- G said none of the visible rows looked like links. Linked rows need clearer link affordance and should only be linked when URL is reliable.
- G said the box should start low, grow upward, and scroll inside with finger when longer.
- G liked one big box containing small result rows.
- G wanted roughly four/five rows in the box, not only three.
- G said box was too wide / going off-screen; bring sides in slightly.
- G said Terms line was almost dead bottom; move Terms up a smidge.
- G said box can come down a little after Terms moves up.
- G said no white outside line and no white circle around the X. Brand amber/dark styling only.
- G said `take that off` / `go off the screen` should close the visible box reliably.
- G said pillboxes should come back when box is closed.
- G said `Steve-O performing at McGoober's Joke House` sounded awesome; capture this as useful praise/preference for result quality.
- G said broad suggestions like Market Crafts Galore missed the mark. Ask preference for broad weekend searches.

### Patches made after reading Supabase, not yet verified/deployed

File: `src/components/LiveAvatarSession.tsx`

- Expanded lookup close intent so `take that off`, `off the screen`, and similar close the visible lookup box.
- Added lookup commentary detection so phrases like `none of these are links`, `now it just changed`, `things are changing`, and `inside the box` are feedback, not new lookup commands.
- Added `ONLINE_LOOKUP_MORE_RE` so `give me a 4th thing`, `more`, `another option`, etc. can use the last lookup query/location.
- Added refs for `onlineLookupLastQueryRef` and `onlineLookupLastLocationRef`.
- `performOnlineLookup` now stores last query/location and keeps old rows visible while showing `Adding more ...` instead of clearing the box first.
- Lookup rows now slice to 5 instead of 3.
- Lookup box width changed to `w-[min(88%,30rem)]`, lower position `bottom + 3.35rem`, and max height `38vh`.
- Terms link moved up slightly from bottom `0.55rem` to `1.05rem`.
- Structured screen-state feedback now includes `lookupPanel` with visible state, notice, result lines, source count, and sources.
- X button close logs `closed lookup box with X`.
- Reset path clears last lookup query/location.

File: `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`

- Added G/operator training-data doctrine: every `sup/check sup/check soup` means read full transcript and learn all actionable product lessons.

### Verification state at reboot

- Before the latest post-Supabase patches, Vercel remote build passed.
- Before the latest post-Supabase patches, stale Grok/media/custom/Google integration grep was clean and Telegram smoke test was sent.
- After the latest post-Supabase patches, verification did not complete because local `tsc`, `git diff`, and grep began timing out under workstation/file-lock pressure.
- Do not assume the latest post-Supabase patches are deployed. They are local only until verified and preview-deployed after reboot.

### First actions after reboot

1. `cd C:\Users\sgdie\Dropbox\Codex\aiASAP`
2. Read `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`.
3. Run `git status --short`.
4. Run `tsc --noEmit` with bundled Node.
5. Run stale-code grep for Grok/media/custom/Google-integration terms.
6. Run `git diff --check`.
7. Run `next build` or Vercel preview build if local `.next` is still Dropbox-locked.
8. Deploy a new Vercel preview only.
9. Send Telegram smoke test with the new preview link.
10. Ask G to test: close visible box by voice, fourth/more result, waterfall/hiking lookup, box width/Terms placement, link affordance, and pillboxes returning after close.

### Paste-back phrase for G

```text
Read C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md and AIASAP_REBOOT_HANDOFF.md. Continue from the Emergency Computer Reboot Handoff - 2026-04-30 Late ET / 2026-05-01 UTC. Stay in aiASAP only. Production/domain was not pushed. Latest deployed preview was https://ai-asap-fawpbr5w4-team-dietz.vercel.app but the newest Supabase-driven lookup-box patches are local only and need verification + a new Vercel preview. First verify the local patches, then deploy preview only and send Telegram smoke test.
```

## MVP Mission Build - 2026-04-30 Late ET

- Lane: `C:\Users\sgdie\Dropbox\Codex\aiASAP` only. non-aiASAP lane untouched.
- Live production/domain `https://aiasap.ai` was not promoted or changed.
- Mission guide updated at `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`.
- Vercel preview smoke link: `https://ai-asap-fawpbr5w4-team-dietz.vercel.app`.
- Preview deployment id: `dpl_2Cpo3h6DdUTgPtRezGdrP9iuQvwy`.
- Telegram smoke test sent with action line for fresh start, sticky notes/swipe, list remove/undo/rename, waterfalls near `21093`, weekend weather spoken, and voice feedback phrase `this is broken`.
- Local `tsc --noEmit` passed.
- Vercel remote build passed.
- Local `next build` compiled and generated pages, but final cleanup hit the known Dropbox `.next\export` `EBUSY` lock; Vercel build is the clean build authority for this pass.
- Security checks: stale Grok/media/custom/Google-integration grep clean, `git diff --check` clean except normal CRLF warnings, token-shaped secret scan clean.
- Removed from MVP: Grok/image/video/media capture, app-side CUSTOM/ElevenLabs TTS/OpenAI chat fallback, public LiveAvatar debug/smoke pages, bug report API, Google Calendar/Gmail integration stack.
- Kept: LiveAvatar FULL, online search, Supabase, transcript/list/event capture, Social CENTCOM dormant.
- Added `/api/app-events/log` plus local schema for `app_events`, `feedback_events`, and `preference_candidates`.
- Feedback/preference logging falls back to `conversation_messages` if live Supabase does not have the new event tables yet.
- Sticky notes now persist locally, support 10-note cap, item X removal, note X hide, voice rename/clear/undo, horizontal swipe between notes, and no delete-list command.
- Exact intro line in app and mission guide: `Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?`
- Next: G tests preview. After the smoke test, check Supabase or the relevant backend when appropriate; for G/operator behavior feedback, inspect the full transcript/events after G reports what happened or says `sup/check sup/check soup`.

## Reboot Rules Update - 2026-04-30

G pasted the current 15-rule reboot contract and asked Codex/Claude to follow it going forward.

- Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP` for Codex work; non-aiASAP lane ownership is out of Codex scope unless G explicitly says otherwise.
- Security is #1. Check as often as appropriate and certainly before any push goes live.
- Telegram remains the default alert/smoke-test lane; call them `smoke test`, include build/version, link, brief summary, and exactly what G should test.
- After smoke tests, when appropriate, check Supabase or the relevant backend, report what the data shows, and carry that learning forward.
- New iterations can be pushed to Vercel only after G approves; live-domain promotion to `aiasap.ai`, `aiASAP.ai`, or other production domains also requires G approval.
- When G says get ready for a reboot, write a paste-back note that lets the next Codex pickup continue exactly where this one stopped.

## MVP Preview Cleanup + Speed Pass - 2026-04-30 Midday ET

- Current working lane remains `C:\Users\sgdie\Dropbox\Codex\aiASAP`; do not touch non-aiASAP lane.
- Production/domain `https://aiasap.ai` was not promoted in this pass.
- Latest Vercel preview smoke link: `https://ai-asap-igi3nqx8b-team-dietz.vercel.app/?_vercel_share=RjqnejNfXku5L22mq0zhM8qVA45ybhRy`.
- Latest preview deployment: `dpl_B8G9dUWdphCJNaoRUqkFUVpVVRGg`.
- MVP cleanup removed the visible Share and Bug Reports controls, deleted `/api/bug-report`, and removed the `bug_reports` schema object from the local Supabase schema.
- Fresh screenshots from `C:\Users\sgdie\Dropbox\Codex\Screenshot_20260430-115448.png`, `...115512.png`, and `...115539.png` showed an older preview (`ai-asap-qwgtw83vo`) with Share/Bugs still visible and list junk captures: `What about`, `Oh`, `Change back to`, `Needed`, and `Doctor`.
- Supabase confirmed the bad list captures came from partial LiveAvatar transcript chunks in session `66d30bcd-8020-4104-a415-f199e2ae3fe7`.
- List cleanup now rejects those filler fragments and holds incomplete fragments like `take Dad to` briefly so the next chunk can complete the list item instead of adding junk.
- Startup performance pass split the heavy LiveAvatar session UI out of the first page bundle and preloads it in parallel; first-load JS dropped from about `255 kB` to `108 kB`.
- `/api/start-session` now skips the LiveAvatar voice-preview probe unless `LIVEAVATAR_VERIFY_VOICE_PREVIEW=1`; the debug-token route still verifies voice fallback when needed.
- Local checks passed: `tsc --noEmit`, `next build`, `git diff --check`, and token-shaped secret scan.
- Preview smoke: root returned `200` in about `660 ms`; `/api/start-session` returned `200` in about `2.8 s`; Telegram smoke test was sent.

## Bedtime Handoff - 2026-04-29 Late ET

G asked to push the current MVP fixes through to `https://aiasap.ai` before bed and preserve the restart point for tomorrow.

### Lane and deploy rule

- Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP` only.
- Do not touch non-aiASAP lane.
- Production work is allowed only when the model is working enough for G to promote.
- For the next iteration after this deploy, work in Vercel preview/staging first, then promote only when stable.

### What was fixed in this bedtime pass

- Restored pill boxes to gray glass with aiASAP amber text.
- Moved the online lookup box lower and made it larger, lighter, scrollable, and capped to three visible pill prompts when it is up.
- Lookup results now stay in the box for waterfalls, concerts, weather, and other local searches instead of falling through to LiveAvatar monologues.
- Lookup speech is shorter: 6 says the ideas/weather are on screen instead of reading long lists aloud.
- List parsing now rejects filler like "you know", "a couple more", "so you didn't", "that to", and similar transcript fragments.
- The "For To Do List" bug came from parsing "to do for my dad" and treating `for` as the list name. That was fixed by rejecting `for` as a to-do scope and recognizing "a dad list" as `Dad List`.
- The compact list no longer says `Active List` above the title.

### Verification before live push

- `tsc --noEmit` passed using bundled Node.
- `next build` passed using bundled Node.
- `git diff --check` passed except normal CRLF warnings.
- Secret scan of `app` and `src` found only env-variable references, not raw secrets.

### Supabase and screenshots

- Latest transcript showed the real failures:
  - Waterfalls/weather/concerts were sometimes handled by LiveAvatar instead of app lookup.
  - 6 said "Hey, just checking in" while lookup/weather was pending.
  - Grocery list captured filler items like `A couple more` and `You know`.
  - To-do flow created `For To Do List`.
- Dropbox screenshots confirmed the box was too high on mobile and covering the face, the pills were too brown, and list headers/items needed cleanup.
- Supabase Storage still does not show these phone screenshots under `aiasap-media`; G's Dropbox screenshots are present locally in `C:\Users\sgdie\Dropbox\Codex`.
- The live Supabase `media_events` table is still missing unless it gets created later. Media upload route currently stores files/metadata and warns/skips the missing row.

### Tomorrow test path

Use production `https://aiasap.ai` after tonight's deploy.

1. Fresh start, confirm no memory and correct intro.
2. Say "find waterfalls near 21093" and confirm three ideas show in the box, with short speech.
3. Say "check weekend weather" and confirm weather shows in the box without a "just checking in" detour.
4. Start a grocery list and add real items; confirm filler is not added.
5. Say "make a dad list" or "a dad list, things I have to do for my dad"; confirm it says `Dad List`, not `For To Do List`.
6. Check mobile box placement: lower than face, scrollable by finger, pills gray.

### Paste-back phrase for tomorrow

```text
Read AIASAP_REBOOT_HANDOFF.md and continue from the 2026-04-29 Late ET bedtime handoff. Stay in aiASAP only. Production was promoted before bed after the MVP lookup/list/mobile polish. First check the latest production deploy status, then help me test fresh start, waterfalls/weather lookup, grocery list cleanup, Dad List, and mobile box placement. Check Supabase after I give test feedback.
```

## Current Shutdown Handoff - 2026-04-29 12:48 PM ET

G is heading out for a few hours. Pick up from here, not from the older stale sections below.

### Current production state

- Lane: Codex stays in `C:\Users\sgdie\Dropbox\Codex\aiASAP`. Do not touch non-aiASAP lane unless G explicitly redirects.
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

- Production deployment rule from G: once we have a working model, promote it to `www.aiASAP.ai`. After that, do iteration work in Vercel preview/staging, and only push/promote through aiASAP production when the model is fully working. Do not push half-finished iteration work to production.
- Current Supabase/backend ROE from G: after every smoke test when appropriate, check Supabase or the relevant backend and report what the data shows. For G/operator beta behavior feedback, use the full transcript sequence as source of truth.
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

For transcript/user-behavior diagnosis, wait for G's report or `sup/check sup/check soup` before the deep Supabase transcript read. For service, deploy, auth, storage, or logging changes, inspect the relevant backend immediately when appropriate.

### Suggested restart phrase for G

Copy/paste this when restarting:

```text
Read AIASAP_REBOOT_HANDOFF.md, STICKY_REBOOT_RULES.txt, and PROJECT_MEMORY.md. Continue from the 2026-04-29 12:48 PM ET shutdown handoff. Stay in aiASAP only. Do not touch non-aiASAP lane. Latest production is https://aiasap.ai build dpl_6KytR2KoURwY7BA6N3Lh2i1UcUsF / 0007fc5. First, summarize current state in 5 bullets max, then help me test the fresh-start, location/share, close-box, and account-memory flow. Follow the 2026-05-01 smoke-test/backend ROE.
```

## Emergency Reboot Handoff - 2026-04-29 ElevenLabs Key Rotation

- G is rebooting the whole system because the machine/session is running slow.
- Current lane: Codex stays in `C:\Users\sgdie\Dropbox\Codex\aiASAP`; do not touch non-aiASAP lane unless G explicitly redirects.
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
- Non-aiASAP lane ownership is out of Codex scope.
- Do not touch non-aiASAP lane from this repo/thread.

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

## 2026-05-01 Sup Transcript / List Guardrail Checkpoint

- Latest user direction was "look at the entire transcript from 6 ... in Sup" plus the Dropbox screenshots from around 11:45 AM.
- Supabase latest session reviewed: `conversation_messages` and `transcript_events` showed 6 turning product feedback and filler speech into list mutations.
- Screenshot evidence:
  - Grocery list captured junk item `Right`.
  - Removal/number discussion later captured junk item `Number`.
  - Walmart list was rose/pink instead of Walmart blue.
  - Filler phrases like `Codecs`, `In`, `Mm-hmm`, and `By the way` became list items.
  - Active list covered the lower UI and prompt pills were not visible under the list.
- Patch applied in `src/components/LiveAvatarSession.tsx`:
  - Product/design feedback guard catches Codex/screenshot/pillbox/permission/location-memory/list-duration commentary before list mutation.
  - List filler rejects `right`, `number`, `codex/codecs`, `in`, `mm-hmm`, `by the way`, `see`, `words in passing`, `but`, and similar transcript junk.
  - Voice list starts now ask for confirmation before creating a new list; explicit prompt taps still count as consent.
  - Active lists show action pills underneath: `Add Item`, `Close List`, `Open Another List`, `Store Mode`.
  - Walmart lists default to `Walmart Blue`.
  - Compact active list panel was raised and shortened so the pills/Terms area are not buried.
- Security/build verification:
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed locally.
  - Vercel preview build passed.
  - `git diff --check` only reported CRLF normalization warnings.
  - Strict literal secret scan was clean after changing `.env.example` placeholders away from key-shaped strings.
- Preview deployed only, not production:
  - Deployment `dpl_CGaBRnNQM1B4QdNFRDgP5zu95hSm`
  - Preview URL `https://ai-asap-le5mp2x8h-team-dietz.vercel.app?_vercel_share=hI1D1VGiH8lC9vHHyIoM0f6jG2AeYGiY`
  - Smoke checks: page 200, `/api/online-search` 200 with browser-like headers, `/api/liveavatar/debug-token` POST 200, no fresh 500 Vercel logs after valid smoke.
  - Earlier 500 logs were from malformed manual curl JSON, not the app.
- Telegram smoke test sent with this action line:
  - Test: start grocery list -> confirm first; yes -> add tomatoes/green peppers; say right/number/mm-hmm/by the way -> no junk items; take off right removes it if present; Walmart list is blue.
- Next step: wait for G to run the preview. Only after G feedback should Supabase be checked again for the new session transcript and data.

## 2026-05-01 Second Sup / Screenshot Correction

- G said `sup`, then `check screenshots`.
- Supabase latest session `11c38459-06f5-4f29-a050-1cef3dceab6b` showed the first preview still mutating a To Do List from product-review speech:
  - Added bad items: `Just write`, `In the`, `Blue`, `All these come up`, `They think`, `Crafts`, `Jewelry`, `All right`.
  - Product feedback being discussed: prompt boxes too high/large, `Finish Your Thought`, irrelevant online results, crafts/jewelry/garden items.
- Screenshots checked:
  - `Screenshot 2026-05-01 121823.png`: standby/tap state.
  - `Screenshot 2026-05-01 121900.png`, `121934.png`, `121950.png`: default pills and layout scaling.
  - `Screenshot 2026-05-01 122123.png`, `122137.png`: online search box/results; concerts returned craft/garden/gem-style results.
  - `Screenshot 2026-05-01 122216.png`: active To Do list showed `Just write`, `In the`; pills were present under the list, but the list panel was too large for two items.
  - `Screenshot 2026-05-01 122226.png`: online lookup notice `Adding more concerts`.
- Second patch:
  - Expanded product-feedback guard for `print screen`, `small mode`, `larger mode`, pillbox layout comments, `too high`, `too big`, `finish your thought`, `discuss challenges`, `plan next steps`, `ask for help`, `where are these five things coming up`, `none of this was relevant`, `not interested in`, `gem and jewelry`, and related feedback.
  - `detectListIntent`, `canInferListItems`, and `isOnlineLookupIntent` now reject protected product feedback before creating lists, adding items, or starting searches.
  - Prompt-brain blocks `Finish Your Thought`, `Discuss Challenges`, `Plan Next Steps`, and `Ask for Help`.
  - Compact active list panel now auto-sizes with max height instead of a fixed tall box; rows/buttons/title were reduced.
  - Concert online search prompt and post-filter now exclude craft/gem/jewelry/garden/car/toy/market/expo results unless the line is actually music/performance.
- Verification:
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - `git diff --check` only CRLF warnings.
  - Strict literal secret scan clean.
  - New preview smoke: page 200, `/api/online-search` for concerts 200 with music results, `/api/prompt-brain` 200 with blocked prompts absent, `/api/liveavatar/debug-token` POST 200, no fresh Vercel 500 logs.
- New preview only, not production:
  - Deployment `dpl_8rXdVTD2z9Yuyd9TktqzuDjb1upp`
  - Preview URL `https://ai-asap-hoaauv37p-team-dietz.vercel.app?_vercel_share=P9l54lXyPdui7eL3RpwXvl40Fjo0MIWV`
  - Telegram smoke test sent with target checks for bad pills, product feedback not mutating lists/search, smaller short To Do box, and concerts returning music.
- Next step: wait for G feedback, then check Supabase again against the new deployment/session.

## 2026-05-01 Third Mobile Sup / Screenshot Correction

- G pointed to the new mobile screenshot folder: `C:\Users\sgdie\Dropbox\Codex\Screenshots`.
- Local folder currently resolves as a Dropbox reparse-point directory with no files returned by `Get-ChildItem`, but the mobile screenshots visible from the run showed:
  - Lookup/location box still had a white-looking outer border and white X circle.
  - Active list layout with four pills underneath looked good.
  - Product-review speech still polluted lists with bad items.
- Supabase latest mobile session `58738761-ef99-4bbf-abfc-c8d0d17cf649` in `conversation_messages` had 94 rows from 1:12:49-1:17:29 PM ET:
  - `assistant:28`, `user:66`.
  - Sources: `liveavatar_api:71`, `product_feedback:14`, `list_state:9`.
  - `transcript_events` remained user-only; full transcript source is still `conversation_messages`.
- Supabase failure evidence:
  - Bad inferred list title: `Like To Do List`.
  - Bad list items: `Said the four`, `However`, `Wal-Mart`, `Now it's`, `Wigging out`, `Wow`, `Man`.
  - G expected "How about a to-do list?" to open a To Do List immediately, not ask a confirmation question.
  - G said prompt pills were not changing fast enough after 30-45 seconds.
- Third patch:
  - Lookup panel and X button now force brand-color border/X via inline style.
  - Removed plain `to-do list` / `todo list` from product-feedback-only guards so a real To Do List request can create the list.
  - Standard list requests now skip the confirmation prompt and open directly.
  - Added exact blockers for the bad Supabase fragments and layout-feedback phrases.
  - Walmart intent ignores result/commentary phrases like "came as number 3".
  - Prompt brain refresh changed from 45 seconds / 6 seconds to 12 seconds / 1.8 seconds.
  - Online lookup line cleaner strips numbering and drops "I need a ZIP code..." answer lines so location requests stay as the full-size notice box.
  - Prompt-brain blocks `Wow`, `Man`, `However`, `Said the four`, `Wigging out`, `White Box`, and `White Circle`.
- Verification:
  - `git diff --check` passed with only existing CRLF warnings.
  - `npm.cmd run typecheck` passed.
  - Strict literal secret scan clean.
  - `npm.cmd run build` passed locally.
  - Vercel preview remote build passed.
  - `vercel curl /` returned app HTML.
  - `vercel curl /api/online-search` POST with browser Origin returned 4 Timonium-area ideas and no craft/gem/jewelry junk.
  - `vercel curl /api/prompt-brain` POST returned default safe prompts with blocked fragments absent.
  - `vercel curl /api/liveavatar/debug-token` POST confirmed FULL payload with context/voice and `used_fallback_voice: false`; do not print/store the returned session token.
- New preview only, not production:
  - Deployment `dpl_3fhuhi7hGY9G5m9QoaUQqseQjySb`.
  - Preview URL `https://ai-asap-9yoer5bh7-team-dietz.vercel.app?_vercel_share=QVukmxZ0Elh1vlqsxc3icmBMbowXTfJN`.
- Next step: send Telegram smoke test and wait for G to test on mobile. After G feedback, check Supabase again and compare the transcript against the blocked fragments above.

## 2026-05-01 Mobile Prompt Position / Review-Talk Correction

- Latest Supabase review session checked before patching: `7f9cc9bd-5108-41d1-a07b-cdac8e668b4e`, 95 `conversation_messages` rows from about 8:13:50-8:15:48 PM ET.
- Transcript lesson: prompt-label/product-review speech such as "things below", "say something like", "find your better half", "plan a date night", and "date night ideas" must be treated as product feedback, not as a user lookup. The prior preview opened the lookup box and returned links even though G was reviewing labels.
- Screenshot lesson: the mobile start text `Tap Anywhere / To Talk to 6` was too low; mobile aiASAP mark could come down a smidge; the four prompt pills and box size looked good.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: product-feedback guards now include `things below`, `say something like`, and `prompt labels`; mobile aiASAP mark lowered from `pt-4` to `pt-5`; mobile start prompt raised from `bottom-[7rem]` to `bottom-[7.85rem]`; desktop start copy now says `Tap/Click Anywhere` while mobile stays `Tap Anywhere`.
  - `app/api/prompt-brain/route.ts`: prompt-brain feedback context now blocks `tap/click`, `prompt labels`, `things below`, and `say something like` so review talk falls back to the safe four prompts.
- Verification:
  - `git diff --check` passed with only CRLF warnings.
  - `npm.cmd run typecheck` passed.
  - Local `npm.cmd run build` passed after the known Dropbox/Next race was rerun serially.
  - Vercel remote preview build passed.
  - Protected share link returned HTTP `200`.
  - `/api/prompt-brain` returned safe default prompts for the exact "things below / date night ideas" review case.
  - `/api/liveavatar/debug-token` POST confirmed FULL mode, context+voice, voice `a65a59af-39bd-4f57-8cc6-235449ca3348`, and `used_fallback_voice: false`; do not print/store the session token.
  - Vercel preview error logs found no logs.
- New preview only, not production:
  - Deployment `dpl_GyVSo3J11TcYKdTEx73mJhLMTAKF`.
  - Preview URL `https://ai-asap-oxbv5mvfy-team-dietz.vercel.app?_vercel_share=SvBlrOd8cbN1pOGkvwwmFUVYJNKziFQs`.
- Telegram smoke sent as message `195`.
- Next step: G should test mobile start position, desktop `Tap/Click`, and review talk not opening lookup; after G says `sup`, check full Supabase transcript again before patching.

## 2026-05-01 Tap/Click Size Correction

- G asked to make `Tap/Click Anywhere` two sizes smaller while keeping `To Talk to 6` the same.
- Patch: `src/components/LiveAvatarSession.tsx` start-prompt top line font changed from `text-[0.92rem]` to `text-[0.74rem]`; `To Talk to 6` stayed `text-[1.95rem] sm:text-[2.3rem]`.
- Verification passed: `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build`, Vercel preview remote build, protected preview HTTP `200`, and no fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_FgwhoneeJUAHnkRMLNp99zw7wneg`.
  - Preview URL `https://ai-asap-iaaahkrbj-team-dietz.vercel.app?_vercel_share=3tTLFFuI9qN2v81XyyyKtWwyrShR60TJ`.
  - Telegram smoke sent as message `196`.
- Next step: G should check PC/mobile start screen size, then say `sup` if he tests it.

## 2026-05-01 Avatar Stage Height Correction

- G pointed to screenshot `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 204942.png`.
- Product wording: the framed box/video container that 6 stands in is the `avatar stage`.
- Request: make the whole avatar stage taller and close the top gap a little under the aiASAP name.
- Patch: `src/components/LiveAvatarSession.tsx` desktop avatar video height increased from `md:h-[88vh]` to `md:h-[90vh]`, max height from `74rem` to `76rem`; short desktop override increased from `86vh` to `88vh`; desktop stage translate moved closer to the top from `0.48rem` to `0.18rem` on short screens and from `0.35rem` to `0.12rem` on taller screens.
- Verification passed: `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build`, touched-file secret scan, Vercel preview remote build, protected preview HTTP `200`, and no fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_2zoc24DiZ5N7T4bFbu54XRPBNNyK`.
  - Preview URL `https://ai-asap-a82843vjo-team-dietz.vercel.app?_vercel_share=brp2Cf9hDYEMPLC9AkftE0hmXyfkKLe0`.
  - Telegram smoke sent as message `197`.
- Next step: G should check the desktop screenshot/layout for taller avatar stage and tighter top gap, then say `sup` if he tests it.

## 2026-05-01 Supabase Lookup/Product-Review Correction

- G said `sup`; latest Supabase `conversation_messages` session checked before patching:
  - Session `ea21c9b1-b32f-4d00-9c71-b83e85178942`.
  - 76 rows from about 8:54:59-8:56:25 PM ET.
  - Counts: `assistant=10`, `user=66`; sources included `liveavatar_api=33`, `user_transcription_event=30`, `assistant_app_repeat=7`, `product_feedback=6`.
- Transcript lesson:
  - G said `Wow, I'd like to plan this weekend. ... things should toggle... Every 3 to 4 seconds...` while reviewing the UI, not requesting a real lookup.
  - The app opened the lookup/ZIP box anyway, repeated ZIP-code prompts after `Every 3 to 4 seconds`, then returned weekend lookup results inside the avatar stage.
  - G explicitly said `I did not ask for the zip code to pop up`, `It should not pop up`, `That just shows how huge this box is`, and `And things are popping up on the inside the box`.
- Screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 205553.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 205604.png`
  - Both confirmed the oversized lookup panel/results overlaying the avatar stage.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: product-feedback guards now catch `things should toggle`, `buttons should toggle`, `toggle`, `toggling`, `zip code`, `should not pop up`, and `inside the box`.
  - Feedback-only speech now clears any accidental lookup panel/pending lookup state and resets prompts.
  - Invalid-ZIP detection now only responds to short numeric/ZIP-like input, so `Every 3 to 4 seconds` no longer triggers ZIP correction.
  - `app/api/prompt-brain/route.ts`: prompt-brain feedback context blocks the same toggle/ZIP-popup phrases and falls back to the safe four prompts.
- Verification passed:
  - `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build`, touched-file secret scan, Vercel preview remote build, protected preview HTTP `200`.
  - `/api/prompt-brain` returned safe fallback prompts for the exact failure phrase.
  - `/api/liveavatar/debug-token` POST confirmed FULL voice/context with `used_fallback_voice: false`; do not print/store session token.
  - No fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_GCJ6ATmdzPLNi95qXEcyvqExsSyo`.
  - Preview URL `https://ai-asap-auz6sw391-team-dietz.vercel.app?_vercel_share=m7y3FjkJKfhf9dKHTek66uZge9cUXVli`.
- Telegram smoke sent as message `198`.
- Next step: G should test review talk: say the buttons should toggle / ZIP code should not pop up; lookup should stay closed.

## 2026-05-01 Supabase Normal Conversation / In-Stage Lookup Correction

- G said `sup`; latest Supabase `conversation_messages` session checked before patching:
  - Session `ea665c33-cafe-43c0-aa1f-c30802bff132`.
  - 54 rows from about 9:06:19-9:07:37 PM ET.
  - Counts: `assistant=11`, `user=43`; sources included `liveavatar_api=27`, `user_transcription_event=20`, `assistant_app_repeat=4`, `product_feedback=3`.
- Transcript lesson:
  - The app still opened lookup on `Well, we could plan this weekend.`
  - G said the box was too big, should be inside where 6 is, and 6 should be talking like a normal conversation from here on out.
  - Product feedback did clear the accidental lookup panel, but 6 still felt too silent / too `Got`-heavy.
- Screenshot checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 210638.png`
  - It showed the lookup panel wider than the avatar stage.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: lookup panel narrowed and shortened on desktop so it fits inside the avatar stage; desktop panel moved to `md:top-[55vh]`, `md:h-[18vh]`, `md:w-[min(82vw,20rem)]`; notice/result text reduced.
  - Added direct normal-conversation path: when G says 6 should talk normally / talk to me / normal conversation, the app clears accidental lookup UI and 6 replies, `I'm here with you. I'll talk normally, and I won't pull boxes up unless you ask me to.`
  - Product-feedback guards now include `talking to me` / `normal conversation` phrases.
  - `app/api/prompt-brain/route.ts`: prompt-brain now treats normal-conversation review talk as feedback and falls back safely.
  - `tools/update_liveavatar_context.py`: LiveAvatar context changed so product review no longer means dead silence when G is directly talking to 6. It now says to talk back briefly and naturally, while not opening tools/UI.
- LiveAvatar context was pushed successfully with `python tools\update_liveavatar_context.py`: `SUCCESS context updated code=1000`.
- Verification passed:
  - `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build`, touched-file secret scan, Vercel preview remote build, protected preview HTTP `200`.
  - `/api/prompt-brain` returned safe fallback prompts for `6 should be talking to me like a normal conversation from here on out`.
  - `/api/liveavatar/debug-token` POST confirmed FULL voice/context with `used_fallback_voice: false`; do not print/store session token.
  - No fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_5RX3eQqFwC2b1fXwvBz5aiZymoBf`.
  - Preview URL `https://ai-asap-lykhhqogz-team-dietz.vercel.app?_vercel_share=nGnbZKvP9CONqE8ZZpy7Cxt7mdeWo0Ii`.
  - Telegram smoke sent as message `199`.
- Next step: G should test normal talk with 6 plus lookup box size/placement, then say `sup`.

## 2026-05-01 Overwatch Search Consent / Label-Review Correction

- G started aiASAP Overwatch and then said `done. check sup`.
- Latest Supabase `conversation_messages` session checked before patching:
  - Session `de37cc71-1c28-44db-8a92-42a2882c458f`.
  - 98 rows from about 9:25:17-9:27:17 PM ET.
  - Counts: `assistant=14`, `user=84`; sources included `liveavatar_api=43`, `user_transcription_event=37`, `assistant_app_repeat=7`, `product_feedback=9`, `preference_candidate=2`.
- Transcript lesson:
  - `Okay, so no date night ideas` and `Local hikes` were label/review speech, but the app opened the lookup/ZIP box.
  - `As soon as I stop talking` matched the lookup-close regex and made 6 say `I closed that box`.
  - G's desired flow is: when he is talking about finding something, 6 asks whether he wants to do a search; only after yes should pillboxes disappear and the square/search box open.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: lookup close now requires a real search/box/panel target, so `stop talking` does not close a box.
  - Search-like voice or prompt labels now ask `Want me to do a search for ...?` before opening the ZIP/search box.
  - Feedback guards now catch label-review phrases like `no date night ideas`, `no local hikes`, `I don't like the way that sounds`, `should ask me`, `do I want to`, `box came up`, `box went away`, and pillbox observations.
  - Product-feedback quiet time reduced from 35 seconds to 8 seconds so 6 can resume normal replies faster.
  - `app/api/prompt-brain/route.ts` blocks the same label-review phrases and falls back to the safe four prompts.
  - `tools/update_liveavatar_context.py` now tells LiveAvatar that label review is not search intent and normal search should ask for consent first.
- LiveAvatar context was pushed successfully with bundled Python: `SUCCESS context updated code=1000`.
- Verification passed:
  - `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build`, bundled `py_compile`, touched-file secret scan, Vercel preview remote build, protected preview HTTP `200`.
  - `/api/prompt-brain` returned safe fallback prompts for the label-review failure phrase.
  - `/api/liveavatar/debug-token` POST confirmed FULL voice/context with `used_fallback_voice: false`; do not print/store session token.
  - No fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_83QguzDtYvAYEt9qca2Baiqzgd1R`.
  - Preview URL `https://ai-asap-oduwes84y-team-dietz.vercel.app?_vercel_share=zJWphPZRb9TxezRowlbMQXWMzQqcds0I`.
  - Telegram smoke sent as message `200`.
- Next step: G should say `Local Hikes`; 6 should ask before search. If G says yes, then the ZIP/search box should open. Then G should say `sup`.

## 2026-05-01 Overwatch Screenshot/List Pollution Correction

- G kept testing while Codex monitored and then asked whether Codex could understand what he was saying to 6.
- Latest Supabase `conversation_messages` session checked:
  - Session `edd9621e-a5c2-405b-822b-0934f25e976e`.
  - 227 rows from about 9:39:21-9:44:04 PM ET.
  - Counts: `assistant=39`, `user=188`; sources included `liveavatar_api=93`, `user_transcription_event=86`, `product_feedback=18`, `assistant_app_repeat=14`, `list_state=14`.
- Answer to G's question: yes, the transcript was understandable enough to diagnose and patch. It was not perfect, but it clearly captured the product issues and the intended grocery-list test.
- Screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 214012.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 214130.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-01 214307.png`
- Screenshot/transcript lesson:
  - A pink-accent To Do List appeared while G was reviewing.
  - The Grocery List was polluted with review/gibberish fragments: `So I don't know`, `It came up pink`, `I'm being quiet`, `You cannot`, `Let's do— let's a together`, `In here`, and `I wanna blueberries`.
  - 6 missed the intended grocery items `blueberries`, `eggs`, and `onions`.
  - The compact list panel was still too wide over the avatar stage.
  - Search/box consent still failed in the old preview on `Plan the weekend` / `fun things`: box came up without asking.
- Patch:
  - `src/components/LiveAvatarSession.tsx`: added a 90-second product-review intent guard after Codex/Supabase/screenshot/pillbox/box feedback, so review talk cannot create lists, add list fragments, remove fragments, or ask search-consent unless G clearly addresses 6 with an action.
  - Strengthened list filler/review guards for `came up pink`, `being quiet`, `screenshot`, `transcription`, `Supabase`, `Codex is monitoring`, and related fragments.
  - Grocery and To Do lists now default to brand amber instead of cycling into pink/rose.
  - Compact list panel width narrowed to `md:w-[min(82vw,20rem)]` / max `20rem`, matching the lookup panel inside the avatar stage.
  - `app/api/prompt-brain/route.ts` now treats the same screenshot/Codex/Supabase review phrases as fallback context.
  - `tools/update_liveavatar_context.py` now instructs LiveAvatar not to enter tool/list/search mode during Codex/Supabase/screenshot review talk.
- LiveAvatar context was pushed successfully with bundled Python: `SUCCESS context updated code=1000`.
- Verification passed:
  - `git diff --check`, `npm.cmd run typecheck`, local `npm.cmd run build` after one known Dropbox `.next\export` lock rerun, bundled `py_compile`, touched-file secret scan, Vercel preview remote build, protected preview HTTP `200`.
  - `/api/prompt-brain` returned safe fallback prompts for screenshot/Codex review talk.
  - `/api/liveavatar/debug-token` POST confirmed FULL voice/context with `used_fallback_voice: false`; do not print/store session token.
  - No fresh Vercel preview error logs.
- New preview only, not production:
  - Deployment `dpl_2Kf4rS1zU4F4HXZBiPWkA9MLobJN`.
  - Preview URL `https://ai-asap-r1m8hystt-team-dietz.vercel.app?_vercel_share=paMXDNvNtDcTVDtS8x7EjOUwX3aNXy4I`.
  - Telegram smoke sent as message `201`.
- Next step: G should test saying screenshot/Codex/Supabase review talk first, then deliberately ask 6 to make a grocery list and add blueberries, eggs, and onions. The review talk should not pollute the list; the real grocery items should land.

## Important Commands

```powershell
cd C:\Users\sgdie\Dropbox\Codex\aiASAP
git status --short
git log --oneline --decorate --graph -12
npm.cmd run build
npm.cmd run typecheck
```

## Break Handoff - 2026-05-02 10:04 AM ET

- G is taking a shower/breakfast break. Resume in aiASAP only.
- Latest completed request: `sup and screenshots`.
- Supabase checked before patching:
  - Source: latest `conversation_messages`, session `a631c24a-8cd4-4271-83a6-a787c8974d43`.
  - 174 rows from `2026-05-02T13:50:04Z` to `2026-05-02T13:54:09Z`.
  - Lesson: list review/filler speech was still becoming items, custom lists could default pink, bare `Blue.` did not recolor the active list, and color-change speech could rename the list to `Color List`.
- Dropbox screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 095301.png`: New List appeared rose/pink with item `Pink`.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 095152.png`: Grocery List polluted with review fragments including `Repeat that after- repeat that`, `Tell me what I just`, `Needs to be`, and `Thinner to not`.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-02 095110.png`: Grocery List still had `Repeat that after- repeat that`.
- Patch in `src/components/LiveAvatarSession.tsx`:
  - Custom lists default to brand amber/Honey Amber instead of rotating into rose/pink.
  - Bare non-pink color words such as `Blue.` can recolor the active list.
  - Color/style commands no longer add list items.
  - Color-change speech no longer triggers list rename.
  - Stronger guards block review/filler fragments such as `tell me what`, `repeat that`, `needs to be`, `thinner to`, `normal mode`, `silent`, screenshot/screen/brand-color talk, and bare color chatter from becoming list items.
- Verification passed:
  - `git diff --check -- src/components/LiveAvatarSession.tsx .vercelignore` clean except CRLF warning.
  - Touched-file secret scan clean.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run build` passed.
  - Vercel preview remote build passed.
  - Protected preview returned HTTP `200`.
  - Vercel preview error logs clean.
- Latest preview only, not production:
  - Deployment `dpl_EewCi3v8TtWg2SgvSrPbti43crEH`.
  - Preview URL `https://ai-asap-7jiqi9cv5-team-dietz.vercel.app/?_vercel_share=Qo2iclEeJLOO1xo4YFsNhpSSKVGN1nhd`.
  - Telegram smoke sent as message `218`.
- Resume order:
  1. Wait for G feedback or screenshots.
  2. If G says `sup`, `screenshots`, or reports behavior, check Dropbox screenshots and the latest full `conversation_messages` before patching.
  3. Key smoke focus: review/filler talk should not pollute lists; new custom lists should start amber; saying `blue` with a list active should recolor it; color talk should not rename the list.
  4. Do not production/domain push without explicit G approval and security review.

## Screenshot Layout Handoff - 2026-05-03 9:30 AM ET

- G explicitly said no Supabase check for this pass.
- Screenshots used:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Desktop1.png`: prompt pills needed to sit inside the blue lower-torso box; fourth pill was too low.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Desktop2.png`: desktop compact list needed to fit inside the blue box and leave more hands visible.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Mobile1.png`: mobile prompt pills needed the same lift/tighten; fourth pill was too low.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\zMobile2.png`: intentionally left unchanged.
- Patch:
  - `src/components/LiveAvatarSession.tsx` lifts prompt pills to `8.35rem`, tightens gaps and pill heights, and reduces prompt font sizing slightly so all four fit in the marked zone.
  - Adds a `min-width: 700px` desktop-width override because G's desktop screenshots were narrower than the old `768px` breakpoint.
  - Raises and shortens the desktop compact list panel; mobile compact list baseline is unchanged.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file conflict/secret scan.
  - `npm.cmd run build`
  - `npm.cmd run typecheck`
  - Local dev server restarted and `http://localhost:3002/` returned `200`.
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-8fc8hdscy-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for the new deployment had no logs.
- Latest preview only, not production:
  - Deployment `dpl_5oEQ2Hhc96WaYWG1vrNgafh8FNxo`.
  - Preview URL `https://ai-asap-8fc8hdscy-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.
- Resume order:
  1. Ask G to test Desktop1/Desktop2/Mobile1 positions against the blue boxes.
  2. Do not change Mobile2 unless G explicitly says it moved or needs work.
  3. Do not check Supabase for this layout pass unless G asks for `sup` or gives test feedback that needs transcript review.

## Hand-Clear Layout Handoff - 2026-05-03 9:44 AM ET

- G provided two mobile and two desktop screenshots and clarified the acceptance criterion: the prompt/list boxes must sit completely above 6's entire hands so the full hands remain visible.
- Screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-093317.png`: mobile compact list still covered the hand zone.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-093308.png`: mobile prompt pills still covered the hand zone.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 093439.png`: desktop compact list still covered the hand zone.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 093427.png`: desktop prompt pills still covered the hand zone.
- Patch:
  - `src/components/LiveAvatarSession.tsx` raises mobile prompt pills to `12.85rem` above the stage bottom.
  - Raises desktop/narrow-desktop prompt pills and compact list panels to `17.25rem` above the stage bottom.
  - Raises short-height desktop fallback to `14.25rem`.
  - Shortens mobile and desktop compact list panel heights so the bottom edge clears the hands.
- Local dev note:
  - Parallel build/typecheck initially caused the known `.next/types` race; serial build and then serial typecheck passed.
  - Local Next dev served a stale generated `.next` cache after the build; only aiASAP Next dev PIDs were stopped, generated `.next` was removed after verifying the path was inside `C:\Users\sgdie\Dropbox\Codex\aiASAP`, and one clean server was restarted on `http://localhost:3002/`.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file conflict/secret scan.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Local `http://localhost:3002/` returned `200`.
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-r9b4a2qm3-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for the new deployment had no logs.
  - Supabase was not checked because this was a screenshot-only layout pass.
- Latest preview only, not production:
  - Deployment `dpl_ELHH1cdB55UcpJBGcUaB1J4ZVFLV`.
  - Preview URL `https://ai-asap-r9b4a2qm3-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.
- Resume order:
  1. Ask G to test both mobile and desktop prompt/list boxes against full hand visibility.
  2. If boxes still touch hands, move them higher first before changing avatar framing.
  3. Do not check Supabase for this layout pass unless G asks for `sup` or gives transcript-related feedback.

## Four-Screenshot Hand-Clear Follow-Up - 2026-05-03 9:54 AM ET

- G said there were four more screenshots. Codex treated them as screenshot-only layout feedback and did not check Supabase.
- Screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-094544.png`: mobile compact list still too tall and riding into wrist/hand zone.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-094533.png`: mobile prompt stack was closer, but bottom still needed safer clearance.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 094657.png`: desktop compact list still too tall for full hand visibility.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 094646.png`: desktop prompt stack was close but got a small extra lift.
- Patch:
  - `src/components/LiveAvatarSession.tsx` shortens mobile compact list panel to `min(13vh,11.25rem)`, narrows it to `min(84vw,34rem)`, and raises it to `14.65rem`.
  - Raises mobile prompt pills to `14.65rem`.
  - Shortens desktop compact list panel to `min(14vh,11.5rem)`, narrows it to `min(78vw,34rem)`, and raises desktop/narrow-desktop boxes to `18.85rem`.
  - Raises short-height desktop fallback boxes to `15.65rem`.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file conflict/secret scan.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Local `http://localhost:3002/` returned `200`.
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-5z9l5u997-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for the new deployment had no logs.
- Latest preview only, not production:
  - Deployment `dpl_5RdfFRSH3BJmYhXyfoqj8ZdAnnb4`.
  - Preview URL `https://ai-asap-5z9l5u997-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.
- Resume order:
  1. Ask G to test the latest preview on mobile and desktop.
  2. If hands still are not fully visible, keep shortening/raising the compact list first.
  3. Do not check Supabase unless G says `sup` or reports transcript/conversation behavior.

## Screenshot-Measured Correction - 2026-05-03 10:11 AM ET

- G pushed back that Codex must match the marked screenshots exactly and verify visually instead of making assumptions.
- Current four screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-095542.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-095523.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 095719.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 095710.png`
- Blue markup measured from pixels:
  - Mobile prompt rectangle approximately `x=144 y=1296 w=820 h=538`.
  - Mobile list rectangle approximately `x=88 y=1292 w=880 h=540`.
  - Desktop list rectangle approximately `x=154 y=626 w=512 h=316`.
  - Desktop prompt rectangle approximately `x=176 y=638 w=486 h=318`.
- Key lesson: the mobile prompt stack was actually too high against G's blue box. The previous pass over-corrected because it treated screenshot pixels like CSS pixels and ignored phone device-pixel ratio.
- Patch:
  - `src/components/LiveAvatarSession.tsx` sets mobile prompt lift to `11.75rem`, lowering the prompt stack into the marked mobile blue rectangle while keeping it above the hands.
  - Mobile compact list width is now `min(82vw,34rem)` to fit the marked mobile list rectangle.
  - Desktop compact list width is now `min(68vw,32rem)` to fit the marked desktop list rectangle.
  - Desktop prompt vertical placement was not moved because it already sat inside the marked desktop prompt rectangle.
- Visual verification:
  - Real local `http://localhost:3002/` loaded in the in-app browser after clearing stale generated `.next`.
  - Codex could verify the real start screen visually.
  - Active prompt/list UI could not be entered from the Codex browser because microphone permission was denied; do not claim full active-session visual verification from Codex browser unless this permission path changes.
  - Active-state placement source of truth for this pass was the measured blue screenshot rectangles.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file conflict/secret scan.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Local `http://localhost:3002/` returned `200`.
  - In-app browser loaded the real local start screen.
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-43x55dx12-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for the new deployment had no logs.
  - Supabase was not checked.
- Latest preview only, not production:
  - Deployment `dpl_GkKQoBNjAu3xVttfmKUrycFU8Vgi`.
  - Preview URL `https://ai-asap-43x55dx12-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.
- Resume order:
  1. Ask G to test the exact four states on latest preview.
  2. If he sends new screenshots, measure the blue rectangles again before patching.
  3. Do not move vertically unless the measured rectangle says to; distinguish screenshot pixels from CSS pixels.

## Metallica Locked-Stage MVP Pass - 2026-05-03 10:55 AM ET

- G dropped Metallica screenshots as the layout reference and asked for the aiASAP boxes to lock the same way: the media may crop underneath, but the logo, prompt pills, note/list panel, and start prompt must stay tied to one defined avatar stage instead of floating on separate black shelves.
- Screenshots checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 102110.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 102101.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 102046.png`
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 104104.png`
- Patch:
  - `src/components/LiveAvatarSession.tsx` now treats the avatar as the locked stage and uses `object-fit: cover` so tall-thin views crop 6 under the overlays instead of making black bands above and below.
  - Prompt pills and compact list panel use fixed stage-relative `top` positions and fixed heights; the list panel no longer grows down toward 6's hands.
  - Button/panel widths are capped by `--aiasap-lock-w` so compressed desktop views do not let pills run over 6's face or outside the avatar stage.
  - Startup logo and `Tap/Click Anywhere / To Talk To 6` now render inside the same locked stage. This is MVP-acceptable, not pixel-perfect.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file secret/conflict scan; hits were code terms only, no real secrets.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Local production verification on `http://localhost:3003/` returned `200` and rendered the locked-stage startup screen in the in-app browser.
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-840wa0ec6-team-dietz.vercel.app` returned page HTML.
  - `npx.cmd vercel logs dpl_A6R6QdsdoPv7Y6txiF98ih6NqqYM --no-follow --level error --since 10m` found no logs.
  - Supabase was not checked because this was screenshot/layout-only feedback.
- Latest preview only, not production:
  - Deployment `dpl_A6R6QdsdoPv7Y6txiF98ih6NqqYM`.
  - Preview URL `https://ai-asap-840wa0ec6-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.
- Resume order:
  1. Ask G to test desktop resize, tall-thin view, mobile prompt pills, and list growth above 6's hands.
  2. Do not keep tuning this unless G sends marked screenshots showing a real MVP blocker.
  3. If tuning resumes, keep the Metallica rule: media crops under fixed controls; controls do not chase viewport height.

## Restart Screen Cleanup - 2026-05-03 11:02 AM ET

- G pointed at `C:\Users\sgdie\Dropbox\Codex\Screenshots\Restart.png` and said the restart screen should only show:
  - `Session ended`
  - `Thank you for using aiASAP`
  - `Restart` button
- Patch:
  - `src/components/LiveAvatarDemo.tsx` removes the finger/use-again instruction line and changes the title casing to `Session ended`.
  - Restart behavior was left unchanged.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarDemo.tsx`
  - Touched-file secret/conflict scan; hits were local variable names only, no real secrets.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-h0ipal9la-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for `dpl_C1wwVMWFyz3YDDxeVH7Jo7k14MAY` had no logs.
  - Supabase was not checked because this was screenshot/copy-only feedback.
- Latest preview only, not production:
  - Deployment `dpl_C1wwVMWFyz3YDDxeVH7Jo7k14MAY`.
  - Preview URL `https://ai-asap-h0ipal9la-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.

## Mobile Pillbox Blue-Line Tune - 2026-05-03 11:10 AM ET

- G said the latest mobile list is perfect and must not be touched. Only the pillbox page needed adjustment: pills were a little too big and should fit inside the blue guide lines.
- Screenshot checked:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot_20260503-105449.png`
- Patch:
  - `src/components/LiveAvatarSession.tsx` only changes the mobile `.aiasap-thought-prompts` / `.aiasap-thought-prompt` sizing rules.
  - Mobile pill gap tightened from `0.45rem` to `0.34rem`.
  - Mobile pill height reduced from `3.05rem` to `2.72rem`.
  - Mobile pill width reduced from `min(100%, 82vw, 17.25rem)` to `min(100%, 78vw, 16rem)`.
  - Mobile pill font size capped at `0.9rem`.
  - Compact list panel rules were not changed.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file secret/conflict scan; hits were code variable names only, no real secrets.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-da494qezv-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for `dpl_8et6F5bRo2LZqDCeQ8zPeUfSbvKn` had no logs.
  - Supabase was not checked because this was screenshot/layout-only feedback.
- Latest preview only, not production:
  - Deployment `dpl_8et6F5bRo2LZqDCeQ8zPeUfSbvKn`.
  - Preview URL `https://ai-asap-da494qezv-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.

## Measured Desktop Blue-Line Placement - 2026-05-03 11:21 AM ET

- G added two new desktop screenshots and asked for a one-shot placement fix.
- Screenshots checked and blue markup measured:
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 110121.png`: blue box `x=107 y=612 w=531 h=327`.
  - `C:\Users\sgdie\Dropbox\Codex\Screenshots\Screenshot 2026-05-03 110112.png`: blue box `x=176 y=635 w=535 h=339`.
- Placement math:
  - Both blue boxes place the control-area top at about `50.5%` of screenshot height.
  - Desktop avatar stage has `--aiasap-lock-top` at `5vh`, so desktop overlay top should be `calc(var(--aiasap-lock-top) + 45.5vh)`.
  - Predicted list top: `611.6px` vs blue top `612px`; predicted list bottom: `935.6px` vs blue bottom `938px`.
  - Predicted pill top: `635.8px` vs blue top `635px`.
- Patch:
  - `src/components/LiveAvatarSession.tsx` sets desktop pill/list top from `46.8vh` to measured `45.5vh`.
  - Desktop compact list panel height is now `20.25rem` so it fills the marked torso box.
  - Mobile pill-size rules and the list-perfect mobile state were not changed.
- Verification passed:
  - `git diff --check -- src\components\LiveAvatarSession.tsx`
  - Touched-file secret/conflict scan; hits were code variable names only, no real secrets.
  - Serial `npm.cmd run build`
  - Serial `npm.cmd run typecheck`
  - Vercel remote build passed.
  - `npx.cmd vercel curl / --deployment https://ai-asap-qqmkk75va-team-dietz.vercel.app` returned page HTML.
  - Vercel error logs for `dpl_8tbHQatKvu99M9dwy614rpq3QE5V` had no logs.
  - Supabase was not checked because this was screenshot/layout-only feedback.
- Latest preview only, not production:
  - Deployment `dpl_8tbHQatKvu99M9dwy614rpq3QE5V`.
  - Preview URL `https://ai-asap-qqmkk75va-team-dietz.vercel.app`.
  - Share helper failed; URL is Vercel-auth protected.
  - Telegram smoke test sent successfully.

## User Preferences To Remember

- Reboot contract: G keeps a sticky-note list because assistants forget. Treat these rules as startup requirements, not suggestions.
- Assistant-wide lane rule: Codex works aiASAP unless G explicitly says otherwise. Never cross lanes unless G knows it.
- Send Telegram link when a test build is ready, always.
- If Telegram is needed, use `.env` `TELEGRAM_BOT_TOKEN` plus `TELEGRAM_ALLOWED_USER_IDS`; direct Bot API send was verified on 2026-04-27 with `ok=True`.
- Telegram voice notes are supported in `telegram_codex_bot.py`: Telegram `voice` audio is downloaded, transcribed with OpenAI audio transcriptions using `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`, then answered through the normal chat path. G's latest voice-note transcript appeared in `telegram_conversations.json` on 2026-04-27.
- Do not claim Telegram sending is impossible. Figure out the local route and send the message when operationally useful.
- After every smoke test when appropriate, check Supabase or the relevant backend and learn from the latest service/session data before deciding next changes.
- Verify access routes into Telegram, Vercel, Supabase, GitHub, Resend, LiveAvatar/context, and other required services before saying a service is unavailable. Check local envs, helper scripts, CLIs/APIs, dashboards, and route around blockers.
- Every smoke test is sent to Telegram unless G explicitly says otherwise.
- Smoke test format in Telegram is exactly three lines: line 1 `Smoke test <build/version>`, line 2 the Vercel link, line 3 a super brief description of changes plus what G should do next.
- When possible, provide desktop links in chat because integrations are easier for G on the computer. Use Telegram/mobile links when necessary or explicitly requested.
- If G says to check the latest screenshots, look in Dropbox first.
- If G needs to copy/paste something, provide a copyable block or local file/link automatically and make it easy to copy.
- Every final work brief must be super brief. Put any questions at the end under `Questions:` because G will not see buried questions.
- Always security review before deploy.
- Keep aiASAP separate from non-aiASAP lane.
- Keep final briefs short and include decisions needed.
- Do not start LiveAvatar sessions while the provider issue is being investigated.

## Restart Checklist

1. Confirm path is `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
2. Read `PROJECT_MEMORY.md` and this handoff before making product decisions.
3. Run `git status --short` and preserve any user/other-assistant changes.
4. Keep Codex on aiASAP only; non-aiASAP lane ownership is out of Codex scope.
5. Before meaningful product/code/database changes: audit first, give G the plan, get explicit approval, then build.
6. When a build/deploy/review URL is ready, send G a Telegram smoke-test message unless he explicitly says otherwise.
7. After G runs a smoke test, inspect Supabase for sessions, transcripts, conversation messages, account/list/reminder rows, or errors. Summarize what was learned before recommending fixes.
8. Before external-service work, verify routes for Vercel, Supabase, GitHub, Resend, Telegram, and any other required provider.
9. Keep the final response brief and put questions last.

## Social Artwork Pause / Step-Out Handoff - 2026-05-04 7:41 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social Artwork v8 No-Bar Update - 2026-05-04 9:33 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork is draft-only until I approve exact files. Latest preview is https://ai-asap-me2g878u9-team-dietz.vercel.app, deployment dpl_8FwrHYr1Q6gE8VWrQ5UhSgtxFpTm. Local review server was http://127.0.0.1:3004. sup means Supabase only; ss means Supabase plus screenshots.
```

- Current lane: aiASAP only, in `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
- Production/domain rule: do not touch or promote `aiasap.ai` or `www.aiasap.ai`. This artwork pass used preview only.
- Telegram rule for this pause: G explicitly said no Telegram links right now; he wants desktop links unless he asks for Telegram/mobile.
- Approval rule: no artwork gets uploaded into any social account until G approves the exact file.
- Official email rule: use `aiASAP@pm.me` with that exact capitalization everywhere possible. `app/legal/page.tsx` already uses that email in the legal contact paragraph.
- Current Social CENTCOM route:
  - Local while server is running: `http://127.0.0.1:3004/social`
  - Local v7 proof sheet: `http://127.0.0.1:3004/social-artwork/v7/aiasap-social-artwork-v7-proof-sheet.png`
  - Preview Social CENTCOM: `https://ai-asap-epp1lcdtf-team-dietz.vercel.app/social`
  - Preview v7 proof sheet: `https://ai-asap-epp1lcdtf-team-dietz.vercel.app/social-artwork/v7/aiasap-social-artwork-v7-proof-sheet.png`
- Preview deployment:
  - `dpl_DYMxrHDxSHepCUPu7NfP7ZxHcfQ5`
  - `https://ai-asap-epp1lcdtf-team-dietz.vercel.app`
  - Vercel inspect showed target `preview` and status `Ready`.
  - Raw unauthenticated browser/curl may hit Vercel protection. Verified with `npx.cmd vercel curl`.
- Current local server:
  - Fresh Next dev server was started on port `3004` and verified good.
  - Old/stale `3003` may still be open in the browser and may show older proof assets. Prefer `3004` or restart fresh if needed.

Artwork state:

- G approved skin-tone variant `C`: reduce 6's redness into a natural brown/tan tone.
- G approved final profile crop direction: same close-up zoom, no gold/yellow ring, no thin inner circle, face nudged slightly down from the prior no-ring proof.
- G rejected all strong yellow/gold profile rings and any thin inner circle treatment in profile or rectangular artwork.
- G wants `aiASAP` in artwork to use the clean italic website-style wordmark, not a pixel-cropped screenshot. Current v7 uses rendered bold italic text.
- G likes the soft-brown radial/fade palette with blackish edges and muted brown center; avoid hot yellow center.
- G pointed out blue/gray screenshot bars around 6 from oversized LiveAvatar captures; current v7 cleaned screenshot edges.
- G likes using 6 as the brand face for profile circles and banner/hero art, but every final asset still needs approval before upload.

Generated v7 draft kit:

- Folder: `public/social-artwork/v7/`
- Proof sheet: `public/social-artwork/v7/aiasap-social-artwork-v7-proof-sheet.png`
- Manifest: `public/social-artwork/v7/manifest.json`
- Assets generated for:
  - brand lockups
  - master profile
  - X profile/banner
  - Facebook profile/cover
  - Instagram profile/square/portrait/reel cover
  - Threads profile/vertical
  - TikTok profile/cover
  - YouTube banner/thumbnail/watermark
- Source captures remain under:
  - `public/social-artwork/source-captures/liveavatar/clean/`
  - `public/social-artwork/source-captures/mobile-logo/`

Code/files touched in this artwork pass:

- `src/components/SocialPostingHub.tsx`
  - `SOCIAL_ARTWORK_VERSION` now points to `v7`.
  - Proof sheet path now points to `aiasap-social-artwork-v7-proof-sheet.png`.
  - Current artwork text says v7 uses approved C tone, final no-ring framing, cleaned screenshot edges, clean italic aiASAP marks, and the soft-brown palette.
- `app/legal/page.tsx`
  - Legal contact email is `aiASAP@pm.me`.
- `public/social-artwork/v7/`
  - New draft artwork kit.

Verification already passed:

- `npm.cmd run typecheck`
- `git diff --check -- src/components/SocialPostingHub.tsx public/social-artwork/v7`
  - Only warning was Git line-ending normalization for `src/components/SocialPostingHub.tsx`.
- Local:
  - `curl.exe -I --max-time 10 http://127.0.0.1:3004/social` returned `200`.
  - `curl.exe -I --max-time 10 http://127.0.0.1:3004/social-artwork/v7/aiasap-social-artwork-v7-proof-sheet.png` returned `200`.
- Vercel preview:
  - `npx.cmd vercel deploy --yes` created preview deployment `dpl_DYMxrHDxSHepCUPu7NfP7ZxHcfQ5`.
  - Remote build completed successfully.
  - `npx.cmd vercel inspect https://ai-asap-epp1lcdtf-team-dietz.vercel.app` showed preview status `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-epp1lcdtf-team-dietz.vercel.app` returned the v7 Social CENTCOM HTML.
  - `npx.cmd vercel curl /social-artwork/v7/aiasap-social-artwork-v7-proof-sheet.png --deployment https://ai-asap-epp1lcdtf-team-dietz.vercel.app -- --head` returned `200` and the expected `Content-Length: 1209410`.
  - `npx.cmd vercel logs https://ai-asap-epp1lcdtf-team-dietz.vercel.app --no-follow --level error --since 10m` returned no logs.

Next move when G returns:

1. Open the local or preview v7 proof sheet on desktop.
2. Ask G for visual approval/rejections on v7 only.
3. If G gives changes, create a v8 draft proof first. Do not upload or connect socials yet.
4. If G approves exact files, only then prepare the social upload/apply phase.
5. Keep final replies short with desktop links. No Telegram unless G asks.

## Social Artwork v8 No-Bar Update - 2026-05-04 9:33 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social Artwork v8 No-Bar Update - 2026-05-04 9:33 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork is draft-only until I approve exact files. Latest preview is https://ai-asap-me2g878u9-team-dietz.vercel.app, deployment dpl_8FwrHYr1Q6gE8VWrQ5UhSgtxFpTm. Local review server was http://127.0.0.1:3004. sup means Supabase only; ss means Supabase plus screenshots.
```

- G asked what the teal and tan lines under the logo/tagline were for and said he did not like the look.
- Answer: they were only decorative separator/accent bars with no functional purpose.
- Action taken:
  - Created `public/social-artwork/v8/` from v7 with teal/tan separator bars removed.
  - Regenerated proof sheet: `public/social-artwork/v8/aiasap-social-artwork-v8-proof-sheet.png`.
  - Updated `public/social-artwork/v8/manifest.json` to record that the bars were removed.
  - Updated `src/components/SocialPostingHub.tsx` to point to v8 and state that v8 has no teal/tan separator bars.
- Visual check:
  - Initial v8 removal pass caused vertical marks in `facebook-cover-851x315.png`; regenerated from original v7 with cleaner horizontal background fill.
  - A pixel scan found no remaining teal pixels in v8 artwork files.
- Current review links:
  - Local Social CENTCOM: `http://127.0.0.1:3004/social`
  - Local v8 proof sheet: `http://127.0.0.1:3004/social-artwork/v8/aiasap-social-artwork-v8-proof-sheet.png`
  - Preview Social CENTCOM: `https://ai-asap-me2g878u9-team-dietz.vercel.app/social`
  - Preview v8 proof sheet: `https://ai-asap-me2g878u9-team-dietz.vercel.app/social-artwork/v8/aiasap-social-artwork-v8-proof-sheet.png`
- Preview deployment:
  - `dpl_8FwrHYr1Q6gE8VWrQ5UhSgtxFpTm`
  - `https://ai-asap-me2g878u9-team-dietz.vercel.app`
  - Target `preview`; status `Ready`.
- Verification passed:
  - `npm.cmd run typecheck`
  - `git diff --check -- src/components/SocialPostingHub.tsx public/social-artwork/v8`
  - `curl.exe -I --max-time 10 http://127.0.0.1:3004/social-artwork/v8/aiasap-social-artwork-v8-proof-sheet.png` returned `200`.
  - `curl.exe -I --max-time 10 http://127.0.0.1:3004/social` returned `200`.
  - Vercel remote build passed.
  - `npx.cmd vercel inspect https://ai-asap-me2g878u9-team-dietz.vercel.app` showed preview `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-me2g878u9-team-dietz.vercel.app` returned HTML with v8 assets.
  - `npx.cmd vercel curl /social-artwork/v8/aiasap-social-artwork-v8-proof-sheet.png --deployment https://ai-asap-me2g878u9-team-dietz.vercel.app -- --head` returned `200` and `Content-Length: 1196897`.
  - `npx.cmd vercel logs https://ai-asap-me2g878u9-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
- No production touch. No Telegram. No social upload.

## Social Install Console Pass - 2026-05-04 11:07 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social Install Console Pass - 2026-05-04 11:07 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork v12 is approved by G, but actual social account saves/publishes still require G/account-owner action at platform login, upload, and final save points. Latest preview is https://ai-asap-7j1e8l47i-team-dietz.vercel.app, deployment dpl_7fYMNtLnrYLxW2xvJCdMa1H8hEPd. Local desktop page is http://127.0.0.1:3004/social; port 3003 may be stale/500. sup means Supabase only; ss means Supabase plus screenshots.
```

- G approved the social artwork and told Codex to do everything possible to get banners/socials ready.
- Boundaries still active:
  - Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
  - Preserve the dirty worktree.
  - Preview-only Vercel work; do not promote or touch `aiasap.ai`.
  - No Telegram unless G asks.
  - Social account uploads/profile edits are public account changes. Use the approved artwork, but stop for platform login/account owner prompts and final save/publish confirmations.
- Action taken:
  - `src/components/SocialPostingHub.tsx` now includes a dedicated Install console in the required order: X, YouTube, TikTok, Facebook, Instagram, Threads.
  - Install console has platform open buttons, per-platform approved asset slots, asset open/copy buttons, Life Builder profile copy, and a copy button for official contact email `aiASAP@pm.me`.
  - Social profile copy now pushes the durable doctrine: `aiASAP is a Life Builder. Take the Leap with 6 and build a better life...`
  - Social CENTCOM still uses approved v12 artwork under `public/social-artwork/v12/`.
  - Opened desktop browser to Social CENTCOM and YouTube Studio; opened Explorer selecting the approved YouTube banner `public/social-artwork/v12/youtube-banner-2560x1440.png`.
- Current preview only, not production/domain:
  - Deployment `dpl_7fYMNtLnrYLxW2xvJCdMa1H8hEPd`.
  - Preview URL `https://ai-asap-7j1e8l47i-team-dietz.vercel.app`.
  - Social CENTCOM: `https://ai-asap-7j1e8l47i-team-dietz.vercel.app/social`.
  - Local desktop page verified and opened: `http://127.0.0.1:3004/social`.
  - `http://127.0.0.1:3003/social` later returned a local `500`; treat 3003 as stale/unreliable unless restarted cleanly.
  - Normal browser access to the preview may show Vercel Authentication; `vercel curl` works for protected-preview verification.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check` passed with only normal Windows CRLF warnings.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-7j1e8l47i-team-dietz.vercel.app` returned the updated page and confirmed `Install console`, `Life Builder`, `aiASAP@pm.me`, and the required platform order.
  - Local `http://127.0.0.1:3004/social` returned `200` and included `Install console`, `Life Builder`, and `aiASAP@pm.me`.
- Browser note:
  - Browser Use in-app automation failed with `failed to start codex app-server: The system cannot find the path specified. (os error 3)`.
  - Use desktop browser fallback unless the in-app browser plugin starts working again.
- Next move:
  - Start with YouTube Studio. Use:
    - Profile picture: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\aiasap-6-profile-master-1024.png`
    - Banner: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\youtube-banner-2560x1440.png`
    - Watermark: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\youtube-watermark-150.png`
  - If login, channel selection, upload dialogs, or final publish/save screens appear, G must take or approve that account-owner step, then Codex can continue with the next platform.

## Dad Break / Social Install Handoff - 2026-05-04 11:55 AM ET

Critical override from G on 2026-05-04:

- Never change aiASAP copy, UI, branding, layout, behavior, prompts, social assets, deploy/smoke flow, or adjacent files unless G and the assistant have discussed that exact change first.
- Do only the requested change. If a related change seems necessary, stop and ask before editing.
- This specifically protects the hard-coded intro, Terms/footer line, branding colors, prompt labels, sticky-note/list behavior, Comet-only browser rule, no-Telegram-unless-asked rule, and preview-only/no-aiasap.ai rule.

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Dad Break / Social Install Handoff - 2026-05-04 11:55 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork v12 is approved and Social CENTCOM has the install console. Continue installing/preparing social artwork in order X, YouTube, TikTok, Facebook, Instagram, Threads, but stop for platform login/account-owner prompts and final save/publish confirmations. Latest preview is https://ai-asap-7j1e8l47i-team-dietz.vercel.app, deployment dpl_7fYMNtLnrYLxW2xvJCdMa1H8hEPd. Local desktop page is http://127.0.0.1:3004/social; port 3003 is stale/500. sup means Supabase only; ss means Supabase plus screenshots.
```

- Current working state:
  - Latest Social CENTCOM install console is in `src/components/SocialPostingHub.tsx`.
  - Approved artwork kit remains `public/social-artwork/v12/`.
  - Approved install pack remains `/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip`.
  - Official email is `aiASAP@pm.me` exactly.
  - Core brand/product doctrine: `Take the Leap` is the brand line; `aiASAP is a Life Builder` is the product truth.
  - Platform order everywhere: X, YouTube, TikTok, Facebook, Instagram, Threads.
- Current links:
  - Local desktop Social CENTCOM: `http://127.0.0.1:3004/social`.
  - Vercel preview Social CENTCOM: `https://ai-asap-7j1e8l47i-team-dietz.vercel.app/social`.
  - Vercel preview is protected in normal browser but verified by `vercel curl`.
- Current verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check` passed with only Windows CRLF warnings.
  - `npm.cmd run build` passed.
  - Vercel preview build passed.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-7j1e8l47i-team-dietz.vercel.app` verified install-console content.
  - `npx.cmd vercel logs https://ai-asap-7j1e8l47i-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
  - Clean local dev server is running on `3004`; `3003` should not be trusted until restarted.
- Current desktop/user-action state:
  - Desktop browser was opened to `http://127.0.0.1:3004/social`.
  - YouTube Studio was opened.
  - Explorer was opened to the v12 artwork folder with `youtube-banner-2560x1440.png` selected.
  - Clipboard was set to `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\youtube-banner-2560x1440.png`.
- Next move:
  - Continue with YouTube first if G is ready.
  - YouTube assets:
    - Profile picture: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\aiasap-6-profile-master-1024.png`
    - Banner: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\youtube-banner-2560x1440.png`
    - Watermark: `C:\Users\sgdie\Dropbox\Codex\aiASAP\public\social-artwork\v12\youtube-watermark-150.png`
  - If G wants to continue socials, guide/upload one platform at a time in the required order, asking only when platform login/account-owner action/final save is required.

## Relationship Conflict Honesty CW Update - 2026-05-04 10:39 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Relationship Conflict Honesty CW Update - 2026-05-04 10:39 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Latest preview is https://ai-asap-ko7yjo92m-team-dietz.vercel.app, deployment dpl_9KBMjWfvFLSRsH28tHs6Zfpow62B. Relationship conflict help starts with honesty: 6 can help users repair relationships with spouses, parents, friends, family, coworkers, or anyone else, but he should tell them they must be absolutely honest, including their own part. sup means Supabase only; ss means Supabase plus screenshots.
```

- G said users who are fighting with a spouse, parent, friend, or anyone in their lives should be able to talk to 6; 6 should say he needs the truth and absolute honesty to help, then help them build a better relationship with that person or everyone in their lives.
- Action taken:
  - `tools/update_liveavatar_context.py` now teaches LiveAvatar that relationship conflict help is broader than dating, starts with absolute honesty, and focuses on facts, feelings, assumptions, ownership, boundaries, apologies where appropriate, and the next respectful conversation.
  - `src/components/LiveAvatarSession.tsx` and `app/api/prompt-brain/route.ts` now detect fighting/arguing/conflict with spouse, parent, child, friend, family, coworker, neighbor, boyfriend, girlfriend, etc. and return relationship-repair idea boxes: `Be Fully Honest`, `Pick One Person`, `Own Your Part`, `Plan Better Talk`.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` now records the same relationship-conflict/honesty doctrine and safety boundary.
- Safety boundary stays intact: no psychotherapy, couples therapy, diagnosis, crisis counseling, trauma processing, or professional relationship counseling; danger, abuse, threats, coercive control, violence, self-harm, or unsafe-home situations redirect to safety/emergency/local professional help.
- Current preview only, not production/domain:
  - Deployment `dpl_9KBMjWfvFLSRsH28tHs6Zfpow62B`.
  - Preview URL `https://ai-asap-ko7yjo92m-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.
- Latest verification:
  - LiveAvatar context update succeeded with code `1000`.
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts tools/update_liveavatar_context.py` passed with only normal Windows CRLF warnings.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` trailing-whitespace scan passed.
  - Local `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-ko7yjo92m-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-ko7yjo92m-team-dietz.vercel.app -- --head` returned `200`.
  - Preview prompt-brain POST for `I am fighting with my wife and need help fixing the relationship` returned `["Be Fully Honest","Pick One Person","Own Your Part","Plan Better Talk"]`.
  - `npx.cmd vercel logs https://ai-asap-ko7yjo92m-team-dietz.vercel.app --no-follow --level error --since 2m` found no logs.
- No production touch. No Telegram.

## Approved Social Artwork Install Pass - 2026-05-04 10:46 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Approved Social Artwork Install Pass - 2026-05-04 10:46 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. G approved the exact v12 social artwork. Latest preview is https://ai-asap-jhd558ule-team-dietz.vercel.app, deployment dpl_7spQ1AAxVb3pbN9mkzbFdPbsENtd. Social CENTCOM is https://ai-asap-jhd558ule-team-dietz.vercel.app/social. Approved install pack is https://ai-asap-jhd558ule-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip. sup means Supabase only; ss means Supabase plus screenshots.
```

- G approved all v12 artwork and said to install everything.
- Action taken:
  - `src/components/SocialPostingHub.tsx` now marks the v12 artwork kit as `G approved`, changes copy from draft-review language to approved install-kit language, adds an `Open install pack` link, and adds a `Copy pack link` button.
  - `public/social-artwork/v12/manifest.json` now records `approval_status: G approved exact v12 artwork for installation on 2026-05-04`, `approved_at: 2026-05-04T10:43:42-04:00`, and the approved install package path.
  - Created `public/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip` containing all approved v12 PNG files plus `manifest.json`.
  - `app/layout.tsx` now uses the approved v12 profile artwork for app icons/apple icon and the approved v12 YouTube thumbnail for Open Graph/Twitter preview metadata.
- Platform account caveat:
  - This pass installed the approved kit inside aiASAP preview/Social CENTCOM and the website metadata. It did not upload profile images/banners to X, YouTube, TikTok, Facebook, Instagram, or Threads because those provider accounts are not connected/upload-capable through this preview yet.
  - `/api/social/status` on the preview returned `Forbidden`, so platform-account installation still needs account auth/provider setup.
- Current preview only, not production/domain:
  - Deployment `dpl_7spQ1AAxVb3pbN9mkzbFdPbsENtd`.
  - Preview URL `https://ai-asap-jhd558ule-team-dietz.vercel.app`.
  - Social CENTCOM `https://ai-asap-jhd558ule-team-dietz.vercel.app/social`.
  - Proof sheet `https://ai-asap-jhd558ule-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png`.
  - Approved install pack `https://ai-asap-jhd558ule-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip`.
  - Manifest `https://ai-asap-jhd558ule-team-dietz.vercel.app/social-artwork/v12/manifest.json`.
  - `aiasap.ai` was not touched.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/SocialPostingHub.tsx app/layout.tsx public/social-artwork/v12/manifest.json public/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip` passed with only normal Windows CRLF warnings.
  - ZIP inspection found 21 entries.
  - Local `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-jhd558ule-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-jhd558ule-team-dietz.vercel.app -- --head` returned `200`.
  - Install pack HEAD returned `200`, `Content-Type: application/zip`, and `Content-Length: 10052281`.
  - Manifest on the preview showed the approved status and install package.
  - Root HTML contains the approved v12 icon and Open Graph image paths.
  - `/social` HTML contains `G approved`, `Open install pack`, `Copy pack link`, and the install-pack filename.
  - Proof sheet HEAD returned `200`.
  - `npx.cmd vercel logs https://ai-asap-jhd558ule-team-dietz.vercel.app --no-follow --level error --since 2m` found no logs.
- No production touch. No Telegram. No actual social-profile upload yet because provider account auth/setup is still required.

## Life Builder Brand Doctrine Pass - 2026-05-04 10:53 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Life Builder Brand Doctrine Pass - 2026-05-04 10:53 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. aiASAP is a Life Builder at its core; Take the Leap stays the brand line, Life Builder is the product truth. Latest preview is https://ai-asap-k93rycpor-team-dietz.vercel.app, deployment dpl_22rMBPJSyvK9NkemvQsuxxKqDPvH. sup means Supabase only; ss means Supabase plus screenshots.
```

- G said aiASAP is also a Life Builder, at its core, and that this should be pushed hard everywhere appropriate.
- Action taken:
  - `tools/update_liveavatar_context.py` now says aiASAP is a Life Builder at its core, under the `Take the Leap` brand line, and that 6 should explain this when users ask what aiASAP is or why `Build a Better Life` is the lead idea box.
  - LiveAvatar context push succeeded with code `1000`.
  - `src/components/LiveAvatarSession.tsx` now recognizes `life builder`, `life building`, `build my life`, and `build your life` as the better-life lane. The `Build a Better Life` starter now says this is the core of aiASAP: a Life Builder.
  - `app/api/prompt-brain/route.ts` now recognizes the same Life Builder phrases and tells prompt-brain that aiASAP is a Life Builder at its core; `Build a Better Life` is the broad Life Builder lane.
  - `app/layout.tsx` metadata now uses `aiASAP Life Builder` and the description `aiASAP is a Life Builder. Take the Leap with 6 and build a better life.`
  - `src/components/SocialPostingHub.tsx` now leads with `Life Builder content, approved once, ready everywhere.` and says aiASAP is a Life Builder at its core.
  - `public/social-artwork/v12/manifest.json` now includes the approved rule: `Core brand rule: aiASAP is a Life Builder. Take the Leap is the brand line; Life Builder is the product truth.`
  - Rebuilt `public/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip` so the manifest inside the approved install package carries the Life Builder rule.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` now records the core product truth and says `Build a Better Life` is the main Life Builder entry point.
- Current preview only, not production/domain:
  - Deployment `dpl_22rMBPJSyvK9NkemvQsuxxKqDPvH`.
  - Preview URL `https://ai-asap-k93rycpor-team-dietz.vercel.app`.
  - Social CENTCOM `https://ai-asap-k93rycpor-team-dietz.vercel.app/social`.
  - Manifest `https://ai-asap-k93rycpor-team-dietz.vercel.app/social-artwork/v12/manifest.json`.
  - Approved install pack `https://ai-asap-k93rycpor-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip`.
  - `aiasap.ai` was not touched.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts tools/update_liveavatar_context.py src/components/SocialPostingHub.tsx app/layout.tsx public/social-artwork/v12/manifest.json public/social-artwork/v12/aiasap-social-artwork-v12-approved-install-pack.zip` passed with only normal Windows CRLF warnings.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md` trailing-whitespace scan passed.
  - Local `npm.cmd run build` compiled and generated static pages, then hit the known Dropbox `.next\export` cleanup lock.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-k93rycpor-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - Root HTML contains `aiASAP Life Builder`, `aiASAP is a Life Builder`, and `build a better life`.
  - `/social` HTML contains `Life Builder content, approved once, ready everywhere`, `aiASAP is a Life Builder at its core`, and `G approved`.
  - Preview prompt-brain POST for `aiASAP is a life builder and I want to build my life` returned `["Set/Track Life Goals","Fix One Problem","Make Action Plan","Make More Money"]`.
  - Preview manifest contains the Life Builder approved rule.
  - Install pack HEAD returned `200`, `Content-Type: application/zip`, and `Content-Length: 10052339`.
  - `npx.cmd vercel logs https://ai-asap-k93rycpor-team-dietz.vercel.app --no-follow --level error --since 2m` found no logs.
- No production touch. No Telegram.

## Prompt Pill / CW Doctrine Update - 2026-05-04 10:31 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Prompt Pill / CW Doctrine Update - 2026-05-04 10:31 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Latest preview is https://ai-asap-a3n10s0dt-team-dietz.vercel.app, deployment dpl_JE8pzAnDqbrp8AxRVbuB7jhuvQi3. Prompt top four are Build a Better Life, Build Relationships/Friends, Build Your Socials, Create a Shopping List. Set/Track Life Goals belongs in the rotating larger list, not the top four. sup means Supabase only; ss means Supabase plus screenshots.
```

- G updated the general-use idea-box doctrine:
  - Fixed initial top four, exact order: `Build a Better Life`, `Build Relationships/Friends`, `Build Your Socials`, `Create a Shopping List`.
  - Larger rotating list: `Make More Money`, `Find Your Life Partner`, `Build a Business`, `Build Your Brand`, `Market Yourself`, `Create a To Do List`, `Plan Your Weekend`, `Market Your Product`, `Market Your Service`, `Next Vacation Ideas`, `Set/Track Life Goals`.
  - `Set/Track Life Goals` is explicitly not top-four; it belongs in the larger rotating list.
- Action taken:
  - `src/components/LiveAvatarSession.tsx` now uses the approved top four as the initial pill prompts and preserves that exact top-four order despite the usual anti-build-stacking helper.
  - Added prompt logic/aliases for `Build Relationships/Friends`, `Find Your Life Partner`, `Build Your Brand`, `Market Yourself`, `Create a Shopping List`, `Create a To Do List`, and `Set/Track Life Goals`.
  - `app/api/prompt-brain/route.ts` now uses the same fallback feed and current system prompt.
  - `tools/update_liveavatar_context.py` now carries the same CW doctrine, and LiveAvatar context update succeeded with code `1000`.
  - `C:\Users\sgdie\Dropbox\Codex\aiASAP_MVP_MISSION_GUIDE.md`, `PROJECT_MEMORY.md`, and `STICKY_REBOOT_RULES.txt` record the new rule.
- Current preview only, not production/domain:
  - Deployment `dpl_JE8pzAnDqbrp8AxRVbuB7jhuvQi3`.
  - Preview URL `https://ai-asap-a3n10s0dt-team-dietz.vercel.app`.
  - `aiasap.ai` was not touched.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/LiveAvatarSession.tsx app/api/prompt-brain/route.ts tools/update_liveavatar_context.py AIASAP_REBOOT_HANDOFF.md PROJECT_MEMORY.md STICKY_REBOOT_RULES.txt` passed with only normal Windows CRLF warnings.
  - `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-a3n10s0dt-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl / --deployment https://ai-asap-a3n10s0dt-team-dietz.vercel.app -- --head` returned `200`.
  - Preview `/api/prompt-brain` POST with empty context returned the approved top four.
  - Preview `/api/prompt-brain` POST for brand context returned `Build Your Brand`, `Market Yourself`, `Make More Money`, `Build a Better Life`.
  - Final tight Vercel preview error-log check found no logs. Earlier error logs were from malformed PowerShell JSON smoke attempts before switching to temp-file JSON bodies.
- No production touch. No Telegram. No social upload.
- Next move: ask G to review v8 and give exact likes/dislikes. If changes are needed, make v9 proof first.

## Social Artwork v11 Big-6 Preview - 2026-05-04 9:58 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social Artwork v11 Big-6 Preview - 2026-05-04 9:58 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork is draft-only until I approve exact files. Latest preview is https://ai-asap-8b1xpt8oo-team-dietz.vercel.app, deployment dpl_A562ghzPhcGpPsbakmQJ2qotBTBL. Local review server was http://127.0.0.1:3004. sup means Supabase only; ss means Supabase plus screenshots.
```

- Current lane/posture:
  - Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP`.
  - Stay in Codex aiASAP lane only and preserve the dirty worktree.
  - Work in Vercel previews only. Do not deploy, promote, alias, or otherwise write to `https://aiasap.ai` unless G explicitly gives permission for that exact domain move.
  - No Telegram links/smokes for this artwork review unless G asks. Use desktop links.
  - All artwork remains draft-only until G approves exact files. Do not upload profile images, banners, covers, thumbnails, or post templates to socials yet.
- Current artwork draft:
  - Version `v11` under `public/social-artwork/v11/`.
  - Proof sheet: `public/social-artwork/v11/aiasap-social-artwork-v11-proof-sheet.png`.
  - Social CENTCOM route points to v11.
  - v9 is bad/contaminated and should not be used.
- Current preview only, not production/domain:
  - Deployment `dpl_A562ghzPhcGpPsbakmQJ2qotBTBL`.
  - Preview URL `https://ai-asap-8b1xpt8oo-team-dietz.vercel.app`.
  - Social CENTCOM: `https://ai-asap-8b1xpt8oo-team-dietz.vercel.app/social`.
  - Proof PNG: `https://ai-asap-8b1xpt8oo-team-dietz.vercel.app/social-artwork/v11/aiasap-social-artwork-v11-proof-sheet.png`.
  - Local desktop review server: `http://127.0.0.1:3004/social` and `http://127.0.0.1:3004/social-artwork/v11/aiasap-social-artwork-v11-proof-sheet.png`.
  - `aiasap.ai` was not touched.
- v11 artwork rules from G:
  - Use the real mobile website `aiASAP` font styling from `app/globals.css`, not a screenshot scan.
  - Use the approved no-ring/no-inner-circle HeadShot profile crop copied forward from v10/v8.
  - With banners/covers, 6 should be much bigger and focused mostly on his face/upper torso.
  - Keep approved C tone redness reduction so 6 looks naturally tan, not red.
  - Remove teal/tan separator bars, decorative accent lines, strong yellow rings, inner profile circles, and screenshot-edge blue/gray bars.
  - Use the soft-brown/black-edge palette, not a hot yellow center.
  - Official email stays `aiASAP@pm.me` exactly.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/SocialPostingHub.tsx tools/generate_social_artwork_v11.py public/social-artwork/v11` passed with only normal Windows CRLF warning.
  - Local `/social` and v11 proof PNG returned HTTP `200` on `127.0.0.1:3004`.
  - Local `npm.cmd run build` passed after clearing only generated `.next\export` inside the aiASAP workspace for the known Dropbox lock.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-8b1xpt8oo-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-8b1xpt8oo-team-dietz.vercel.app -- --head` returned `200`.
  - `npx.cmd vercel curl /social-artwork/v11/aiasap-social-artwork-v11-proof-sheet.png --deployment https://ai-asap-8b1xpt8oo-team-dietz.vercel.app -- --head` returned `200`.
  - `npx.cmd vercel logs https://ai-asap-8b1xpt8oo-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
- Next move:
  - Ask G to review v11 and call out exact likes/dislikes. If changes are needed, create another proof version first. Do not upload to socials until he approves exact files.

## Social Artwork v12 Stronger Italic Preview - 2026-05-04 10:05 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social Artwork v12 Stronger Italic Preview - 2026-05-04 10:05 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork is draft-only until I approve exact files. Latest preview is https://ai-asap-lcbptiwd7-team-dietz.vercel.app, deployment dpl_4CC8Uqm6pXwEEWVXfesnUVa4wXwh. Local review server was http://127.0.0.1:3004. sup means Supabase only; ss means Supabase plus screenshots.
```

- G said the v11 `aiASAP` wordmark did not look italicized enough and should have more lean like the mobile reference.
- Action taken:
  - Created `public/social-artwork/v12/`.
  - Created `tools/generate_social_artwork_v12.py` from the v11 generator with a stronger synthetic mobile-style italic lean on the `aiASAP` mark.
  - Kept the same approved profile crop and bigger face-focused 6 banner/cover composition from v11.
  - Updated `src/components/SocialPostingHub.tsx` to point to v12.
- Current preview only, not production/domain:
  - Deployment `dpl_4CC8Uqm6pXwEEWVXfesnUVa4wXwh`.
  - Preview URL `https://ai-asap-lcbptiwd7-team-dietz.vercel.app`.
  - Social CENTCOM: `https://ai-asap-lcbptiwd7-team-dietz.vercel.app/social`.
  - Proof PNG: `https://ai-asap-lcbptiwd7-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png`.
  - Local desktop review server: `http://127.0.0.1:3004/social` and `http://127.0.0.1:3004/social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png`.
  - `aiasap.ai` was not touched.
- v12 artwork rules still active:
  - Use the real mobile website `aiASAP` font styling direction, not a screenshot scan.
  - The `aiASAP` mark now has stronger right-lean to better match the mobile browser look.
  - Use the approved no-ring/no-inner-circle HeadShot profile crop.
  - With banners/covers, 6 should be much bigger and focused mostly on his face/upper torso.
  - Keep approved C tone redness reduction, soft-brown/black-edge palette, no teal/tan bars, no decorative accent lines, no strong yellow ring, and no inner profile circle.
  - Official email stays `aiASAP@pm.me` exactly.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/SocialPostingHub.tsx tools/generate_social_artwork_v12.py public/social-artwork/v12` passed with only normal Windows CRLF warning.
  - Local `/social` and v12 proof PNG returned HTTP `200` on `127.0.0.1:3004`.
  - Local `npm.cmd run build` passed after clearing only generated `.next\export` inside the aiASAP workspace for the known Dropbox lock.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-lcbptiwd7-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-lcbptiwd7-team-dietz.vercel.app -- --head` returned `200`.
  - `npx.cmd vercel curl /social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png --deployment https://ai-asap-lcbptiwd7-team-dietz.vercel.app -- --head` returned `200`.
  - `npx.cmd vercel logs https://ai-asap-lcbptiwd7-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
- No production touch. No Telegram. No social upload.
- Next move:
  - Ask G to review v12 wordmark lean. If it still needs more lean, create another proof version first. Do not upload to socials until he approves exact files.

## Social CENTCOM Platform Order Pass - 2026-05-04 10:14 AM ET

Paste this to resume:

```text
Resume aiASAP from AIASAP_REBOOT_HANDOFF.md section "Social CENTCOM Platform Order Pass - 2026-05-04 10:14 AM ET". Stay in Codex aiASAP lane. Preserve the dirty worktree. Work in Vercel previews only; do not touch or promote aiasap.ai unless I explicitly say so. No Telegram unless I ask. Social artwork is draft-only until I approve exact files. Latest preview is https://ai-asap-d6naxg20o-team-dietz.vercel.app, deployment dpl_4ozGiSwKsbqx19iR9iD7edQX7rm1. Local review server was http://127.0.0.1:3004. sup means Supabase only; ss means Supabase plus screenshots.
```

- G said the order must be `X, YouTube, TikTok, Facebook, Instagram, Threads` everywhere.
- Action taken:
  - `src/components/SocialPostingHub.tsx` now centralizes that order and uses it for platform cards, selected draft buttons, draft platform labels, header copy, artwork spec cards, artwork asset cards, and setup callback cards.
  - `src/lib/socialPosting.ts` now keeps parsed draft platform arrays in that same order, and Meta OAuth writes `facebook` before `instagram`.
  - `tools/generate_social_artwork_v12.py` now lists/generates proof-sheet and manifest assets in that same platform order.
  - Rebuilt `public/social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png` and manifest with the ordered assets; artwork visuals did not otherwise change.
- Current preview only, not production/domain:
  - Deployment `dpl_4ozGiSwKsbqx19iR9iD7edQX7rm1`.
  - Preview URL `https://ai-asap-d6naxg20o-team-dietz.vercel.app`.
  - Social CENTCOM: `https://ai-asap-d6naxg20o-team-dietz.vercel.app/social`.
  - Proof PNG: `https://ai-asap-d6naxg20o-team-dietz.vercel.app/social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png`.
  - `aiasap.ai` was not touched.
- Latest verification:
  - `npm.cmd run typecheck` passed.
  - `git diff --check -- src/components/SocialPostingHub.tsx src/lib/socialPosting.ts tools/generate_social_artwork_v12.py public/social-artwork/v12` passed with only normal Windows CRLF warning.
  - Local `/social` and v12 proof PNG returned HTTP `200` on `127.0.0.1:3004`.
  - Local `npm.cmd run build` passed.
  - Vercel remote preview build passed.
  - `npx.cmd vercel inspect https://ai-asap-d6naxg20o-team-dietz.vercel.app` showed target `preview`, status `Ready`.
  - `npx.cmd vercel curl /social --deployment https://ai-asap-d6naxg20o-team-dietz.vercel.app -- --head` returned `200`.
  - `npx.cmd vercel curl /social-artwork/v12/aiasap-social-artwork-v12-proof-sheet.png --deployment https://ai-asap-d6naxg20o-team-dietz.vercel.app -- --head` returned `200`.
  - Deployed HTML check found `X, YouTube, TikTok, Facebook, Instagram, and Threads` and asset paths in the required order.
  - `npx.cmd vercel logs https://ai-asap-d6naxg20o-team-dietz.vercel.app --no-follow --level error --since 10m` found no logs.
- No production touch. No Telegram. No social upload.
