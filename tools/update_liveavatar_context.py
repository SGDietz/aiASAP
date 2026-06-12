import json
import urllib.error
import urllib.request
from pathlib import Path


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    return values


# The 6af8624c prompt is kept in a reviewable, version-controlled sibling file
# (cw_6af8624c_prompt.txt) rather than inline. WHY: a prior inline/append history
# grew the prompt past LiveAvatar's hard 65535-char (64KB) cap, so the live CW was
# silently TRUNCATED mid-sentence (cut the SAFETY tail) on 2026-06-03. File-sourcing
# keeps the repo and the live CW in sync, and the guard below refuses to PATCH
# anything that would truncate again. Pre-slim backup of the truncated version lives
# at Scheduled/cw_6af8624c_live_2026-06-03.txt.
PROMPT_FILE = Path(__file__).resolve().parent / "cw_6af8624c_prompt.txt"
MAX_PROMPT_LEN = 65535


def main() -> None:
    env = load_env()
    api_url = env.get("LIVEAVATAR_API_URL", "https://api.liveavatar.com").rstrip("/")
    context_id = env["LIVEAVATAR_CONTEXT_ID"]
    api_key = env["LIVEAVATAR_API_KEY"]

    prompt = PROMPT_FILE.read_text(encoding="utf-8")
    if len(prompt) >= MAX_PROMPT_LEN:
        raise SystemExit(
            f"REFUSING TO PATCH: prompt is {len(prompt)} chars; LiveAvatar truncates "
            f"at {MAX_PROMPT_LEN}. Slim the prompt below the cap first."
        )
    print(f"context_id={context_id[:8]}  prompt_len={len(prompt)} (cap {MAX_PROMPT_LEN})")

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
