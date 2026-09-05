# aiASAP Reboot Handoff - 2026-04-27

## Physical Android Visual Repair - 2026-09-01 09:54 ET

- G's 09:19-09:20 Android captures exposed a false-height acceptance. The
  browser's real webpage viewport is 390x710 CSS pixels while its chrome is
  expanded, not the earlier 390x844 test surface. Reproduction at 390x710
  matched G's screenshot exactly.
- A late 9% inner media pad lowered and shortened Six inside the locked 9:16
  poster. It is now zero, restoring the complete frame. A second late rule
  applied stage-relative coordinates to the already-positioned phone footer,
  sending Legal below the viewport; that rule is now tablet-only at 768px+.
  The 599/600/767/768 seam was browser-verified after the correction.
- The contact card keeps its accepted brown/amber styling and size, now sits
  below the controls and above Legal, and uses conversational first-person copy
  such as `I heard:` and `Is that right?` instead of mechanical labels and
  commands. At 390x710: controls 403.22-553.22, card 573.59-670.00, and Legal
  682.22-703.14.
- LOADING retains the accepted C2 geometry and palette. A 2.6-second light band
  now crosses the complete rounded field and Six while the complete badge and
  rim breathe at 1.6 seconds; reduced-motion disables every added animation.
- Claude returned `PASS`. Authenticated Grok work
  `AIASAP-SIX-PHYSICAL-VISUAL-FINAL-R2-20260901-0952` returned
  `COMPLETE / PASS`. Final proof: 119/119 test files, 1048 passed / 1 skipped;
  TypeScript and diff check passed; the Next production build generated 81/81
  pages; restarted local 3001 and Tailnet 9447 both returned HTTP 200; the final
  Tailnet 390x710 geometry and all four loading animations were verified live.
- No commit, push, deploy, production promotion, Supabase/provider mutation,
  spend, credential/account change, or external contact occurred. Physical
  touch/speech/provider acceptance remains G's next smoke.

## Final Local Pre-Smoke Acceptance - 2026-09-01 04:49 ET

- Claude's adversarial pass found two additional signup speech defects before
  G's next smoke: low-confidence `I'm him`/bare pronouns could become a device
  name, and an inline negative email correction could discard the replacement.
  Both are fixed in `src/lib/signup/helpers.ts` with focused regressions.
- Grok then caught dotted-local and sentence-split correction gaps. The final
  gate requires both a correction cue and an email shape, supports typed dotted
  local parts plus spoken `at ... dot`, and does not treat
  `actually@example.com` as a correction cue. `hi`/`him`/`her`/`them` are
  rejected only on low-confidence name paths; explicit identity remains valid.
- Final local proof: 119/119 test files; 1047 passed / 1 skipped; TypeScript
  passed; `git diff --check` passed apart from line-ending warnings; isolated
  Next 15.5.15 build generated 81/81 pages and its temporary stage was removed.
  Local 3001 and Tailnet 9447 both show the correct 390x844 idle state with no
  overflow, failed UI, or provider-start request before START.
- Claude returned `APPROVE`. Authenticated Grok work
  `AIASAP-SIX-TWO-FIX-REVIEW-20260901-0441-R2` returned `COMPLETE / APPROVE`.
  No local blocker remains. Physical Android/provider/Supabase acceptance is
  intentionally still pending G's next smoke; no provider or database mutation
  was used to manufacture that acceptance.

## Physical Smoke Repair Checkpoint - 2026-09-01 04:05 ET

- G's 03:17-03:20 Android session was matched read-only to Supabase session
  `f31b1dc2-623b-4887-bd04-f0474f573ca8`. Supabase was available and wrote the
  follow-up; the malfunction was application logic, not a database outage.
- The complaint beginning `Okay` was incorrectly accepted as contact consent,
  and `have him help me` was incorrectly parsed as the name `help me`. Contact
  confirmation now accepts only explicit whole-utterance affirmatives, rejects
  questions/corrections, preserves `yes that's correct`, and retries a failed
  save only after another explicit confirmation. The name pattern now requires
  a left word boundary before `i am` / `I'm` / `im`.
- The reported no-mouth turn was dispatched natively, but the 2.6-second silent
  watchdog launched non-animating WebAudio before native `speak_started` arrived
  at 4.005 seconds. Native avatar speech now gets a five-second first-right
  window; true silence still gets one bounded fallback.
- Verbal capture remains controlling. A new read-only `ContactStatusCard` shows
  the email/phone and capture/confirm/save result on avatar and voice-only
  stages. It contains no input, button, form, link, focus, autocomplete, or
  password-manager surface. Letter/digit readback is comma-paced for clarity.
- Claude reviewed the installed code and returned `APPROVE`. Authenticated Grok
  work `AIASAP-SMOKE-20260901-FINAL-VERDICT` returned `COMPLETE / APPROVE`.
- Local proof: 7 focused files / 112 tests passed; `npx tsc --noEmit` passed;
  isolated Next 15.5.15 production build generated 81/81 pages; full suite was
  999 passed / 1 skipped / 20 stale visual assertions in six unrelated files.
  Local 3001 and Tailnet 9447 each returned HTTP 200 with all 7 referenced assets
  at HTTP 200 and the compiled `data-contact-status-card` marker present.
- The already-written bad smoke row was inspected but not mutated. No commit,
  push, deploy, production promotion, Supabase mutation/migration, provider ride,
  spend, account/credential change, or external contact occurred.
- Physical Android/provider acceptance is still pending. The next phone smoke
  must prove native mouth movement and visible contact status before this is
  called physically fixed.

## Operating Checkpoint - 2026-08-31 - Codex/Grok Bot No-HITL aiASAP Lane

- G renamed this agent **Codex**; never call Codex Chief. Legacy task/file names
  containing `Chief` are mechanical compatibility names only.
- aiASAP is Codex's only project until G redirects. Grok Bot is G's sole
  Telegram/phone interface. G does not relay packets or babysit either agent.
- Grok and Codex may investigate and write aiASAP code. Codex installs and
  independently verifies it in this exact checkout.
- The authenticated autonomous contract is
  `C:\AgentComms\shared\codex-grok-aiasap\README.md`. Scheduled tasks
  `Codex-Grok-aiASAP-Worker` and `Codex-Grok-aiASAP-Watchdog` are installed;
  dedicated persistent Codex task `01a058bf-47fd-7fc2-af29-b3c00130a5e8`
  reported the exact readiness marker.
- Inbound work must have a byte-identical Grok source-outbox copy, unique
  Work-ID, and exact `Lane: aiASAP`. Receipts are byte-identical in the Grok
  inbox, Codex audit outbox, and Grok Bot local incoming mirror before Grok is
  awakened. Consequential G authority relayed by Grok is verified against the
  raw allowed-user Telegram update/hash/quote.
- G authorized local aiASAP code edits, installation, tests/builds, and local
  runtime verification. Commit, push, deploy, production promotion,
  database/provider mutation, spending, credentials/accounts, destructive
  cleanup, and external contact remain closed without G's authenticated exact
  authorization for that action.
- The automated lane passed 8/8 packet/auth/dedupe/receipt tests and a green
  self-test. Task ownership and heartbeat are truthful: worker task Running,
  runtime phase `ready`. Live fixture `GROK-CODEX-AIASAP-E2E-20260831-1`
  completed autonomously through authenticated TASK -> ACK_WORKING -> dedicated
  Codex execution -> terminal COMPLETE. It confirmed `rollback/june14` at
  `f4665eee`, preserved all 136 dirty entries, found `aiASAP-Dev-3001` Running,
  and received HTTP 200 from local 3001 and Tailnet 9447. No app source, server,
  Tailnet mapping, provider, database, Git, deployment, or external action
  changed during setup or the fixture.
- Grok Bot returned a byte-identical authenticated terminal `COMPLETE` on
  `CODEX-GROK-AIASAP-NO-HITL-20260831`: he will route future G aiASAP requests
  through this lane without asking G to relay packets or babysit either side.
- The next product gate is unchanged: G's physical phone smoke on
  `https://mission-control.tail00dfe0.ts.net:9447/`, routed through Grok, then
  Grok sends Codex an authenticated `Supabase` verification task.

**Restart phrase:** `Resume aiASAP from the 2026-08-31 Codex/Grok Bot no-HITL checkpoint. I am Codex, not Chief; aiASAP only. Verify Codex-Grok-aiASAP-Worker and its watchdog, preserve rollback/june14 f4665eee and every dirty entry, and accept only authenticated Grok source-outbox packets with Lane: aiASAP. Grok and Codex may write; Codex installs and verifies. Commit/push/deploy/production/provider/database/spend/account/external gates remain closed unless G's raw Telegram update/hash/quote opens the exact action. Next product gate is G's 9447 phone smoke through Grok, then authenticated Supabase verification.`

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

## Shutdown Checkpoint - 2026-08-30 - New Four-Word Tagline Installed Locally

- G selected the exact shared aiASAP tagline: `Gorgeous. Brilliant. Fast. Cheap.` Chief installed it only in `src/components/TaglineText.tsx`; START, RUNNING, stopped, and Voice consume that owner. Loading remains independent and unchanged.
- Accessibility copy and the narrow tagline contract now match the exact four words and punctuation. No geometry, typography sizing, lifecycle, provider, database, account, Tailnet mapping, or unrelated source was changed for this request.
- Local proof: tagline-specific contract passed; `npm run typecheck` passed; the existing two-file visual suite remains `19 passed | 10 failed`, with all 10 failures in stale unrelated stage expectations. Port 3001 returned HTTP 200 with new copy present and old copy absent; rendered browser proof showed the new line visible.
- Authority remains `rollback/june14` at `f4665eee`, with 133 dirty entries (52 tracked, 81 untracked). Preserve every intentional change. No clean, reset, commit, push, deploy, paid/provider session, Supabase/account action, or WildWorks work occurred.
- Runtime at stand-down: `aiASAP-Dev-3001` Running and `:::3001` listening. G controls the computer shutdown. After this checkpoint, stop implementation, tests, browser control, runtime changes, and coordination.

**Copy/paste restart phrase:** `Resume aiASAP from the 2026-08-30 tagline shutdown checkpoint. Run Chief return gates, preserve rollback/june14 f4665eee and the 133-entry dirty tree, verify aiASAP-Dev-3001/port 3001, and confirm Gorgeous. Brilliant. Fast. Cheap. remains visible locally. No deploy, provider start, commit, push, mapping change, or WildWorks work without G's fresh authorization.`

## Chief Telegram Identity Lock - 2026-08-28

- Any future Chief/Codex Telegram send must use only the direct `@CodexGeekom1bot` lane. Never send Chief messages through the Claude bot. This identity rule does not itself authorize a message; each send still requires the current task's outbound authority.

## Reboot Stand-Down Checkpoint - 2026-08-28 - Android Microphone Recovery Pending Physical Retest

- G ordered reboot preparation. All aiASAP implementation, testing, browser control, runtime changes, and coordination are now stopped; G retains reboot initiation.
- Authority remains `rollback/june14` at `f4665eee`. Reboot snapshot: 121 dirty entries (50 tracked changes, 71 untracked). Preserve all intentional dirt; do not clean, reset, commit, push, or deploy.
- Claude is the microphone coding lead. Chief stayed support-only and made no microphone-code edits. Claude's latest local source contains `micPromptPendingRef`, `micBlockedRef`, Custom-Tab-safe recovery copy, and focused blocked-recovery tests. Claude reported `tsc --noEmit` exit 0 and suite `28 failed | 801 passed | 1 skipped`, with the same 28 pre-existing failures and six new passes; Chief did not rerun these after the reboot order.
- G's confirmed origin story: on the first link open, Android showed the microphone permission sheet; G accidentally touched outside it; the sheet disappeared; the microphone path has failed since. The later browser embargo/quiet-block explanation is plausible but not observable from page APIs.
- Last real-phone evidence before Claude's 10:54 fix: START first appeared dead; a second attempt showed the blocked-microphone card; tapping `I TURNED IT ON` still left the same problem. Claude then reordered the known-blocked recheck so the card stays visible with `CHECKING...` and added a no-remint blocked fast path. That newest fix has NOT been physically retested or accepted.
- Runtime snapshot: scheduled task `aiASAP-Dev-3001` Running; `:::3001` listening (PID 10792); canonical `https://mission-control.tail00dfe0.ts.net:9444` is tailnet-only and proxies to `127.0.0.1:3001`.
- Claude also created `https://mission-control.tail00dfe0.ts.net:9445` as a second tailnet-only clean-origin workaround to the same port. It is not G-accepted, not canonical, and must not be handed out, used, promoted, or treated as the fix without fresh explicit G authorization. Reconcile whether to keep or remove it after reboot.
- The approved X banner artifact is `C:\Users\sgdie\Documents\Codex\2026-08-28\files-mentioned-by-the-user-codex\outputs\aiASAP-X-banner-reference-direct-v5.png`. G reported saving the staged new header; post-save public verification was not performed.
- Restart order: run Chief wake/return gates; read this section and Claude's 10:40, 10:48, and 10:54 packets; verify task/listener/Tailnet mappings and dirty-tree preservation; do not auto-start a provider; wait for G; then decide the `9445` mapping before any physical smoke.

**Copy/paste restart phrase:** `Resume from the 2026-08-28 Android microphone reboot checkpoint. Run Chief return gates, preserve rollback/june14 f4665eee and the 121-entry dirty tree, verify aiASAP-Dev-3001/port 3001 and Tailnet 9444, read Claude's 10:40/10:48/10:54 packets, and keep unapproved 9445 frozen. The latest blocked-card/no-remint fix has not had a real-phone retest. Wait for G; do not auto-start a provider, deploy, commit, push, or change mappings.`

## Reboot Stand-Down Checkpoint - 2026-08-24

- G ended tonight's pass after a real Comet smoke. The approved C2 `LOADING...` treatment remains the shared loading authority across phone, tablet, and desktop; no STOP-box change is pending because G explicitly withdrew it.
- The Comet failure was runtime-only: an old `next dev` process outlived a production build and served HTML pointing at missing assets. The verified `aiASAP-Dev-3001` process chain was restarted through the scheduled launcher. Fresh local and Tailnet root/fixture HTML now resolves all referenced JS/CSS assets (28/28) with no 404s and `no-store` caching.
- G's real voice review found Six's sales transition too pushed. Preserve as uninstalled product feedback: earn the handoff conversationally; introduce G's genuine design, branding, website, and business-building help naturally; ask `What do you call your landscaping business?` rather than the awkward company-or-person question. Do not turn this into a code task without new authorization.
- Reboot state: `aiASAP-Dev-3001` is running; C2 source/render/runtime are verified locally; physical Comet visual acceptance after refresh and provider acceptance remain G's gate. No commit, push, deploy, provider session, database, account, secret, or external action occurred.

## Final Shared C2 Loading Checkpoint - 2026-08-24

- G's final authority supersedes the later Constantia treatment: the one shared `SixLoadingIndicator` again renders the approved bold uppercase C2 `LOADING...` on phone, tablet, and desktop through `LoadingText`. `L` is exactly 1.20x `OADING`; phone ink is `146.25 x 54.4375px` with an 8px rim gap, while 600px+ ink is `292.5 x 108.875px` with a 16px gap. Required 390/599/600/934x772/1440x900 actual-component renders have <=0.0078125px center error and no clipping. Focused 28/28, typecheck, 78-route build, diff check, and restored local/canonical runtime are green. No provider ride; physical-device/provider acceptance remains G's gate.

## Exact CUSTOM Opening Checkpoint - 2026-08-24

- A brand-new CUSTOM provider session now claims and speaks exactly once: `6 here. Tell me what you love doing and what you know. Together, we're gonna build a money-making machine.` The runtime owner is `VOICE_START_GREETING` behind `claimSessionGreeting(anonymousGreetingSpokenRef)` in `LiveAvatarSession.tsx`; the synchronized code brain carries the same exact line, and the obsolete post-interruption completion/question injection is removed. No provider ride; deterministic contract tests, typecheck/build, and local/canonical health are the evidence.

## Selected Constantia Loading Checkpoint - 2026-08-24

- G-selected round-four Option 2 is installed through the one shared `SixLoadingIndicator`: literal `Loading...`, Constantia 700 normal, `0.015em` tracking, selected gold gradient, `125.09375px` complete painted width on every viewport, 8px gap, centered ink, visible overflow, and descender-safe line box. The badge/readiness gate, START triangle, controls, and every unrelated live owner remain unchanged. Actual-component six-viewport proof, focused tests, typecheck/build, and local/canonical health are the acceptance evidence; physical-device acceptance remains G's gate.

## START Triangle Restore + Loading Choice Fixture Checkpoint - 2026-08-24

- START alone is restored to Lucide's natural pre-reduction triangle geometry on every viewport: phone paint `20.0015 x 22.5015px`, 600+ paint `24.0019 x 27.0018px`, with the accepted asymmetric painted center unchanged. STOP, MUTE, controls, labels, and live Loading remain frozen. The isolated `/codex-responsive-loading` route presents five labeled, responsive `LOADING...` typography choices over identical canonical Six artwork; it does not install a live Loading winner. Deterministic six-viewport geometry and local-only comparison screenshots are the evidence; no provider ride.

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

## Current Reboot Checkpoint - 2026-08-24 - Droid Queue Repaired Locally; Phone Gate Pending

- aiASAP only, local only. No WildWorks action; no provider ride, commit, push,
  deploy, database/account/secrets change, Telegram, replacement link, or update.
- Baseline reverified: `rollback/june14` / `f4665eee`; preserve the intentional
  92-entry tree (40 tracked, 52 untracked) and all unrelated work.
- Phone START/running/returned-STOP keep one `StageLegalFooter`. Its semantic
  box/text position stays fixed while <=599px brown paint is exactly 12.397px,
  70% of 17.71px. Loading alone has no footer.
- Phone loading is plain `#3a2108` with only the canonical 6. Badge authority is
  `208px` -> `249.6px` (+20%), centered exactly; 600px+ stays `208px`.
- Proven hang repaired: an SDK start rejection now exits badge-only loading and
  exposes the existing honest failure surface instead of remaining masked by
  the disconnected-state loader. Provider/physical-avatar acceptance still
  requires G's next Droid ride.
- Proof: focused tests 19/19, typecheck, production build, and diff check passed.
  At 390x844 the badge computed 249.59375 square at center (195,422); no visible
  text, branding, controls, legal, or avatar. The 599/600 seam preserved the
  phone-only 249.6/30.603px winners versus frozen 208/25.29px winners.
- Runtime restored: `aiASAP-Dev-3001` Running, `:::3001` listening, three local
  and canonical HTTP probes 200, no manifest link, manifest route 404.

## Current Reboot Checkpoint - 2026-08-24 - Local Visual Pass Ready; Phone Acceptance Pending

This section supersedes the stale 2026-08-23 mobile-start checkpoint below.

### Lane, authority, and safety boundary

- Codex/Chief owns aiASAP; Claude owns WildWorks. Take no WildWorks action.
- This is local-only work. No commit, push, deploy, paid/provider session,
  Supabase/database/account/secrets action, Telegram resend, or replacement URL
  occurred. Production remains untouched.
- The pending Codex/software app update is deliberately postponed until G says
  the aiASAP visual loop is finished and it is safe.

### Canonical preview and runtime

- Use only G's existing canonical link:
  `https://mission-control.tail00dfe0.ts.net:9444`. Do not send it again through
  Telegram and do not create a replacement URL.
- Local authority is port `3001`, scheduled task `aiASAP-Dev-3001`. Reboot-prep
  audit: task `Running`; listener `:::3001`; local and canonical HTTP `200`.
- Git snapshot: branch `rollback/june14`, HEAD `f4665eee`, 92 status entries
  (40 modified, 52 untracked). Preserve the intentionally dirty tree.
- Normal-website behavior is intact: canonical HTML has no manifest link,
  `/manifest.webmanifest` returns `404`, and favicon assets remain present.

### Accepted local visual authority

- Loading is the sole deliberate exception: solid `#3a2108` brown; centered
  canonical `208x208` 6 badge/emblem with restrained golden glow and retained
  status semantics; no visible branding, Loading word, controls, legal/footer,
  avatar, or other UI.
- START, running, and returned-stopped share locked phone authorities. Their
  visible legal footer is a declared `17.71px` brown bar, transparent lead
  `25.29px`, fixed `55px` reserve, and `12px` bottom remainder. Final measured
  rect at 390x844: x0/y814.296875, 390x17.703125, bottom832.
- The legal anchor is centered and modestly padded beyond the paint for access,
  but is not full-bar width. Every legal span is solid `rgb(215,160,90)`, with
  no gradient/text clip, and line opacity `.60`. Loading has no legal surface.
- START/running/stopped icon-to-label gaps are exactly `2px`.
- Initial idle keeps the accepted `220x150` field with four `110x75` semantic
  hit cells, left x85 and right x199; its accepted right column includes +4px.
  For non-idle states GALLERY/QUIET moved +4px as a unit while left controls
  stay fixed.
- Running/stopped branding is exactly 12px higher than its former state owner.
  The latest accepted initial START branding is unchanged.
- Controls use the floating no-box treatment, outlined warm icons, solid bronze
  labels, equal strong colors, and honest enabled/disabled semantics. This
  treatment is installed across phone, tablet/iPad, laptop, desktop, and avatar
  lifecycle states while preserving responsive geometry.
- Active/stopped phone avatar remains `390x789`, with `scrollY=0`.
- Wordmark/tagline color source was not changed; G likes the current look after
  reviewing mockups. Installable-app behavior remains removed.

### Verification and acceptance boundary

- Four physical Android screenshots were inspected. Deterministic loading,
  active, and stopped fixtures were rendered without continuing provider calls.
- Focused matrix `8/8`, typecheck, production build, and diff-check passed; the
  canonical runtime was restored and is HTTP `200`.
- Latest source is READY LOCALLY for G's next physical-phone smoke test. Final
  physical-phone acceptance after these newest fixes has NOT happened. Local
  rendered proof is not phone acceptance. Never auto-start a provider or
  LiveAvatar session after reboot.

### Next reboot sequence

1. Run Chief wake/return assertions first.
2. Read the newest 2026-08-24 sections in this file, `PROJECT_MEMORY.md`, and
   `STICKY_REBOOT_RULES.txt`.
3. Recheck `aiASAP-Dev-3001`, port 3001, canonical Tailnet HTTP 200, manifest
   absence/404, and preservation of the dirty tree.
4. Wait for G. Then use the SAME link for one clean phone smoke test: START
   screen -> press START -> badge-only loading -> running with
   STOP/GALLERY/MUTE/QUIET -> press STOP -> returned stopped/idle.
5. G checks: loading shows only the 6 badge; icon-label gaps are tight; right
   column placement and branding positions are correct; the identical short
   legal bar/text appears in START/running/stopped and is absent only in loading;
   no page scroll or crop movement occurs.
6. Keep the software update postponed. Do not deploy or promote without fresh
   explicit authorization.

**Copy/paste restart phrase:** `Resume aiASAP from the newest 2026-08-24 reboot checkpoint. Run Chief wake/return checks, verify aiASAP-Dev-3001, port 3001, https://mission-control.tail00dfe0.ts.net:9444 HTTP 200, manifest absent/404, and the dirty tree. Wait for G, then on that SAME link smoke START -> START press -> badge-only loading -> running STOP/GALLERY/MUTE/QUIET -> STOP press -> returned idle. Check tight gaps, right column, branding, identical short legal footer in start/running/stopped, legal absent only in loading, scrollY0/crop lock. Do not start a provider automatically, update, send Telegram, deploy, commit, or push.`

## Current Reboot Checkpoint - 2026-08-23 - Mobile Start Page Not Yet Accepted

- Scope is aiASAP's **mobile homepage start screen only**. G's physical-phone
  observation is authoritative: the avatar still moves when the phone browser
  viewport changes, so the lock repair is not accepted.
- Production `https://aiasap.ai` is currently the footer-only deployment
  `dpl_9kySsR6P6kaeyyaEJJuXVYKSW2ec`. Its brown legal-bar top edge was verified
  exactly 4 CSS pixels north. Preserve that paint change.
- No avatar-lock or pill-blend application code from the current review was
  installed or deployed. No commit, push, provider/session/database/account
  change, or service restart was made for those drafts.
- Claude's first avatar draft (`100svh` to `100dvh` on the outer wrapper) was
  rejected because it did not keep the still-image box/crop invariant through
  browser-chrome resizing. His first pill draft was rejected because it added
  unapproved colors and changed interaction states.
- The corrected, draft-only request is delivered through the authenticated
  Chief-Claude bridge as
  `20260823-161600-chief-to-claude-REVISE-mobile-start-avatar-and-pill-patches.md`.
  It requests: (1) an invariant avatar box/crop plus no start-page
  scroll/overscroll; and (2) base-paint-only pill blends using the locked warm
  palette, with no geometry, copy, icons, spacing, accessibility, state, or
  behavior changes. Claude's revised diffs have not yet returned.
- Google Drive is prohibited for this work. The only material permitted there is
  the disaster backup. Resume only from a matching receipt in the authenticated
  Chief-Claude bridge; do not place, retrieve, install, or deploy project work
  through Drive.
- Checkout at stop: branch `rollback/june14`, HEAD `f4665eee`, 92 dirty entries.
  Preserve every unrelated dirty change. Port 3001 was listening and scheduled
  task `aiASAP-Dev-3001` was Running before reboot; recheck both after reboot
  before calling the local runtime ready.

### Resume sequence

1. Run the Chief wake and return assertions, then authenticate and acknowledge
   any Claude receipt before reporting status.
2. Read the corrected Claude reply plus the Chief-Claude shared thread. Audit
   both revised diffs independently against the exact mobile-start constraints.
3. Do not install a draft that merely changes viewport units. Require the
   avatar's rendered box and crop to remain fixed while browser chrome changes,
   with the footer still exactly 4 CSS pixels north and no vertical scroll.
4. If the diffs pass review, install and verify locally first. The acceptance
   gate is G's physical phone on the mobile start page; fixed-size headless
   evidence alone is insufficient. Keep tablet, desktop, later stages, and all
   unrelated surfaces frozen.
5. Do not promote revised avatar or pill code without fresh, explicit production
   authorization after local and physical-phone acceptance.

Restart phrase: **Read the newest 2026-08-23 section in
AIASAP_REBOOT_HANDOFF.md, PROJECT_MEMORY.md, and STICKY_REBOOT_RULES.txt. Stay
in aiASAP only. Resume the mobile homepage start-page avatar-lock and pill-blend
review from the Chief-Claude correction packet; do not install or deploy until
the revised diffs pass Chief audit and local/physical-phone proof.**

## Current Reboot Handoff - 2026-07-20 8:09 PM ET - Friendly Static Pause Page

G stopped all broader aiASAP/iSolve work, then explicitly reopened one exact
aiASAP job: replace Vercel's ugly white `403 Forbidden` screen with a friendly
static pause page that cannot wake 6 or burn AI/provider credits. G then removed
Dos from this job and told Codex to do it directly.

### Approved visual direction

- G explicitly approved a **country-house feel with warm ambers** and said he
  loved it. Preserve that direction through the turnaround.
- G then clarified the exact background: use the existing **6's Workshop** image
  already made for iSolve, `bg-6sWorkshop2.png`. This direct instruction
  supersedes the newly generated porch alternative.
- Current copy: `6 is taking a quick breather.` followed by a short, friendly
  tune-up/check-back-soon message.
- Exact source asset:
  `C:\Users\sgdie\Documents\Claude\projects\iSolveUrProblems-skin\apps\demo\public\bg-6sWorkshop2.png`.
  Its copied SHA-256 is
  `BA214AB2ED72185B0B7F835BE0B0EF08A6F39E78D605403D9DAE5DF6CA64C031`.

### Current live safety state - preserve exactly

- Original Vercel project: `ai-asap` / `prj_2CfMVCy2tavswMsBZMyycRcyKy6X`.
- Active host-agnostic deny-all rule:
  `rule_ai_asap_public_pause_2026_07_20_NgTWwV`, path regex `^/.*$`.
- Original project bypass inventories are empty.
- The two custom domains still belong to the original project and currently
  return `403`: `aiasap.ai`, `www.aiasap.ai`.
- The original project's named aliases and 100+ direct deployment URLs remain
  sealed by the same WAF rule.
- Local aiASAP server is stopped; port `3002` is closed; no aiASAP Comet tab was
  present at the last accessibility-tree check.
- Canonical repo baseline before this documentation checkpoint was branch
  `rollback/june14`, HEAD `dc4ba33e`, with 68 pre-existing status entries.
- Final reboot-ready repo state is still branch `rollback/june14` at
  `dc4ba33e`, now 71 status entries because Codex intentionally updated only
  `AIASAP_REBOOT_HANDOFF.md`, `PROJECT_MEMORY.md`, and
  `STICKY_REBOOT_RULES.txt` for this checkpoint.

### Friendly page already built locally

- Separate isolated folder:
  `C:\Users\sgdie\Documents\Claude\projects\ai-asap-pause-page`
- Files ready: `index.html`, `vercel.json`, `.vercelignore`, `README.md`,
  `six-workshop.webp` (optimized 167,308-byte deploy asset), and a byte-for-byte
  local copy of the original `bg-6sWorkshop2.png` source.
- The earlier generated `porch-workshop` files remain only as excluded, unused
  artifacts. Do not deploy or select them.
- Page is plain HTML/CSS only: no JavaScript, API, Functions, middleware, cron,
  analytics, external font, external image, environment variable, integration,
  account, Supabase, or provider credential.
- Strict CSP and privacy/security headers are in `vercel.json`.
- The page has not yet been locally browser-rendered because G called for the
  reboot just before that check.

### No remote maintenance work has happened yet

- No maintenance Vercel project exists yet; TeamDietz project count remained 7.
- No static deploy has been created.
- No domain has been moved.
- The original aiASAP WAF and live project have not been loosened, deployed,
  edited, or reopened.
- No smoke test and no 6/LiveAvatar session were started.

### Exact next steps after reboot

1. Read this newest section plus
   `C:\Users\sgdie\.codex\memories\extensions\ad_hoc\notes\20260720-200917-aiasap-friendly-pause-reboot.md`.
2. Locally render and visually inspect the static page at desktop and phone
   sizes. Confirm it uses the exact existing iSolve 6's Workshop background and
   preserves the approved country-house/warm-amber look.
3. Create a new, isolated Vercel project named `aiasap-paused` under
   `team-dietz`; Framework `Other`, no Git, build command, env, integrations, or
   runtime resources.
4. Deploy the static folder without custom domains. Verify `200`, the marker
   `aiasap-static-pause-v1`, no external requests, and 0 Functions/0 Middleware.
5. Atomically move only `aiasap.ai` from the original project to the new static
   project using Vercel's project-domain `move` endpoint; verify the friendly
   page, then repeat for `www.aiasap.ai`.
6. Leave `ai-asap.vercel.app`, branch/test aliases, direct deployment URLs, and
   the original deny-all WAF untouched.
7. Verify apex/www return the static page, `/api/__aiasap_pause_probe__` is a
   static `404`, and every original alias/direct deployment remains `403`.
8. Write the final rollback note, then stand down from all aiASAP/iSolve work.

### Fail-closed rollback

Move `aiasap.ai` and `www.aiasap.ai` atomically from `aiasap-paused` back to the
original project while leaving the deny-all WAF active. The fallback must be the
generic locked `403`, never the working aiASAP app. Do not delete either project,
domain, account, data, env, or deployment.

## Bedtime Handoff - 2026-04-29 Late ET

G asked to push the current MVP fixes through to `https://aiasap.ai` before bed and preserve the restart point for tomorrow.

### Lane and deploy rule

- Stay in `C:\Users\sgdie\Dropbox\Codex\aiASAP` only.
- Do not touch iSolve.
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

- Production deployment rule from G: once we have a working model, promote it to `www.aiASAP.ai`. After that, do iteration work in Vercel preview/staging, and only push/promote through aiASAP production when the model is fully working. Do not push half-finished iteration work to production.
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

## Live Release Checkpoint - 2026-08-22 18:36 ET

- Canonical dirty checkout: `C:\Users\sgdie\Documents\Claude\projects\ai-asap-may06-prod`; preserve all unrelated changes. No commit or push was made.
- Public apex and www currently resolve to READY Vercel deployment `dpl_3U45kaR7Sh6nBkc3SHQu7XgxRw9X` (`ai-asap-byy8dhb4z-team-dietz.vercel.app`). The July deny-all WAF rule remains present but inactive.
- Production alert flags `TELEGRAM_ALERTS_ENABLED` and `CRASH_EMAILS_ENABLED` are enabled. `OPENAI_API_KEY` was restored to Production after the controlled smoke exposed that it was absent; the public code-brain endpoint now returns 200.
- Emergency prior deployment: `dpl_H5VP5RFzxZHVXwY3fEguKQqERFBx`. It predates the Production OpenAI-key repair, so a direct rollback to it would restore the prior UI but not a working code brain; a functional rollback must be redeployed with the current verified Production env.
- Supabase project `wqszxsqzkaatghyrqviv` has the independent `aiasap-cloud-heartbeat-watchdog` pg_cron job every five minutes, one job only, security-definer function locked from browser roles, durable state/throttle tables, and five aiASAP-specific Vault inputs. First scheduled run succeeded healthy with no alert. Rollback SQL: `docs/operations/aiasap-cloud-watchdog-rollback.sql`.
- The Windows `aiASAP-Failure-Watch` task remains Disabled. The unrelated `G Supabase Daily Scan 1AM` task remains enabled and untouched.
- LiveAvatar production CUSTOM token/session requests contain no `context_id`; the historical local context ID is absent from the provider account. Production replies are code-brain driven by `src/lib/brain/sixSystemPrompt.ts`, generated from `tools/cw_6af8624c_prompt.txt`.
- Real provider evidence: connection/video/five controls/opening succeeded; repaired token path proved no context ID. The final conversational smoke was contaminated by ambient physical speech recognition before the deterministic WildWorks sequence completed. No fourth session is authorized. No Telegram smoke-ready note was sent.
- Local-only pending copy after the live deployment: the opening ending is now `live the life that you want to live.` in the canonical prompt, generated brain, component opening constant/fallback filter, and focused test. It is tested/typechecked but NOT deployed.
- Current operating rule: Chief works aiASAP in-house. Do not use Grok or another teammate unless G explicitly asks.

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
