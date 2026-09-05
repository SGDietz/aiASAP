"""READY TO RIDE - one command, zero spend, before G opens 6.

    python ready_to_ride.py

Answers "can I hand G this front door?" with measurements, not impressions
(G ENRAGED 2026-06-21 over unseen UI; 2026-09-05 the legal line was clipped
2.8px and nobody had measured it at his real viewport). Runs still.mjs at
gphone-412x758 (his Chrome viewport), holds the session bootstrap so nothing
mints, then checks:
  - :3001 answers 200; the shot recorded zero session calls and zero exceptions
  - wordmark has air at the top; tagline clear of the wordmark and of 6's hair
  - legal line ends above the bottom edge; WildWorks row clear of the legal ink
  - the four chest controls: both rows level, labels aligned, QUIET icon <= 40px
  - Supabase error_logs: no error/fatal rows in the last 30 minutes (needs
    SUPABASE_ACCESS_TOKEN; skipped, not failed, without it)
  - dev server err log: no "Failed to compile"
Prints READY TO RIDE or NOT READY with every failing line.
"""
import json, os, subprocess, sys, urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
STILL = os.path.join(HERE, "still.mjs")
OUT = os.path.join(HERE, "ready-shots")
# G'S REAL PHONE is 444x818 (measured 2026-09-05 15:01 off his screenshot: 2.43 dpr). The 412x758
# Pixel size is still worth a run: RIDE_VIEW=gphone-412x758 python tools/ready_to_ride.py
VIEW = os.environ.get("RIDE_VIEW", "gphone-444x818")
HANDS_FRACTION = 655 / 690  # lowest skin row of startscreen-noband.png, measured
BAR_H = 65  # G 2026-09-05 15:42: bar 10% shorter
HAIR_FRACTION = (101 + 14) / 738.4  # hair top read off G's 09:46 screenshot vs the frame box
ERR_LOG = r"C:\Users\sgdie\Documents\Claude\Scheduled\aiasap_dev_3001.err.log"

fails, notes = [], []
def check(ok, msg):
    (notes if ok else fails).append(("ok   " if ok else "FAIL ") + msg)

# 1. server up
try:
    code = urllib.request.urlopen("http://127.0.0.1:3001/", timeout=60).status
except Exception as e:
    code = str(e)
check(code == 200, f":3001 -> {code}")

# 2. free still shot at G's viewport
env = dict(os.environ, ONLY_VIEW=VIEW)
run = subprocess.run(["node", STILL, OUT], capture_output=True, text=True, env=env, timeout=240, encoding="utf-8", errors="replace")
txt = run.stdout
i = txt.find(VIEW)
if i < 0:
    fails.append("FAIL still.mjs produced no measurements:\n" + (run.stderr or txt)[-800:])
else:
    j = txt.find("\n}", i)
    d = json.loads(txt[i + len(VIEW):j + 2].strip())
    vh = d["vh"]
    check(d["sessionCalls"] == [], f"session calls during the shot: {d['sessionCalls']} (must be none - nothing minted)")
    check(d["exceptions"] == 0, f"page exceptions: {d['exceptions']}")
    h1, tag, frame = d["h1"], d["tagP"], d["frame"]
    check(h1 and h1["y"] >= 0, f"wordmark box top {h1 and h1['y']}px (>= 0)")
    tag_bottom = tag["y"] + tag["h"]
    hair = frame["y"] + HAIR_FRACTION * frame["h"]
    check(tag_bottom <= hair - 12, f"tagline bottom {tag_bottom:.1f} vs hair {hair:.1f}: {hair - tag_bottom:.1f}px air (>= 12)")
    check(tag["y"] >= h1["y"] + 40, f"tagline top {tag['y']} vs wordmark top {h1['y']}: gap {tag['y'] - h1['y']:.1f}px (>= 40)")
    hands = frame["y"] + HANDS_FRACTION * frame["h"]
    # G 15:17: fingertips 4px above the bar still read as "cut off" - he wants shirt and floor
    # under the hands, so the WHOLE still must sit above the bar (frame bottom <= bar top).
    check(hands <= vh - BAR_H - 20, f"hands bottom {hands:.1f} vs bar top {vh - BAR_H}: {vh - BAR_H - hands:.1f}px of shirt/floor (>= 20)")
    check(frame["y"] + frame["h"] <= vh - BAR_H + 0.5, f"frame bottom {frame['y'] + frame['h']:.1f} vs bar top {vh - BAR_H} (whole still above the bar)")
    check(abs(frame["y"]) <= 0.5, f"frame top {frame['y']}px (flush: no bar above 6, nothing cropped)")
    legal, ww = d["legal"], d["wildworks"]
    legal_ink_bottom = legal["y"] + legal["h"] - 5  # 24px nav box, ~14px ink centred
    check(legal_ink_bottom <= vh - 8, f"legal ink bottom {legal_ink_bottom:.1f} vs edge {vh}: {vh - legal_ink_bottom:.1f}px air (>= 8)")
    legal_ink_top = legal["y"] + 5
    ww_bottom = ww["y"] + ww["h"] if ww else None
    check(ww is not None and ww_bottom + 8 <= legal_ink_top, f"WildWorks row bottom {ww_bottom} vs legal ink top {legal_ink_top:.1f}: {legal_ink_top - (ww_bottom or 0):.1f}px (>= 8)")
    stack = d["stack"]
    check(stack and stack["y"] <= ww["y"] - 4, f"brown stack top {stack and stack['y']} vs WildWorks row {ww['y']} (band starts above the row)")
    c = {x["id"]: x for x in d["controls"]}
    def centre(x): return x["svg"]["y"] + x["svg"]["h"] / 2
    for a, b in (("start", "gallery"), ("mute", "quiet")):
        if a in c and b in c:
            dc = abs(centre(c[a]) - centre(c[b])); dl = abs(c[a]["label"]["y"] - c[b]["label"]["y"])
            # 2026-09-05 13:40, G: "not the same latitude". Centres WERE level (0.00) and he still saw it: the
            # two glyphs he shrunk 10% have shorter ink, so their TOP edges sat 1.4px lower. The CSS now lifts
            # START and QUIET 1.4px so ink TOPS match; the box centres therefore differ by ~1.4px on purpose.
            # The lift is keyed to the icon box (-0.0406 of --stage-open-icon-size): 1.4px at 34.5, 1.1px at the
            # phone's 27px box after the 13:50 shrink. Measure the expectation off the box, never a constant.
            lift = round(c[a]["svg"]["h"] * 0.0406, 2)
            check(abs(dc - lift) <= 0.3 and dl <= 0.5, f"{a.upper()}/{b.upper()} level by ink top: box centres {dc:.2f}px apart (lift {lift} = 0.0406 x {c[a]['svg']['h']}px box), labels {dl:.2f}px apart")
    if "quiet" in c:
        check(c["quiet"]["svg"]["w"] <= 40, f"QUIET icon box {c['quiet']['svg']['w']}px (<= 40, the -10% order)")
    if "start" in c:
        # G 2026-09-05: "of the triangle on start, make the triangle ten percent smaller" -> scale 0.959 like the STOP square.
        st = c["start"]["svgTransform"] or ""
        check(st.startswith("matrix(0.959"), f"START triangle transform {st} (expects scale 0.959, the -10% order)")
    notes.append(f"shot -> {os.path.join(OUT, 'shots', VIEW + '.png')}")

# 3. Supabase errors in the last 30 minutes (optional)
tok = os.environ.get("SUPABASE_ACCESS_TOKEN")
if tok:
    try:
        req = urllib.request.Request(
            "https://api.supabase.com/v1/projects/wqszxsqzkaatghyrqviv/database/query",
            data=json.dumps({"query": "select level, route, left(message,100) m from error_logs where level in ('error','fatal') and created_at > now() - interval '30 minutes' order by created_at desc limit 5"}).encode(),
            headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
        rows = json.loads(urllib.request.urlopen(req, timeout=60).read())
        check(len(rows) == 0, f"error_logs error/fatal in last 30 min: {len(rows)} {rows[:2] if rows else ''}")
    except Exception as e:
        notes.append(f"skip error_logs check: {e}")
else:
    notes.append("skip error_logs check: SUPABASE_ACCESS_TOKEN not set")

# 4. dev server compile errors
try:
    tail = open(ERR_LOG, "rb").read()[-6000:].decode("utf-8", "replace")
    check("Failed to compile" not in tail and "Module not found" not in tail, "dev err log: no compile failure in the tail")
except Exception as e:
    notes.append(f"skip err log: {e}")

for n in notes: print(n)
for f in fails: print(f)
print("\nREADY TO RIDE" if not fails else f"\nNOT READY - {len(fails)} check(s) failed")
sys.exit(0 if not fails else 1)
