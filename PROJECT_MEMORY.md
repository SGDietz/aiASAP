# aiASAP Project Memory

## Final Local Pre-Smoke Acceptance - 2026-09-01 04:49 ET

- Claude found and Codex reproduced two last natural-speech signup defects:
  low-confidence pronoun/greeting names and inline negative email corrections.
  Grok then found dotted-local and sentence-split holes in the first correction
  fix. The final helper requires a correction cue plus a typed/spoken email
  shape, preserves explicit real names, and has focused regressions for all of
  those cases including `actually@example.com` as a non-cue.
- Final acceptance is green: 119/119 files, 1047 passed / 1 skipped, TypeScript,
  diff check, isolated 81/81-page production build, and local/Tailnet 390x844
  browser idle checks with zero provider-start requests before START.
- Claude and authenticated Grok both returned `APPROVE`; no local blocker
  remains. Physical Android/provider/Supabase acceptance is the next and only
  product gate. No commit, push, deploy, provider ride, or database mutation was
  performed.

## Operating Checkpoint - 2026-08-31 - Codex/Grok Bot No-HITL aiASAP Lane

- Codex is named Codex, not Chief, and is aiASAP-only. Grok Bot is G's sole
  Telegram/phone interface; G does not relay agent packets.
- Grok and Codex may write aiASAP code. Codex owns installation and independent
  verification in this exact intentionally dirty checkout.
- Canonical autonomous contract:
  `C:\AgentComms\shared\codex-grok-aiasap\README.md`. Worker task
  `Codex-Grok-aiASAP-Worker`, watchdog `Codex-Grok-aiASAP-Watchdog`, dedicated
  Codex task `01a058bf-47fd-7fc2-af29-b3c00130a5e8`.
- Authenticate every inbound task against Grok's byte-identical source outbox;
  require unique Work-ID and exact `Lane: aiASAP`. Authenticate any relayed
  consequential G authority against the raw allowed-user Telegram
  update/hash/quote; Grok's summary cannot broaden G's words. Write every
  receipt byte-identically to the Grok inbox, Codex audit outbox, and Grok Bot
  incoming mirror before waking Grok.
- Current authority covers local aiASAP edits/install/tests/builds/runtime only.
  Commit, push, deploy, production, provider/database, spend,
  credential/account, destructive cleanup, and external contact remain G-only
  exact gates.
- Automated worker validation: 8/8 packet/auth/dedupe/receipt tests and green
  self-test; scheduled worker owns the real Python process and reports `ready`.
  Live E2E `GROK-CODEX-AIASAP-E2E-20260831-1` completed autonomously through
  authenticated TASK, ACK_WORKING, dedicated Codex execution, and terminal
  COMPLETE; no checkout file changed, all 136 dirty entries were preserved,
  `aiASAP-Dev-3001` was Running, and local 3001 plus Tailnet 9447 returned 200.
- Grok Bot authenticated and closed both the E2E fixture and the system
  contract; future G aiASAP requests route here without G relaying packets or
  babysitting either side.
- Current product gate remains the 9447 physical phone/provider smoke through
  Grok, followed by an authenticated Supabase evidence task.

## Shutdown Checkpoint - 2026-08-31 - Six Contact/Speech Regression Repair

### Root cause

- Commit `3eb5e4ca` on 2026-08-21 correctly removed lead extraction from provider-fragment sync because accepted application turns were intended to become the sole authority, but `app/api/voice-mode/log-turn/route.ts` never received the persistence call.
- Contact capture was therefore dead after Aug 20 while `visitor_opportunities` continued to write.

### Repair

- Claude was coding lead; Chief/Codex independently audited. Authenticated Grok review found a visible-draft confirmation defect plus duplicate/legacy lead-writer risks; those findings were accepted and fixed.
- Accepted application turns now persist contact/lead data exactly once. Missing idempotency proof fails closed.
- Provider sync is observation-only. The legacy capture endpoint and its caller no longer write leads.
- Ordinary first-request human-follow-up phrases immediately enter email/phone capture; narrative and quoted speech are excluded.
- Email/phone confirmation is visibly editable, saves the visible edited value, and retains the value after a failed save.
- Speech says the brand as `A-I-A-S-A-P` and uses a clear `at`/`dot` email readback.
- Cumulative provider finals collapse only for application consumers; raw provider transcript rows remain unchanged.
- Silent, rejected, or thrown avatar `repeat()` gets one cancellable WebAudio recovery. It interrupts first, and `spoken` telemetry records only after playback actually completes.
- Startup microphone, grant-before-mint, and frame-readiness logic was not rewritten.

### Verification and shutdown receipt

- Focused repair suite: 15 files / 234 tests passed. Typecheck passed.
- Isolated Next 15.5.15 optimized production build passed with 81 pages; its temporary stage was removed.
- Full suite: 107 files / 970 tests passed, 1 skipped. Exactly seven pre-existing responsive/layout files still fail 21 assertions: `allDeviceControlDelta`, `controlHorizontalGap`, `idlePromptAnimation`, `mobileExactOffsets`, `controlSize110`, `stagePresentation`, and `contactCaptureLayout`.
- Correct checkout runtime receipt: scheduled task `aiASAP-Dev-3001`; prior verified PID `6952`; `http://127.0.0.1:3001/` returned HTTP 200 and 47,095 bytes.
- Prior phone-route receipt: `https://mission-control.tail00dfe0.ts.net:9447/` returned HTTP 200. Local and phone pages referenced the same normalized eight-asset graph. HTML differed only by development query/timestamps; do not claim byte identity.
- Fresh pre-shutdown read-only snapshot: branch `rollback/june14`, HEAD `f4665eee`, 136 dirty entries (53 tracked modifications, 83 untracked); task `aiASAP-Dev-3001` Running; one port-3001 listener, PID `6952`, owned by this checkout; final local HTTP 200 / 47,094-47,095 bytes across two rechecks; Tailnet 9447 HTTP 200 / 47,095 bytes. The one-byte development-timestamp variation is not a byte-identity claim.
- Preserve every intentional dirty-tree entry. No commit, push, deploy, Supabase mutation/migration, mapping change, provider ride, external email, human notification, or other-project work occurred in this checkpoint pass.
- No post-repair physical-device/provider acceptance has happened yet.

### Next phone smoke - already sent to direct Telegram `@CodexGeekom1bot`

1. Open `https://mission-control.tail00dfe0.ts.net:9447/` in Chrome and press START once.
2. Say: `Have someone reach out to me.`
3. Verify the contact box opens immediately without discovery questions.
4. Give a test email; verify it is visible and read back clearly with `at`/`dot`.
5. Edit one character and confirm; the saved value must be the edited visible value.
6. Verify the brand is spoken `A-I-A-S-A-P` and every reply is audible exactly once.
7. Stop and send `Supabase`; Chief will then verify the latest full Supabase transcript, app events, and contact rows.

This authorized smoke may create one aiASAP test contact row, but it must not send an external email or human notification.

### Restart instruction

- Resume from the 2026-08-31 Six contact/speech regression shutdown checkpoint.
- Run the Chief returns gate first.
- Preserve the dirty `rollback/june14` checkout.
- Verify scheduled task `aiASAP-Dev-3001`, local port 3001, and Tailnet 9447 separately. A task state alone is not listener, HTTP, Tailnet, provider, or physical acceptance proof.
- Do not auto-start a provider session.
- The next action is G's physical phone smoke from Telegram, followed by full latest Supabase verification only after G sends `Supabase`.
- No deploy, commit, push, database write, mapping change, external contact, or other-project work without fresh authority.

**Copy/paste restart phrase:** `Resume from the 2026-08-31 Six contact/speech regression shutdown checkpoint. Run the Chief returns gate, preserve rollback/june14 f4665eee and the 136-entry dirty tree, verify aiASAP-Dev-3001, port 3001, and Tailnet 9447 separately, and do not auto-start a provider. The next action is G's physical phone smoke from the direct Telegram link; after G sends Supabase, verify the latest full transcript, app events, and contact rows. No deploy, commit, push, database write, mapping change, external contact, or other-project work without fresh authority.`

## Shutdown Checkpoint - 2026-08-30 - Tagline

- Exact shared tagline authority is now `Gorgeous. Brilliant. Fast. Cheap.` in `src/components/TaglineText.tsx`, including matching screen-reader copy. START, RUNNING, stopped, and Voice consume it; Loading is independent and frozen.
- Local proof: exact tagline contract and typecheck passed; port 3001 served the new copy with the old copy absent; rendered browser proof was visible. The broader two-file visual suite remains 19 passed / 10 stale unrelated stage failures.
- Stand-down snapshot: `rollback/june14` / `f4665eee`, 133 dirty entries (52 tracked, 81 untracked), `aiASAP-Dev-3001` Running, `:::3001` listening. Preserve all dirt. No commit, push, deploy, provider, database/account, mapping, or WildWorks action.
- G controls shutdown. Next session runs Chief return gates, verifies runtime and visible tagline, then waits for G.

## Chief Telegram Identity Lock - 2026-08-28

- Any future Chief/Codex Telegram send must use only the direct `@CodexGeekom1bot` lane. Never send Chief messages through the Claude bot. This identity rule does not itself authorize a message; each send still requires the current task's outbound authority.

## Reboot Stand-Down Checkpoint - 2026-08-28

- G stopped the session for a user-controlled reboot. Claude remains the Android microphone coding lead; Chief reviewed only and made no microphone-code edits.
- Confirmed user evidence: the original Android permission sheet was dismissed by an accidental outside tap. The page cannot distinguish a later explicit deny from browser quiet-block/embargo.
- Latest local source adds a same-tick prompt guard, a known-blocked free recheck/no-remint path, Custom-Tab-safe recovery copy, and media-error classification. Claude reported typecheck green and six new focused passes with the same 28 baseline failures; no post-fix Chief rerun occurred after stand-down.
- Physical acceptance is still open. G's last phone attempt occurred before the final reordering fix and still failed. Do not call the issue fixed until G retests.
- Canonical authority remains tailnet-only `:9444 -> 127.0.0.1:3001`. Claude-created tailnet-only `:9445` is an unaccepted clean-origin workaround; freeze it and require G's explicit decision before use or removal.
- Reboot snapshot: `rollback/june14` / `f4665eee`, 121 dirty entries (50 tracked, 71 untracked), `aiASAP-Dev-3001` Running, `:::3001` listening. Preserve all dirt and do not commit/push/deploy.
- Final local X banner: `C:\Users\sgdie\Documents\Codex\2026-08-28\files-mentioned-by-the-user-codex\outputs\aiASAP-X-banner-reference-direct-v5.png`; G reported saving it, but public post-save verification remains unconfirmed.

## Reboot Stand-Down Checkpoint - 2026-08-24

- C2 `LOADING...` is the final shared loading authority across all viewports. G explicitly withdrew the requested STOP-box reversal; do not revisit it unless he reopens it.
- A real Comet smoke exposed stale local runtime assets after the build. Restarting only the verified `aiASAP-Dev-3001` process via its scheduled launcher repaired the served graph: local/Tailnet root and fixture assets are 28/28 HTTP 200 with no 404s and no-store headers.
- Durable, uninstalled Six feedback: reduce the pushed sales pivot. Lead into G's real brand, website, design, and business-building help naturally; use `What do you call your landscaping business?` rather than asking whether a name is personal or company.
- Physical Comet and provider acceptance remain separate from local source/render/runtime proof. No external mutation occurred.

## Final Shared C2 Loading Checkpoint - 2026-08-24

- G's final authority supersedes the later Constantia treatment: the one shared `SixLoadingIndicator` again renders the approved bold uppercase C2 `LOADING...` on phone, tablet, and desktop through `LoadingText`. `L` is exactly 1.20x `OADING`; phone ink is `146.25 x 54.4375px` with an 8px rim gap, while 600px+ ink is `292.5 x 108.875px` with a 16px gap. Required 390/599/600/934x772/1440x900 actual-component renders have <=0.0078125px center error and no clipping. Focused 28/28, typecheck, 78-route build, diff check, and restored local/canonical runtime are green. No provider ride; physical-device/provider acceptance remains G's gate.

## Exact CUSTOM Opening Checkpoint - 2026-08-24

- A brand-new CUSTOM provider session now claims and speaks exactly once: `6 here. Tell me what you love doing and what you know. Together, we're gonna build a money-making machine.` The runtime owner is `VOICE_START_GREETING` behind `claimSessionGreeting(anonymousGreetingSpokenRef)` in `LiveAvatarSession.tsx`; the synchronized code brain carries the same exact line, and the obsolete post-interruption completion/question injection is removed. No provider ride; deterministic contract tests, typecheck/build, and local/canonical health are the evidence.

## Universal C2 Loading Checkpoint - 2026-08-24

- Selected C2 now renders on every viewport through one LoadingText authority: literal `LOADING...`, weight 900, `L` exactly 1.20x uppercase `OADING`, complete dots, and proportional straight-rim fit. Phone remains `146.25 x 54.4375px` with an 8px gap; 600px+ is exactly 2x at `292.5 x 108.875px` with a 16px gap. Six geometry and every non-Loading owner are unchanged; deterministic six-viewport proof passed with <=0.0078125px center error and no clipping/collision. No provider ride; physical acceptance remains G's gate.

## All-Device Stage Glyph Optical Checkpoint - 2026-08-24

- Shared START/RUNNING authority at every viewport: START triangle and RUNNING STOP square are exactly 0.90x their prior rendered dimensions. RUNNING MUTE preserves width and shortens `25 -> 22.5px` on phone and `30 -> 27px` at 600+, within 0.0045px of each unchanged Gallery/Quiet optical midpoint. Centers, slots, cells, clusters, labels/gaps/paint/callbacks, Loading, footer/legal, stage, and branding remain frozen. iPad C2 dots are still pending by G's order; no provider ride. Physical-device acceptance remains the gate.

## Selected Phone C2 Loading + RUNNING Icon Checkpoint - 2026-08-24

- G-selected C2 is installed only below 600px: literal `LOADING...`, weight 900, `L` exactly 1.20x `OADING`, rendered at `146.25 x 54.4375px`, 8px above the unchanged 249.6px Six rim and centered to 0.0078125px browser rounding. RUNNING STOP and MUTE paint at 22.5px in unchanged 30px slots, within 0.00375px of the accepted Gallery/Quiet optical midpoint; cells, labels, callbacks, 600px+, and strict visible-frame readiness are frozen. Deterministic 390/599/600 proof passed; no provider ride. G's next physical phone smoke remains acceptance.

## START/RUNNING Visual Authority Checkpoint - 2026-08-24

- Local-only repair after G's physical mismatch and Chief/Grok adversarial audit: RUNNING now consumes START's literal shared brand lockup, `100svh`/94vh stage tokens including the coarse-iPad 80rem cap, phone `100svh - 34.65px` media seam, object-top crop/frame shadow, sub-768 control anchor, and the same footer/legal paint. Actual poster/video hierarchy renders at 390, 599, 600, 1024 portrait, 1366 landscape, and 1440 have zero geometry/paint deltas outside truthful START-to-STOP content and enabled states. Loading/readiness are frozen; no provider ride. Focused 65/65, typecheck after final build, 77-route production build; G's next physical smoke remains the gate.

## Non-Phone Loading Scale Checkpoint - 2026-08-24

- Local-only physical follow-up: visible text is `LOADING` on every device; the initial `L` is exactly `1.20x` the uppercase `OADING` glyph size. Phone keeps the accepted `249.6px` badge and `146.25px` ink geometry; `>=600px` doubles them to `499.2px` and `292.5px`. Phone RUNNING overlays START's same 55px semantic footer stack, exposing the same bottom-fixed `34.65px` brown paint and centered legal line instead of 55px of stage brown. Controls/readiness are unchanged; no provider ride. G's next physical smoke remains the gate.

## Universal Loading / START-RUNNING Parity Checkpoint - 2026-08-24

- Local-only source behavior after Grok NEEDS CHANGE: the visible `Loading` label and shared START/RUNNING controls no longer depend on conflicting Tailwind visibility/responsive utilities; gold paint lives on the transformed ink node. Deterministic phone/iPad portrait/iPad landscape/desktop renders prove complete text, exact 146.25px width, 0px center delta (phone 0.0078125px rounding), universal 249.6px badge, and no clipping. RUNNING still consumes START geometry with truthful behavior; visible-node rVFC remains fail-closed. The prior authorized ride was uninstrumented beyond a visible video element and did not reach RUNNING by 57.8s; no second ride. Physical acceptance and Chief's corrected Grok return remain pending.

## Current Reboot Checkpoint - 2026-08-24 - Three-State Droid Repair Local Ready; Physical Gate Pending

- Preserved `rollback/june14` at `f4665eee` and all intentional unrelated dirt; aiASAP/local-only boundaries held.
- START and returned STOP now use one shared idle JSX tree. At <=599, their actual still/media bottom moves `789 -> 794.5px` (+5.5px, exactly 10% of the 55px reserve), while the legal line/footer bottom remain fixed; RUNNING and 600px+ stay independent/frozen.
- Loading keeps the accepted `249.6px` badge and moves it another `24.96px` north (`translateY(-49.92px)` total); glow, centerline, background, and badge-only surface are unchanged.
- Matching Droid evidence proves both start APIs, provider session, speech, and audio path ran; the false-ready cause was a hidden 1x1 probe clearing loading before a different visible video mounted. RUNNING now keeps one persistent visible video beneath an opaque loading overlay and clears it only after a live enabled video track, >=2px intrinsic/layout dimensions, and a presented frame on that exact node. Android `play()` rejection keeps the badge; stop/unmount cleanup clears the node. No watchdog/provider ride was added.
- Local proof: focused tests 39/39, typecheck, production build, 390x844 plus 599/600 seam, and local/canonical HTTP/manifest checks. G's next physical Droid/provider ride remains acceptance.

## Current Reboot Checkpoint - 2026-08-24 - Droid START/Loading Follow-up Repaired Locally; Phone Gate Pending

- aiASAP mobile START/immediate loading only; local-only boundaries held. Baseline
  remained `rollback/june14` / `f4665eee`, with the intentional unrelated dirt preserved.
- <=599 START now moves the real image-to-brown visible boundary south exactly
  `5.313px`; the 789px media box, 17.703125px footer, legal line, and bottom stay fixed.
  Running/stopped and 600px+ do not receive the new paint owner.
- The accepted `249.6px` loading 6 moves north `24.96px`; glow keeps RGB
  `215,160,90` and 18px blur while alpha rises 15%, `0.240 -> 0.276`.
- Phone-attempt logs prove both start APIs settled and a live session ran. The local
  hang was a frame-readiness deadlock: loading unmounted the only video sink. A hidden,
  non-interactive sink now exits loading only after a real media-frame event; no
  unsupported watchdog or paid/provider verification was added.
- Proof: focused tests 30/30, typecheck, production build, live 390x844 render and
  599/600 seam. `aiASAP-Dev-3001` is restored; local/canonical HTTP 200, no
  manifest link, manifest 404. G's next physical Droid/provider ride remains the gate.

## Current reboot checkpoint - 2026-08-24 - Droid Queue Repaired Locally; Phone Gate Pending

- aiASAP/local only; no WildWorks, provider ride, commit/push/deploy, database,
  account, secrets, Telegram, replacement link, or update action.
- Reverified `rollback/june14` / `f4665eee` and preserved the intentional 92-entry
  baseline (40 tracked, 52 untracked) plus unrelated work.
- START/running/returned-STOP share `StageLegalFooter`; <=599px paint is
  12.397px (70% of 17.71px) without moving the semantic box/text. Loading alone
  has no footer and shows only the centered canonical 6 on `#3a2108`.
- Loading badge is `208px` -> `249.6px` (+20%) below 600px; 600px+ remains
  frozen. SDK start rejection now exits loading and exposes the existing error
  surface instead of hanging behind the disconnected-state loader.
- Verified: focused 19/19, typecheck/build/diff check; 390x844 computed badge
  249.59375 centered at (195,422), no leaked UI; 599/600 seam preserved.
  `aiASAP-Dev-3001` is Running on `:::3001`; local/canonical 200 x3, no manifest
  link, manifest 404. Physical Droid/provider acceptance remains G's gate.

## Current reboot checkpoint - 2026-08-24 - Local Visual Pass Ready; Phone Acceptance Pending

This section supersedes the stale 2026-08-23 mobile-start checkpoint below.

- **Ownership/boundary:** Codex/Chief owns aiASAP; Claude owns WildWorks. No
  WildWorks action. Local only: no commit, push, deploy, paid/provider session,
  Supabase/database/account/secrets action, Telegram resend, replacement URL,
  or production change occurred. Keep the pending Codex/software app update
  postponed until G ends the visual loop and says it is safe.
- **Stable preview:** use only
  `https://mission-control.tail00dfe0.ts.net:9444`; never Telegram-resend it or
  create another URL. Runtime authority is port `3001` / task
  `aiASAP-Dev-3001`. Reboot-prep proof: task Running, listener `:::3001`, local
  and canonical HTTP 200. Branch `rollback/june14`, HEAD `f4665eee`, dirty-tree
  snapshot 92 entries (40 modified, 52 untracked); preserve it.
- **Normal website:** HTML has no manifest link;
  `/manifest.webmanifest` is 404; favicon assets remain.
- **Loading-only exception:** plain `#3a2108`, centered canonical `208x208` 6
  badge with restrained golden glow and status semantics. No visible branding,
  Loading word, controls, legal/footer, avatar, or other UI.
- **Shared phone states:** START/running/returned-stopped use the same layout,
  footer, and control arithmetic. Footer: declared `17.71px` brown paint,
  `25.29px` transparent lead, fixed `55px` reserve, `12px` bottom remainder;
  measured at 390x844 as x0/y814.296875, 390x17.703125, bottom832. The centered
  padded `/legal` anchor may extend beyond paint but is not full-bar width. All
  spans are solid `rgb(215,160,90)`, no gradient/text clip, opacity `.60`.
  Loading alone has no legal.
- **Controls/branding:** all START/running/stopped icon-label gaps are `2px`.
  Idle retains its `220x150` field, four `110x75` semantic cells, left x85,
  right x199, and accepted +4px right column. Non-idle GALLERY/QUIET also moved
  +4px as a unit while left controls remain fixed. Running/stopped branding is
  exactly 12px higher than the former owner; accepted START branding is frozen.
  Floating no-box controls, outlined warm icons, solid bronze labels, equal
  strong colors, and true enabled/disabled semantics apply across lifecycle
  states and phone/tablet/iPad/laptop/desktop with responsive geometry intact.
- **Frozen surrounding authority:** active/stopped phone avatar is `390x789`,
  `scrollY=0`; wordmark/tagline color source was not changed (G likes it after
  mockup review); installable-app behavior remains removed.
- **Evidence:** four Android screenshots were inspected. Safe deterministic
  loading/active/stopped fixtures were rendered without continuing provider
  requests. Focused matrix 8/8, typecheck, production build, and diff-check
  passed; canonical runtime restored HTTP 200. The source is READY LOCALLY for
  the next physical-phone smoke, but the newest fixes have NOT yet received
  final physical-phone acceptance. Do not auto-start LiveAvatar/provider work.

**After reboot:** run Chief wake/return checks; read the newest sections in all
three continuity files; verify task/port/canonical HTTP 200, manifest absent/404,
and dirty-tree preservation; then wait for G. On the SAME link test START ->
press START -> badge-only loading -> running STOP/GALLERY/MUTE/QUIET -> press
STOP -> returned idle. G checks badge-only loading, tight gaps, right column,
branding, identical short legal footer in start/running/stopped, legal absent
only while loading, and no scroll/crop movement. Keep the update postponed and
require fresh authorization for deploy/promotion.

**Copy/paste restart phrase:** `Resume aiASAP from the newest 2026-08-24 reboot checkpoint. Run Chief wake/return checks, verify aiASAP-Dev-3001, port 3001, https://mission-control.tail00dfe0.ts.net:9444 HTTP 200, manifest absent/404, and the dirty tree. Wait for G, then on that SAME link smoke START -> START press -> badge-only loading -> running STOP/GALLERY/MUTE/QUIET -> STOP press -> returned idle. Check tight gaps, right column, branding, identical short legal footer in start/running/stopped, legal absent only in loading, scrollY0/crop lock. Do not start a provider automatically, update, send Telegram, deploy, commit, or push.`

## Current mobile-start reboot checkpoint - 2026-08-23

- G's physical phone still shows the avatar moving on the mobile homepage start
  screen. That observation overrides the earlier fixed-viewport headless pass;
  the avatar-lock repair is not accepted.
- The live footer-only deployment keeps the brown legal bar exactly 4 CSS pixels
  north. Preserve it. No current avatar-lock or pill-blend draft was installed
  or deployed.
- Claude's first avatar and pill drafts were rejected. The authenticated
  correction packet is
  `20260823-161600-chief-to-claude-REVISE-mobile-start-avatar-and-pill-patches.md`;
  revised code is pending.
- Google Drive is prohibited for project work and handoffs. Disaster backup is
  the sole exception. Accept repair returns only through the authenticated
  Chief-Claude bridge and only after independent audit.
- Exact scope: mobile homepage start page only. Lock the avatar's actual rendered
  box/crop through browser-chrome viewport changes and prevent start-page
  scroll/overscroll. Beautify only the four pill controls' base paint using the
  locked warm palette. Freeze interaction/accessibility states, geometry, copy,
  icons, spacing, later stages, tablet, desktop, and unrelated surfaces.
- After reboot, process Chief-Claude returns first, independently audit the
  revised diffs, and verify locally plus on G's physical phone. Do not install
  or deploy merely because a draft exists; production promotion needs fresh
  explicit authorization.
- Stop snapshot: `rollback/june14` at `f4665eee`, 92 dirty entries preserved;
  port 3001 was listening and `aiASAP-Dev-3001` was Running before reboot.

Restart phrase: **Read the newest 2026-08-23 sections in all three aiASAP
continuity files and resume only the mobile start-page avatar-lock and pill-blend
review from the authenticated Chief-Claude correction packet.**

## Current public-pause rule - 2026-07-20

- Broader aiASAP and all iSolve work are stopped. G reopened only the exact job
  of replacing the raw Vercel `403` with a friendly static aiASAP pause page.
- G removed Dos from that job and explicitly assigned Codex to finish it.
- Preserve G's approved visual direction: **country-house feel with warm
  ambers**. G specifically ordered the existing iSolve **6's Workshop**
  background (`bg-6sWorkshop2.png`) to be used. This overrides the generated
  porch alternative, which must stay unused/excluded.
- The original `ai-asap` Vercel project must stay sealed by deny-all rule
  `rule_ai_asap_public_pause_2026_07_20_NgTWwV`; never weaken it to serve the
  friendly page.
- Serve the friendly page from a separate zero-function static project and move
  only `aiasap.ai` and `www.aiasap.ai` to it. Keep all original Vercel aliases
  and historical deployment URLs on the denied project.
- Static-page source is preserved at
  `C:\Users\sgdie\Documents\Claude\projects\ai-asap-pause-page`.
- At the reboot stop: no maintenance project/deploy existed and no domains had
  moved. The friendly page still needed local visual verification.
- Do not run 6, LiveAvatar, a smoke test, Supabase, or provider checks for this
  job. Verification is static-page rendering plus Vercel control-plane and safe
  anonymous HTTP evidence only.
- After the friendly page is live and all original addresses remain blocked,
  document the fail-closed rollback and stand down from aiASAP/iSolve again.

- Latest reboot-rule update from G on 2026-04-29 supersedes older caution wording: Codex does all work, always, unless Codex absolutely cannot, then asks G for help. Still protect secrets, preserve lane ownership, and keep G informed operationally.
- Shelly / Mrs. Claws is the local OpenClaw keymaster for keys, pins, and security. Start her in motion when security work is needed, but do not spy on her.
- Always send links when asking G to go anywhere.
- Always help G get to bed by 10:00 PM Eastern.
- Work only inside `C:\Users\sgdie\Dropbox\Codex\aiASAP` for aiASAP tasks.
- Assistant-wide lane rule: Codex works aiASAP; Claude works iSolve unless G explicitly says otherwise. Never cross lanes unless G knows it.
- Reboot contract: after every startup, re-read this file and `AIASAP_REBOOT_HANDOFF.md`, then act from these rules instead of relying on chat history.
- `T` is G's shorthand for Telegram in operational notes. In UI and user-facing copy, spell it out as `Telegram` unless G explicitly wants the shorthand.
- If G needs a message on Telegram, send it through the local Telegram Bot API path instead of saying it cannot be done. Use `.env` `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_IDS`; direct sending was verified on 2026-04-27 with `ok=True`.
- Telegram voice notes are handled by `telegram_codex_bot.py`: download the Telegram `voice` file, send it to OpenAI audio transcriptions with `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`, then feed the transcript into the normal Codex reply path. This was verified from G's voice-note transcript on 2026-04-27.
- Latest Supabase check rule from G on 2026-04-29: only inspect Supabase/backend after G gives feedback from a real test and the data is needed to understand what happened. Do not do routine Supabase checks after every smoke test.
- Startup service access rule for Codex and Claude: before saying a connected service is unavailable, check local envs, helper scripts, CLIs/APIs, dashboards, and route around blockers for Telegram, Vercel, Supabase, GitHub, Resend, LiveAvatar/context, and other required services.
- Smoke test delivery rule: every smoke test is sent to Telegram unless G explicitly says otherwise.
- Smoke test format in Telegram is exactly three lines: line 1 `Smoke test <build/version>`, line 2 the Vercel link, line 3 a super brief description of changes plus what G should do next. No long explanation.
- When possible, provide desktop links in chat because integrations are easier for G on the computer. Use Telegram/mobile links when necessary or explicitly requested.
- If G says to check the latest screenshots, look in Dropbox first.
- If G needs to copy/paste something, provide a copyable block or local file/link automatically and make it easy to copy.
- End-of-work format: every final brief should be super brief. Put any questions at the very end under `Questions:` so G can see them.
- The Telegram bot's user-facing name is Codex.
- The aiASAP Telegram bot should be fast to operate from Telegram, but avoid persistent bottom command buttons unless directly relevant.
- The bot should support typed messages and Telegram voice notes.
- Voice notes should be understood silently: no "Transcribing voice...", no "Transcript:", and no "Thinking..." messages.
- Telegram chat history should persist locally so conversations survive bot restarts.
- Keep secrets out of chat and logs. `.env` holds local keys and tokens.
- User wants "brief" to mean extremely brief: only the few lines needed, especially when action is needed.
- When sending the user a link or build to try, call it a "smoke test".
- Use the 95% rule: ask questions until at least 95% sure what the user wants, but keep questions concise.
- Absolute workflow rule: ask questions first; when ready to act on meaningful product/code/database changes, ask the user for permission and wait for explicit permission before acting.
- Default posture: do things for the user, ask for permissions when needed, and keep the computer/browser tidy by closing anything that does not need to stay open.
- Supabase rule: aiASAP must use its own Supabase project/database and storage, never the iSolve database or buckets. Current project URL starts with `https://wqszxsqzkaatghyrqviv.supabase.co`; aiASAP media belongs in the private `aiasap-media` bucket.
- Audit rule for product changes and auto-debug: audit first, give G a plan, get approval, then build/fix/deploy. Send G operational alerts through Telegram first.
- Release gate: build until G is happy first. Do not send aiASAP to friends, family, landscaping clients, or other outside testers until G explicitly says he is happy with the smoke test and ready to share it.
- aiASAP vision: a voice-first, self-learning AI company and product that helps people adopt AI with minimal mental friction.
- Company name must always be written exactly as `aiASAP`; never use any other capitalization or spacing.
- Current tagline direction: "Take the Leap"; older lines can remain as brainstorming, but smoke tests should use the current direction unless G changes it.
- aiASAP should feel one-click: install/open it, then a natural-language avatar guides the user and performs tasks across computer, phone, and tablet.
- UI rule: design mobile-first. LiveAvatar is portrait-only 9:16, so desktop/landscape must frame the portrait avatar cleanly without distorting it. G usually tests smoke tests on his phone.
- UI permission rule: avoid double permission prompts. Load avatar silently/muted first, then use one clear tap-to-begin gesture for mic/audio.
- Monetization direction: no cost right now until aiASAP is fully built and G explicitly approves charging. Current MVP/beta must be free with no payment ask, pricing wall, or commerce UI. Future pricing hypothesis: start around `$10/month`, then transparent usage-based tiers/credits as users rely on aiASAP more, roughly `$10 -> $20 -> $50 -> $100 -> $200+` per month. Any upgrade must be clear and user-approved, not a surprise automatic price jump.
- Future feedback/monetization behavior: 6 should occasionally ask, naturally and not too often, how users are liking aiASAP. Before a future usage/rate limit or tier upgrade, 6 should first ask how they are liking the app, listen to the answer, then ask whether they would pay more for more usage and record the response. No upgrade should happen without clear user approval.
- Future fair-billing behavior: paid tiers should be able to move users down automatically when usage drops, not only up when usage rises. After two months with no use, aiASAP should drop the user to the free tier automatically, keep their info, and let them restart or pick up right where they left off. 6 can say: "The subscription will drop automatically when you use less. Go two months with no use at all, and it can drop you to the free tier, keep your info, and let you pick up right where you left off. You ever heard of that before? This entire system is built for you." Tie this to 6 having their back in every way.
- App-store commerce rule: play by Apple/Google rules; if in-app digital credits are consumed inside mobile apps, plan for Apple/Google in-app purchase requirements.
- Founder/business direction: SG Dietz is the Creator/Builder/Founder/Financier/CEO aiASAP. He is self-funding early aiASAP as much as possible and prefers retaining ownership if feasible. Be open, publish cost/usage analyses where practical, and position aiASAP as helping people first.
- Company separation rule: aiASAP and iSolveUrProblems.ai are two different companies/projects. Keep code, Supabase, buckets, branding, data, and product direction separate unless G explicitly asks for a shared parent-company or cross-project integration.
- Name rule: `G` is the user's personal name/nickname only. Do not use `G` as a generic user placeholder or public founder label.
- LiveAvatar is intended as the front-facing natural-language avatar layer, including a digital copy of the user where appropriate.
- Codex is intended to be the operating brain for building aiASAP and coordinating implementation.
- Hardware context: this machine is a GEEKOM A5 mini PC running Windows 11 Pro 64-bit.
- Hardware limits: AMD Ryzen 5 7430U, 6 cores / 12 logical processors, 16 GB RAM, integrated AMD Radeon graphics, 512 GB Lexar SSD with roughly 385 GB free when checked on 2026-04-24.
- Build constraint: prefer cloud/API inference and lightweight local tooling; do not plan heavy local model training, GPU-heavy video generation, or long-running resource-intensive workloads on this PC unless explicitly approved.
- Current aiASAP LiveAvatar avatar ID: `3cbe98e4-50ff-4e48-8954-7685fcf09dac`.
- aiASAP avatar name: `6` using the number, not "Six" or "SIX".
- `6` is named 6 because he has their back, always. This is core identity and should stay consistent everywhere.
- Everything in aiASAP should orient users around this promise: `6` does the work for them.
- `6` personality: warm, southern, folksy, friendly AI buddy; allowed to be funny.
- `6` should sound like his own warm southern character, not necessarily like the user.
- `6` intro concept: "Hi, I'm 6, your AI buddy. You know why they call me 6? Because I got your back. a-i-ASAP is here to make AI easy, just by talking to me. What should I call you?"
- Keep 6's first spoken opening short. Do not front-load MVP, full-build, pricing, customization, founder, future-company-building, or contributor-program info. Put those details into the longer conversation only when they naturally help.
- Pronunciation rule: when spoken, aiASAP should be said as `a-i-ASAP`; 6 should never say `aiSAP`.
- Contributor idea: 6 can occasionally ask users what else they would like to use aiASAP for. G may build good ideas, and later users may build pieces with Codex. If G likes a user-built piece, he may consider incorporating it into aiASAP with possible credit or future revenue share under written terms. 6 may say: "Imagine getting a royalty on a super app. Money you could receive for the rest of your life. We're not promising anything yet, but we might make that a reality." Do not let 6 promise royalties, ownership, payments, or incorporation.
- After getting a user's name, `6` should say it is a pleasure to meet them, then ask for the most important things they cannot forget.
- `6` should use the person's name naturally every 6-10 responses, not constantly.
- `6` should collect reminders conversationally: birthdays, anniversaries, daily/weekly/monthly/yearly tasks, due dates, recurrence, urgency, and preferred notification channel.
- Birthday reminder default: one week before, one day before, and the morning of; stop the chain after the user confirms "I remembered."
- Silence timing rule: first re-engagement waits a full 10 seconds, second re-engagement waits a full 15 seconds, then stay quiet.
- UI thought prompts should stay present as a rolling rail and update with the conversation; they should be case-correct and not flash on/off.
- `6` should explain that aiASAP can remind by SMS/text first, email, phone call for urgency, Telegram, Messenger, WhatsApp, Signal, app push, and new channels where feasible.
- Key promise language: "I will remind you when you need to do things" and "You will never forget another birthday."
- LiveAvatar intro audio may cut off during load, so aiASAP should trigger the opening intro from our app after the avatar is ready, not rely only on LiveAvatar's built-in intro.
- First laser-focused product job: help people remember things they cannot forget.
- Product foundation: reminders first, lists second, then account/memory, notifications, shopping/gifts, daily routines, and later business-building guidance.
- aiASAP deeper mission: help people become more thoughtful and build a more wonderful life. 6 should lightly encourage users over time to build something with AI, but establish trust with reminders/lists first.
- 6 should avoid medical, mental health, legal, tax, investment, relationship counseling, politics, religion, sexual content, and unsafe/illegal instructions; redirect warmly to planning, tracking, or a qualified professional.
- Notification provider defaults: aiASAP inbox/push first, Telnyx for SMS/voice later, Mailgun for email later, Telegram for G's internal alerts.
- Users interact primarily by voice; voice is transcribed, understood, confirmed, stored, and turned into reminders/lists/follow-ups.
- `6` should confirm important captured details by reading them back, especially emails letter-by-letter, phone numbers digit-by-digit, and lists item-by-item.
- `6` should coordinate lists by colors when it helps the user scan them, offer colors naturally, ask what colors/styles make the user happy, and adapt to what would make aiASAP easier for that specific person.
- Store-mode direction: when people are shopping, the active list should be able to fill the phone screen with the phone's light/dark background. 6 should stay quiet unless needed, keep listening for list commands, and use as little data as the current architecture allows.
- `6` should usually ask when something is due or when the user needs it by.
- `6` should ask for the user's name naturally and use the name naturally, without overdoing it.
- Users can talk before creating an account. Lists/reminders can work for one session, but with an account `6` should explain in varied, friendly language that conversations are remembered, lists stay intact, likes/dislikes can be remembered, and we pick up where we left off every time. Account setup is optional, never forced. Use light humor: "do I know you? Have we met?" / "I never forget a face, but without an account I might not remember yours next time." Use the line where natural: "If you've got a phone, you've got a friend." Account setup should be easy: 6 sends an email link, the user clicks it, and then 6 can remember and pick up like a friend.
- `6` should ask "You ready?" before collecting an email for account setup. Only if the user answers yes or seems positive should 6 ask for the email address.
- Account capture should include name, email, and phone number.
- Memory/data direction: use Supabase or similar for accounts, persistent user memory, reminders, lists, and notification preferences.
- Reminder channel priority: SMS/text first, email second, phone calls third for urgent/escalated reminders, then app push, Telegram, Messenger where feasible.
- Reference context: iSolveUrProblems.ai has a working, complex `6` persona/context window. For aiASAP, use the same discipline: strict identity, voice-first rules, no typing language, natural humor, read-back confirmation, persistent memory, user override handling, silence rules, and never sounding like a generic chatbot.
- aiASAP `6` differs from iSolve `6`: aiASAP is not home/garden or investment-pipeline focused. Its first lane is everyday life assistance: remembering, reminders, lists, follow-ups, calendar, and making life easier by doing the work.
- aiASAP should eventually have its own complete avatar context window modeled on the iSolve structure, but rewritten for aiASAP's lane and promise.
- Current LiveAvatar aiASAP `6` context ID: `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930`.
- LiveAvatar context `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930` was updated through the API on 2026-04-25 to `aiASAP 6 Life Builder`: name-first opening handoff, mission, reminders, lists, notifications, account/memory, light business-building, affordability/cost-plus philosophy, and safety redirects.
- Current aiASAP `6` voice ID: `a65a59af-39bd-4f57-8cc6-235449ca3348`.
- A valid LiveAvatar API key was received and tested locally on 2026-04-24; it is stored only in ignored `.env` and Vercel environment variables, not committed.
- GitHub/Vercel direction: reuse proven iSolve integration patterns where possible, but do not modify the existing iSolve codebase unless explicitly instructed. Clone/reference it separately and build aiASAP as its own project/repo.

## Current Handoff - 2026-04-25

- Latest pushed commit before this handoff: `00245d1 Tune aiASAP mobile prompts`.
- GitHub repo: `https://github.com/SGDietz/aiASAP`.
- Production smoke test URL: `https://ai-asap.vercel.app`.
- Latest smoke test was sent to Telegram after Vercel reported READY.
- Current UI state: mobile-first portrait avatar, top `aiASAP` with `beta`, `Take the Leap` closer underneath, bottom prompt `Tell 6 What You Need to Remember`, rolling thought prompt rail, terms pinned to bottom.
- Current timing state: first silence re-engagement after 10 seconds, second after 15 seconds, session inactivity timeout after 60 seconds.
- LiveAvatar context `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930` was updated after the timing/reminder changes.
- Next thing G may do: run the smoke test on phone. After he says it is done, inspect Supabase transcript/session data, learn from it, and ask concise questions.
- Important unresolved check: Supabase schema may still need to be confirmed as run. If transcript lookup fails because tables do not exist, use `supabase/schema.sql` in the aiASAP Supabase SQL editor.
- Safe restart note: no local dev server is required for the live site; current source is pushed to GitHub and deployed through Vercel. Local `.env` secrets are only on this machine, while Vercel has production env vars.

## Laptop Shutdown Handoff - 2026-04-25

- Full handoff file for desktop pickup: `HANDOFF_2026-04-25.md`.
- Latest pushed commit at shutdown handoff: `49ac586 Rebuild with OpenAI prompt brain key`.
- Current review URL: `https://ai-asap.vercel.app`.
- Current review deployment: `ai-asap-gg86y5uwx-team-dietz.vercel.app`.
- Custom domains `aiasap.ai` and `www.aiasap.ai` are intentionally still on the prior approved build `ai-asap-np3pdbbqe-team-dietz.vercel.app`.
- Do not promote any Vercel build to `aiasap.ai` or `www.aiasap.ai` until G explicitly approves it.
- Required terminology/workflow: security audit before production deployment or live-domain promotion.
- OpenAI prompt brain is implemented and verified working through `app/api/prompt-brain/route.ts`; `OPENAI_API_KEY` is set in Vercel Production env and must not be written into repo files.
- Always send the ready/smoke-test link in Telegram when a build, deploy, or review URL is ready. Use the minimal message: `aiASAP build <commit>` and `https://ai-asap.vercel.app`. Helper script: `tools/send_telegram_smoke_test.ps1 -Commit <commit>`.

## Social CENTCOM Handoff - 2026-04-27

- Current internal social dashboard route: `/social`.
- Latest social shutdown smoke test sent to Telegram: `Smoke test 11806aa`.
- Latest preview URL: `https://ai-asap-msa70mst6-team-dietz.vercel.app/social`.
- Page name in UI: `aiASAP Social CENTCOM`.
- Current social platforms in scope: X, TikTok, Instagram, Facebook, Threads, YouTube.
- Threads account URL: `https://www.threads.com/@aiasap.ai`.
- YouTube/Google: G said the existing Google Brand Account should be used for aiASAP. Do not commit the internal Google `myaccount`/brand-account URL or ID; use/store a public YouTube channel URL only after it exists.
- Social tokens and drafts are stored as encrypted JSON in private Supabase Storage bucket `aiasap-accounts`, not `social_*` tables. Latest post-smoke check found the bucket ready and `users/` social object count `0`, expected until account connections happen.
- Vercel social envs already installed: `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `INTEGRATION_STATE_SECRET`. Missing provider envs: Meta, Threads, X, TikTok, Google/YouTube client IDs/secrets.
- Stable social callback URLs use production domain `https://ai-asap.vercel.app/api/social/{provider}/callback`; do not use temporary Vercel preview domains in provider consoles.
- DM/messaging apps such as WhatsApp, Messenger, Discord, and Telegram are deferred until the messaging workflow is appropriate; do not add them to the public social platform card list yet.
- Social dashboard purpose: internal control panel for account connection status, drafts, Telegram approval, and later posting/logging.
- Future product-track note: the setup work G is doing for aiASAP should later become an aiASAP user workflow that helps people create accounts, connect social platforms, set up developer apps/API keys, build approval workflows, create content, post/log results, and add messaging apps when useful.
- Current social implementation includes API routes under `app/api/social/`, page `app/social/page.tsx`, UI `src/components/SocialPostingHub.tsx`, and helpers `src/lib/socialPosting.ts`.
- Preview Vercel domains needed a same-origin API guard fix in `src/lib/apiRouteSecurity.ts`; otherwise `/api/social/status` fell back to `Status unavailable` on smoke-test links.
- Current dashboard cards correctly show missing setup counts/env gaps on preview links.
- Connecting everything is not a two-hour clean finish. A realistic next session is to start Meta first because it covers Instagram, Facebook, and Threads. Full connection also needs external developer apps, redirect URLs, OAuth logins, credentials in Vercel env, and possibly platform review/approval delays.

## LiveAvatar Debug Handoff - 2026-04-28

- G resumed LiveAvatar testing and said not to worry too much about credits; get it right.
- Discord clue: SDK `0.0.17` is current; David's working demo uses FULL mode with `avatar_persona.context_id` and `is_sandbox: true`. Anders' failing repro omitted `context_id` and `is_sandbox`.
- Vendored `@heygen/liveavatar-web-sdk` was updated from `0.0.9` to `0.0.17`; package metadata was stripped of workspace-only dev deps so Vercel clean install succeeds.
- Added `/liveavatar-debug` and `/api/liveavatar/debug-token` to test four token variants: `voice+context`, `voice+context+sandbox`, `voice only`, and `voice only+sandbox`.
- Latest deployed diagnostic build: `b783657`, URL `https://ai-asap-368u6dnsq-team-dietz.vercel.app/liveavatar-debug`.
- Smoke test sent to Telegram as `Smoke test b783657`.
- Supabase after the smoke test had no new rows; latest LiveAvatar evidence remains the 2026-04-27 user-only session `0c74140e-c1a8-4482-9d86-13d66d5dc32b`.
- Next manual test: open `/liveavatar-debug`, select `Sandbox: voice + context`, click `Start`, wait for stream ready/video, click `repeat()`, then if no speech click `message()`. Capture the session id and event log if it fails.
- Tester-link attribution (2026-05-25): clean tester links like `https://aiasap.ai/?tester=john-tn` capture a normalized `tester_label` slug (lowercase a-z, 0-9, hyphen/underscore, max 64 chars) on first page load via `src/lib/testerAttribution.ts`. Slug persists in sessionStorage + localStorage and is threaded into `conversation_messages`, `lead_sessions`, `transcript_events`, `contact_entities`, and `media_events` via the active API routes (prompt-brain, conversation/log, transcription/capture, liveavatar/session-transcript/sync, media/capture). Local schema additions live in `supabase/schema.sql` and `supabase/migrations/20260525_add_tester_label.sql`; not applied to remote DB yet.
- Data-use rule (G 2026-05-25): collect product-use data as a moat to improve aiASAP/iSolve/UX. Do NOT sell user data. Do NOT spam users. Do NOT misuse tester information. Tester labels exist to bucket sessions for analysis, not to identify or target individuals beyond what the tester opts into.

## Legal Direction - Governing Law (G 2026-08-22)

- When a future aiASAP or DietzX agreement or legal provision requires a chosen governing law, venue, or jurisdiction, the business preference is Wyoming, not Maryland.
- Preserve the legal boundary that a contract cannot displace non-waivable federal law or other mandatory law.
- Do not invent a county, business address, court, arbitration process, or other forum mechanism. Those details require separate authoritative decisions and appropriate legal review.

## Production Release State - 2026-08-22

- Live: `https://aiasap.ai` and `https://www.aiasap.ai` -> READY deployment `dpl_3U45kaR7Sh6nBkc3SHQu7XgxRw9X`.
- Production CUSTOM sessions deliberately omit LiveAvatar `context_id`; Six's runtime brain is `src/lib/brain/sixSystemPrompt.ts`, generated from `tools/cw_6af8624c_prompt.txt`.
- Production `OPENAI_API_KEY`, `TELEGRAM_ALERTS_ENABLED`, and `CRASH_EMAILS_ENABLED` are present. Do not print values.
- Independent Supabase leg is installed on aiASAP ref `wqszxsqzkaatghyrqviv`: `aiasap-cloud-heartbeat-watchdog`, `*/5 * * * *`, healthy first scheduled run, no duplicate, no alert emitted. Exact rollback is in `docs/operations/aiasap-cloud-watchdog-rollback.sql`.
- Local Windows failure watcher stays disabled; alerting architecture is two cloud legs only.
- Full local suite before deploy: 72 files, 679 pass, one intentional skip for the disabled local watcher; typecheck, diff check, secret scan, and clean 78-route build passed.
- The conversational LiveAvatar smoke is not certified: provider startup/opening succeeded and code-brain HTTP responses are correct after the env repair, but the final in-session sequence was contaminated by ambient speech. No Telegram smoke-ready note was sent.
- Pending local-only opening copy is `...set you free to live the life that you want to live.` It is verified but not in the current public deployment.
- aiASAP work is Chief in-house by default; no Grok unless G explicitly requests him.
## START Triangle Restore + Loading Choice Fixture Checkpoint - 2026-08-24

- START alone is restored to Lucide's natural pre-reduction triangle geometry on every viewport: phone paint `20.0015 x 22.5015px`, 600+ paint `24.0019 x 27.0018px`, with the accepted asymmetric painted center unchanged. STOP, MUTE, controls, labels, and live Loading remain frozen. The isolated `/codex-responsive-loading` route presents five labeled, responsive `LOADING...` typography choices over identical canonical Six artwork; it does not install a live Loading winner. Deterministic six-viewport geometry and local-only comparison screenshots are the evidence; no provider ride.
## Selected Constantia Loading Checkpoint - 2026-08-24

- G-selected round-four Option 2 is installed through the one shared `SixLoadingIndicator`: literal `Loading...`, Constantia 700 normal, `0.015em` tracking, selected gold gradient, `125.09375px` complete painted width on every viewport, 8px gap, centered ink, visible overflow, and descender-safe line box. The badge/readiness gate, START triangle, controls, and every unrelated live owner remain unchanged. Actual-component six-viewport proof, focused tests, typecheck/build, and local/canonical health are the acceptance evidence; physical-device acceptance remains G's gate.
