"""LEGACY provider mirror — DISABLED BY DEFAULT since 2026-08-21.

G, 2026-08-21: "get the context window off of live avatar and into the code base
so that we don't have a sixty three thousand character limit. It can be unlimited."

THE MOVE IS DONE, AND MOSTLY IT WAS ALREADY DONE:

  6's brain in production is `src/lib/brain/sixSystemPrompt.ts`, generated from
  `tools/cw_6af8624c_prompt.txt` and imported by
  `app/api/openai-chat-complete/route.ts` (:25) as the system prompt. Nothing in
  that path caps the prompt — not the route, not buildConversationMessages.

  Production runs CUSTOM mode (proven 2026-08-21 by reading the DEPLOYED bundle:
  it selects FULL only for ?mode=full), and the CUSTOM mint sends NO context_id.
  Production also defines no LIVEAVATAR_CONTEXT_ID at all. So the LiveAvatar
  context window is NOT the brain and has not been for some time.

THE ONLY THING STILL IMPOSING A LIMIT WAS THIS SCRIPT.

  LiveAvatar truncates a context at 65,535 characters. This script refused to
  PATCH above it, which in practice capped how big 6's brain was allowed to get —
  a provider constraint leaking into a file the provider no longer reads. The
  source file passed that cap on 2026-08-21 (65,904 chars) and the runtime did
  not notice, because the runtime never cared.

  So: mirroring is now OFF. The codebase is the single source of truth and the
  prompt may grow past 65,535. The real ceiling is the MODEL's context window
  (gpt-4o-mini: ~128k tokens; 65,904 chars is roughly 16k tokens) and the cost of
  sending it on every turn — not a hard cap.

If you ever genuinely need the provider copy back (you should not — nothing reads
it), run with --force-legacy-mirror and accept that ANY content past 65,535
characters is silently CUT by LiveAvatar, mid-sentence, exactly as it cut the
SAFETY tail on 2026-06-03.
"""

import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path

PROMPT_FILE = Path(__file__).resolve().parent / "cw_6af8624c_prompt.txt"
PROVIDER_TRUNCATES_AT = 65535


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-legacy-mirror",
        action="store_true",
        help="PATCH the LiveAvatar context anyway. Content past 65,535 chars is CUT by the provider.",
    )
    args = parser.parse_args()

    prompt = PROMPT_FILE.read_text(encoding="utf-8")
    print(f"source of truth : {PROMPT_FILE}")
    print(f"prompt length   : {len(prompt)} chars  (~{len(prompt)//4} tokens)")
    print(f"runtime cap     : NONE — src/lib/brain/sixSystemPrompt.ts is sent whole")

    if not args.force_legacy_mirror:
        print()
        print("MIRRORING IS OFF. The LiveAvatar context is no longer 6's brain and")
        print("nothing in production reads it. Regenerate the code brain instead:")
        print(r"  python C:\Users\sgdie\Documents\Claude\Scheduled\regen_six_system_prompt.py")
        print()
        print("Pass --force-legacy-mirror only if you truly want the provider copy")
        print(f"updated, and accept truncation above {PROVIDER_TRUNCATES_AT} chars.")
        return

    env = load_env()
    api_url = env.get("LIVEAVATAR_API_URL", "https://api.liveavatar.com").rstrip("/")
    context_id = env["LIVEAVATAR_CONTEXT_ID"]
    api_key = env["LIVEAVATAR_API_KEY"]

    if len(prompt) > PROVIDER_TRUNCATES_AT:
        print()
        print(f"WARNING: {len(prompt)} chars exceeds the provider limit of {PROVIDER_TRUNCATES_AT}.")
        print(f"LiveAvatar will SILENTLY CUT the last {len(prompt) - PROVIDER_TRUNCATES_AT} characters.")
        print("The code brain keeps the full text; only this mirror is truncated.")

    print(f"PATCHing context_id={context_id[:8]}…")
    url = f"{api_url}/v1/contexts/{context_id}"
    body = json.dumps(
        {
            "name": "2.1 aiASAP 6 - Working Version",
            "prompt": prompt,
            "opening_text": "",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "X-API-KEY": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "aiASAP/0.1",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
            print(f"SUCCESS context updated code={data.get('code')}")
    except urllib.error.HTTPError as error:
        print(f"HTTP {error.code}")
        print(error.read().decode("utf-8", errors="replace")[:2000])
        raise SystemExit(1)


if __name__ == "__main__":
    main()
