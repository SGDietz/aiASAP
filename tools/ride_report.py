"""One-command aiASAP ride report, straight from Supabase. Free (reads only).

    python ride_report.py                 # latest session
    python ride_report.py 755f063f        # a session id prefix
    python ride_report.py --since 3h      # every session in the window

Counts the faults G's 2026-09-05 smoke ride surfaced, so the next ride is
checkable in seconds instead of an hour of hand queries:
  - filler shards answered ("Um," -> a full reply)
  - replies written vs actually spoken
  - 6 cut off mid-line (provider partial rows)
  - opener interrupted by a reply
  - list hijacks (list_action rows)
  - avatar stalls / deferrals / audio recoveries
  - photos uploaded and whether the analysis existed
  - phrases 6 reused across replies
  - error_logs rows for the session
Requires SUPABASE_ACCESS_TOKEN in the environment (Management API, runs as
postgres). Never touches a money endpoint.
"""
import json, re, sys, urllib.error, urllib.request
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TOKEN_ENV = "SUPABASE_ACCESS_TOKEN"
REF = "wqszxsqzkaatghyrqviv"
TZ = "America/New_York"

def q(sql):
    import os
    tok = os.environ.get(TOKEN_ENV)
    if not tok:
        sys.exit(f"{TOKEN_ENV} not set")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json",
                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"query failed {e.code}: {e.read().decode()[:400]}")

FILLERS = set("""um uh er ah eh hmm hm mm mhm huh oh so and but or like well anyway anyways
i im ill ive id you youre we were it its this that thats these those the a an to of in on at for
with by from is was are be am been being do does did have has had can could will would should gonna
wanna just kind sort know mean guess think actually basically literally cause because then there here
now also really very still even maybe if as up out about""".split())

def plain(t):
    return (t or "").replace("’", "'").replace("‘", "'")

def words(t):
    return [w for w in re.sub(r"[^a-z0-9' ]+", " ", plain(t).lower()).split() if w]

def is_filler_only(t):
    ws = words(t)
    return 0 < len(ws) <= 4 and all(w.replace("'", "") in FILLERS for w in ws)

def esc(s): return s.replace("'", "''")

def pick_session(arg):
    if arg and arg.startswith("--since"):
        return None
    if arg:
        rows = q(f"select session_id, min(created_at) s from conversation_messages where session_id like '{esc(arg)}%' group by 1 order by 2 desc limit 1")
    else:
        rows = q("select session_id, max(created_at) s from conversation_messages where session_id is not null group by 1 order by 2 desc limit 1")
    if not rows:
        sys.exit("no session found")
    return rows[0]["session_id"]

def report(sid):
    msgs = q(f"""select role, source, message, utterance_id,
        extract(epoch from created_at) as t, to_char(created_at at time zone '{TZ}','HH24:MI:SS') as hm
        from conversation_messages where session_id='{esc(sid)}' order by created_at""")
    evs = q(f"""select event_type, severity, payload::text p, extract(epoch from created_at) as t,
        to_char(created_at at time zone '{TZ}','HH24:MI:SS') as hm
        from app_events where session_id='{esc(sid)}' order by created_at""")
    if not msgs and not evs:
        sys.exit(f"nothing stored for session {sid}")
    for r in msgs + evs:  # numeric comes back as a JSON string
        r["t"] = float(r["t"])
    t0 = min([m["t"] for m in msgs] + [e["t"] for e in evs])
    t1 = max([m["t"] for m in msgs] + [e["t"] for e in evs])
    errs = q(f"""select level, route, left(message,120) m, to_char(created_at at time zone '{TZ}','HH24:MI:SS') hm
        from error_logs where created_at between to_timestamp({t0-5}) and to_timestamp({t1+5})
        and (session_id='{esc(sid)}' or session_id is null) order by created_at""")
    objs = q(f"""select name, metadata->>'size' sz from storage.objects where bucket_id='aiasap-media'
        and name like '{esc(sid)}/%' order by created_at""")

    ec = Counter(e["event_type"] for e in evs)
    def payload(e):
        try: return json.loads(e["p"] or "{}")
        except Exception: return {}

    user = [m for m in msgs if m["role"] == "user" and (m["source"] or "") != "liveavatar_api_fragment"]
    six_app = [m for m in msgs if m["role"] == "assistant" and (m["source"] or "") in ("app", "liveavatar_api")]
    partials = [m for m in msgs if m["role"] == "assistant" and (m["source"] or "") == "liveavatar_api_partial"]

    # filler shards that got a reply within 3s
    answered_fillers = []
    for u in user:
        if is_filler_only(u["message"]):
            reply = next((a for a in six_app if 0 <= a["t"] - u["t"] <= 3.0), None)
            if reply:
                answered_fillers.append((u["hm"], u["message"], reply["message"][:60]))

    # opener cut: a reply landed while the opener should still be playing
    opener_cut = None
    if six_app:
        op = six_app[0]
        op_len = len(op["message"] or "")
        op_end = op["t"] + min(16.0, 1.0 + op_len / 14.0)
        early = [a for a in six_app[1:] if a["t"] < op_end]
        if early:
            opener_cut = (early[0]["hm"], round(early[0]["t"] - op["t"], 1), early[0]["message"][:60])
        # The provider's own record is the proof: a PARTIAL row that is a prefix
        # of the opener means the opener was heard to stop early.
        op_norm = " ".join(words(op["message"]))
        six_all = [m for m in msgs if m["role"] == "assistant" and m is not op]
        for pr in six_all:
            pn = " ".join(words(pr["message"]))
            if len(pn) >= 20 and op_norm.startswith(pn) and pn != op_norm:
                opener_cut = (pr["hm"], f"stopped after {len(pn.split())}/{len(op_norm.split())} words", pr["message"][-40:])
                break

    emitted = ec.get("voice_speech_emitted", 0)
    spoken = ec.get("voice_avatar_speak_started", 0)
    held = Counter(); flushed = Counter(); dropped = Counter()
    for e in evs:
        p = payload(e)
        if e["event_type"] == "user_turn_held": held[p.get("reason", "hold")] += 1
        if e["event_type"] == "user_turn_flushed": flushed[p.get("reason", "flush")] += 1
        if e["event_type"] == "user_turn_dropped": dropped[p.get("reason", "?")] += 1
    stalls = [(e["hm"], payload(e).get("reason")) for e in evs if e["event_type"] == "avatar_speech_stalled"]
    pres = Counter(payload(e).get("stage") for e in evs if e["event_type"] == "voice_avatar_media_presentation")
    lists = [(e["hm"], payload(e).get("spoken") or payload(e).get("added")) for e in evs if e["event_type"] in ("list_action_receipt",)]
    ua = next((payload(e).get("user_agent", "")[:70] for e in evs if e["event_type"] == "session_started"), "?")
    retry = ec.get("voice_start_retry_scheduled", 0)
    superseded = ec.get("voice_brain_request_superseded", 0)

    # RIDE f225a5c7 2026-09-05: "So: you want..." five times in fifteen seconds
    # (screen coaching restated as receipts). Count receipts and the worst minute.
    receipts = [a for a in six_app if re.match(r"\s*So:\s", plain(a["message"]))]
    worst_minute = 0
    for r in receipts:
        worst_minute = max(worst_minute, sum(1 for o in receipts if 0 <= o["t"] - r["t"] < 60))

    # The APP owns these lines; the brain said them on rides c25f52ab (gate) and
    # f225a5c7 (record notice). Any of them in a brain reply is a finding.
    APP_ONLY_OPENERS = ("let's get you set up so nothing gets lost", "no problem, no account needed",
                        "quick and honest", "i write down what we say")
    scripted = [(a["hm"], a["message"][:70]) for a in six_app
                if any(plain(a["message"]).lower().startswith(o) or o in plain(a["message"]).lower()[:120] for o in APP_ONLY_OPENERS)]

    # RIDE c25f52ab 2026-09-05: "I'm a musician too" was stored as the NAME and
    # Scott was greeted as a stranger later. Show every name capture beside the
    # user line that caused it, so a junk capture is visible without a ride.
    name_caps = []
    for e in evs:
        p = payload(e)
        if e["event_type"] == "t6" and p.get("p") == "name_captured":
            cause = next((u for u in reversed(user) if u["t"] <= e["t"] + 0.5), None)
            name_caps.append((e["hm"], (cause["message"] or "")[:60] if cause else "?"))

    # phrases reused across 6's replies (3-grams present in >=3 distinct lines)
    grams = Counter()
    for a in six_app:
        ws = words(a["message"])
        seen = set(" ".join(ws[i:i+3]) for i in range(len(ws) - 2))
        for g in seen: grams[g] += 1
    reused = [(g, n) for g, n in grams.most_common(40) if n >= 3 and not all(w in FILLERS for w in g.split())][:6]

    photos = [(o["name"].rsplit("/", 1)[-1], o["sz"]) for o in objs if not o["name"].endswith(".json")]
    sidecars = [o for o in objs if o["name"].endswith(".json")]
    denies = [(a["hm"], a["message"][:70]) for a in six_app
              if re.search(r"(can'?t|cannot|isn'?t|not) (see|in) .*(picture|photo|image)", plain(a["message"]), re.I)]

    # 2026-09-05 09:46: "I'll upload a picture, okay?" -> "the team will get you a
    # link". The GALLERY button is right there; sending them off to a link is wrong.
    upload_derails = []
    for u in user:
        if re.search(r"\b(upload|send you|show you|picture|photo|image|video)\b", plain(u["message"]), re.I):
            reply = next((a for a in six_app if 0 <= a["t"] - u["t"] <= 6.0), None)
            if reply and re.search(r"get you a link|straight off your phone|send them", plain(reply["message"]), re.I):
                upload_derails.append((u["hm"], u["message"][:50], reply["message"][:60]))

    dur = t1 - t0
    print(f"RIDE {sid[:8]}  {msgs[0]['hm'] if msgs else '?'}-{msgs[-1]['hm'] if msgs else '?'} ET  {dur/60:.1f} min  {ua}")
    print(f"  turns: {len(user)} user / {len(six_app)} from 6   replies written {emitted} / spoken {spoken}  -> {max(0, emitted - spoken)} never spoken")
    print(f"  6 cut off mid-line: {len(partials)}   start retry: {retry}   stalls: {len(stalls)} {stalls[:3] if stalls else ''}")
    print(f"  intake: held {dict(held)}  flushed {dict(flushed)}  dropped {dict(dropped)}")
    print(f"  presentation: presented {pres.get('media_presented',0)}  deferred_hidden {pres.get('deferred_page_hidden',0)}  audio_recovery {pres.get('audio_recovery_started',0)}")
    print(f"  filler shards ANSWERED: {len(answered_fillers)}")
    for hm, u, r in answered_fillers[:8]:
        print(f"     {hm}  {u!r:26} -> {r!r}")
    print(f"  opener cut by a reply: {opener_cut or 'no'}")
    print(f"  list hijacks: {len(lists)} {lists[:3] if lists else ''}")
    print(f"  name captures: {len(name_caps)}" + ("" if not name_caps else "  " + "; ".join(f"{hm} <- {c!r}" for hm, c in name_caps[:4])))
    print(f"  brain requests cancelled by a newer turn: {superseded}")
    print(f"  'So:' receipts: {len(receipts)} (worst minute {worst_minute})")
    print(f"  app-owned lines spoken by the brain: {len(scripted)} {scripted[:3] if scripted else ''}")
    print(f"  upload -> 'we'll send a link' derails: {len(upload_derails)} {upload_derails[:2] if upload_derails else ''}")
    print(f"  photos: {len(photos)} uploaded, {len(sidecars)} sidecars, 6 denied seeing one: {len(denies)} {denies[:2] if denies else ''}")
    print(f"  phrases 6 reused (3+ replies): {reused or 'none'}")
    print(f"  error_logs rows in window: {len(errs)}")
    for e in errs[:6]:
        print(f"     {e['hm']} {e['level']:5} {e['route'] or '':22} {e['m']}")
    print(f"  other events: " + ", ".join(f"{k}={v}" for k, v in ec.most_common(8)))

def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "--since":
        window = sys.argv[2] if len(sys.argv) > 2 else "3h"
        n, unit = int(window[:-1]), {"h": "hours", "m": "minutes", "d": "days"}[window[-1]]
        rows = q(f"select distinct session_id from conversation_messages where session_id is not null and created_at > now() - interval '{n} {unit}' order by 1")
        for r in rows:
            report(r["session_id"]); print()
        return
    report(pick_session(arg))

if __name__ == "__main__":
    main()
