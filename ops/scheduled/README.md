# Scheduled scripts — versioned copies

These are aiASAP's Windows Scheduled Task scripts. **They do not run from here.**

The live copies run from:

```
C:\Users\sgdie\Documents\Claude\Scheduled\
```

and the Task Scheduler entries point at that path, not at this repo.

## Why the copies exist

That folder is not a git repository and is not covered by the nightly GitHub
backup (which backs up wildworks, isolve and aiasap — not `Scheduled\`). So
until now this automation had **no history and no backup at all**: a rewrite
could not be reviewed, a mistake could not be undone, and a lost file could not
be recovered.

These copies fix that. `tests/ops/scheduledScriptsInSync.test.ts` fails if a
live script and its copy here ever differ, so the pair cannot drift quietly —
a second copy that silently diverges is worse than no copy, because it looks
like a backup while being a lie.

## The rule

**Change one, change both, in the same commit.** If you edit a live script,
copy it here. If you edit one here, copy it out. The test will catch you either
way.

## What each one does

| Script | Task | Job |
|---|---|---|
| `aiasap_dev_3001.ps1` | `aiASAP-Dev-3001` | Keeps the dev server on :3001 up at logon. Self-healing. An idle server mints nothing. |
| `restart_aiasap_dev_3001.ps1` | manual | Clean restart of :3001 — kills the orphan node process the task leaves behind, then proves HTTP 200. |
| `aiasap_failure_watch.ps1` | `aiASAP-Failure-Watch` | The **third leg** of alerting. Watches the cloud watcher's heartbeat and the local dev server. Silent unless something is wrong. |
| `aiasap_failure_watch_hidden.vbs` | (wrapper) | Runs the watcher with no visible window. Chief's fix, 2026-08-21. **Hard-codes the `.ps1` path** — if that file moves, this must change in the same commit or the watcher silently succeeds while running nothing. |
| `aiasap_warmup.ps1` | warmup | Pre-warms the app so a first request is not slow. |

## Moving them for real

The better end state is one copy, in this repo, with the tasks pointing here.
That is a coordinated change — move the file, update the `.vbs` path, update the
task action, re-prove a run — and Chief asked to be told if the `.ps1` moves,
since the wrapper is his. Not done yet, on purpose.
