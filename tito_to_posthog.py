import os, sys, json, uuid, urllib.request, urllib.parse

ACCOUNT = "crafthub"
EVENTS = ["craft-conference-%d" % y for y in range(2022, 2028)]
PH_HOST = "https://eu.i.posthog.com"
PH_KEY = "phc_tTbnxK33tMddFPNzEiiP8LYdBjJa9vk9VEyCVKDCiMbH"
TOKEN = os.environ.get("TITO_API_TOKEN")
DRY = "--dry-run" in sys.argv
INSPECT = "--inspect" in sys.argv
for a in sys.argv:
    if a.startswith("--events="):
        EVENTS = a.split("=", 1)[1].split(",")
if not TOKEN:
    sys.exit("TITO_API_TOKEN is not set")

def tito(path, **q):
    url = "https://api.tito.io/v3/%s/%s?%s" % (ACCOUNT, path, urllib.parse.urlencode(q))
    req = urllib.request.Request(url, headers={"Authorization": "Token token=" + TOKEN, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def pages(path, key, **q):
    p = 1
    while True:
        d = tito(path, page=p, per_page=1000, **q)
        rows = d.get(key, [])
        yield from rows
        if not d.get("meta", {}).get("next_page"):
            break
        p += 1

def capture(batch):
    body = json.dumps({"api_key": PH_KEY, "batch": batch}).encode()
    req = urllib.request.Request(PH_HOST + "/batch/", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status

def net_of(t, price, r):
    # A jegyen nincs ÁFA-mező; a release price_ex_tax/price aránya adja a nettót
    # (tax_exclusive=False minden release-nél, azaz a price bruttó).
    rp = float(r.get("price") or 0)
    if r.get("tax_exclusive"):
        return price
    if rp > 0 and r.get("price_ex_tax") is not None:
        return price * float(r["price_ex_tax"]) / rp
    return price

def is_void_or_test(t):
    # Tito v3 ticket: void (bool), test_mode (bool), state (str)
    return bool(t.get("void")) or bool(t.get("test_mode")) or str(t.get("state") or "").lower() == "void"

if INSPECT:
    t = next(pages("craft-conference-2027/tickets", "tickets"))
    print({k: type(v).__name__ for k, v in t.items()})
    sys.exit(0)

total = 0
for ev in EVENTS:
    rel = {r["id"]: r for r in pages("%s/releases" % ev, "releases")}
    batch, gross, net = [], 0.0, 0.0
    for t in pages("%s/tickets" % ev, "tickets"):
        if is_void_or_test(t):
            continue
        r = rel.get(t.get("release_id"), {})
        price = float(t.get("price") or 0)
        n = net_of(t, price, r)
        batch.append({
            "event": "ticket_sold",
            "distinct_id": "tito:" + ev,
            "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "tito:%s:%s" % (ev, t["slug"]))),
            "timestamp": t.get("created_at"),
            "properties": {
                "tito_event": ev,
                "conference_year": int(ev.split("-")[-1]),
                "release": r.get("title") or t.get("release_title"),
                "price_eur": price,
                "net_eur": round(n, 2),
                "is_free": price == 0,
                "discount_code": t.get("discount_code_used"),
                "$process_person_profile": False,
            },
        })
        gross += price
        net += n
    print(ev, len(batch), "tickets, gross", round(gross, 2), "net", round(net, 2))
    total += len(batch)
    if not DRY:
        for i in range(0, len(batch), 200):
            capture(batch[i:i + 200])
print("done", total, "dry-run" if DRY else "sent")
