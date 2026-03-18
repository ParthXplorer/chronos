#!/usr/bin/env python3
"""
test_reload.py
─────────────────────────────────────────────────────────────────────────────
Tests the restart / reload scenario end-to-end without a database.

Simulates what happens across a server restart:
  Session A  → place orders, engine process killed (restart)
  Session B  → reload those same orders via "load", then submit new orders
               that should match against the reloaded state

Also tests the ping command and edge cases.
"""

import json
import subprocess
import sys
from pathlib import Path

ENGINE = Path(__file__).parent / "engine" / "bin" / "chronos_engine"

# ── IPC helpers ───────────────────────────────────────────────────────────────

def start_engine():
    return subprocess.Popen(
        [str(ENGINE)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, bufsize=1
    )

def send(proc, cmd: str, payload: dict) -> list[dict]:
    msg = json.dumps({"cmd": cmd, **payload}) + "\n\n"
    proc.stdin.write(msg)
    proc.stdin.flush()
    results = []
    while True:
        line = proc.stdout.readline().strip()
        if not line:
            break
        results.append(json.loads(line))
    return results

def stop(proc):
    proc.stdin.close()
    proc.wait()

# ── Test runner ───────────────────────────────────────────────────────────────

passed = failed = 0

def check(name, condition, detail=""):
    global passed, failed
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {name}" + (f": {detail}" if detail else ""))
    if condition: passed += 1
    else:          failed += 1

# ── Tests ─────────────────────────────────────────────────────────────────────

print("\n══ Test: ping ══════════════════════════════════════════")
p = start_engine()
r = send(p, "ping", {})
check("ping returns pong", r == [{"pong": True}], str(r))
stop(p)

print("\n══ Test: reload then match ══════════════════════════════")
# Session A — fill the book, then "kill" the process
p = start_engine()
# Three asks resting at different prices (pre-restart state)
send(p, "load", {"order_id":1,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":150.0,"quantity":100})
send(p, "load", {"order_id":2,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":151.0,"quantity":100})
send(p, "load", {"order_id":3,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":152.0,"quantity":100})
# A partial bid that was never filled
send(p, "load", {"order_id":4,"user_id":2,"symbol":"AAPL","side":"Buy","type":"Limit","limit_price":148.0,"quantity":200})
stop(p)

# Session B — fresh engine, replay the same state
p = start_engine()
r = send(p, "load", {"order_id":1,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":150.0,"quantity":100})
check("load ask 1", r == [{"loaded": True}])
r = send(p, "load", {"order_id":2,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":151.0,"quantity":100})
check("load ask 2", r == [{"loaded": True}])
r = send(p, "load", {"order_id":3,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":152.0,"quantity":100})
check("load ask 3", r == [{"loaded": True}])
r = send(p, "load", {"order_id":4,"user_id":2,"symbol":"AAPL","side":"Buy","type":"Limit","limit_price":148.0,"quantity":200})
check("load bid", r == [{"loaded": True}])

# New buy order sweeps first two ask levels (300 shares, prices 150+151)
r = send(p, "submit", {"order_id":5,"user_id":3,"symbol":"AAPL","side":"Buy","type":"Limit","limit_price":151.5,"quantity":200})
total_qty = sum(f["quantity"] for f in r)
prices    = sorted(set(f["exec_price"] for f in r))
check("sweep 2 reloaded levels — qty=200", total_qty == 200, f"qty={total_qty}")
check("fills at 150.00 and 151.00", prices == [150.0, 151.0], f"prices={prices}")
check("correct fill count (2 fills)", len(r) == 2, f"fills={len(r)}")

# The resting bid from before restart should still be there — submit a sell to hit it
r = send(p, "submit", {"order_id":6,"user_id":3,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":148.0,"quantity":50})
check("reloaded bid still active after sweep", len(r) == 1 and r[0]["quantity"] == 50, str(r))
stop(p)

print("\n══ Test: load does not match ════════════════════════════")
p = start_engine()
# Load a crossing pair — they should NOT match during load
send(p, "load", {"order_id":10,"user_id":1,"symbol":"TSLA","side":"Sell","type":"Limit","limit_price":700.0,"quantity":50})
r = send(p, "load", {"order_id":11,"user_id":2,"symbol":"TSLA","side":"Buy","type":"Limit","limit_price":701.0,"quantity":50})
check("loading a crossing pair produces no trades", r == [{"loaded": True}], str(r))

# Now a real submit should cross them
r = send(p, "submit", {"order_id":12,"user_id":3,"symbol":"TSLA","side":"Buy","type":"Limit","limit_price":700.0,"quantity":10})
check("submit hits the loaded ask", len(r) == 1 and r[0]["exec_price"] == 700.0)
stop(p)

print("\n══ Test: reload preserves time priority ═════════════════")
# Two asks at the same price, loaded in order A then B
# A buy should fill A first (earlier timestamp = better time priority)
p = start_engine()
send(p, "load", {"order_id":20,"user_id":1,"symbol":"INFY","side":"Sell","type":"Limit","limit_price":1450.0,"quantity":30})
send(p, "load", {"order_id":21,"user_id":2,"symbol":"INFY","side":"Sell","type":"Limit","limit_price":1450.0,"quantity":30})
r = send(p, "submit", {"order_id":22,"user_id":3,"symbol":"INFY","side":"Buy","type":"Limit","limit_price":1450.0,"quantity":30})
check("first loaded order matched first (time priority)", 
      len(r) == 1 and r[0]["sell_order_id"] == 20, f"got sell_order_id={r[0]['sell_order_id'] if r else 'none'}")
stop(p)

print("\n══ Test: market order skipped in load ═══════════════════")
p = start_engine()
r = send(p, "load", {"order_id":30,"user_id":1,"symbol":"TCS","side":"Buy","type":"Market","limit_price":0,"quantity":100})
# Engine should still return loaded:true but silently skip placing it
check("market order load returns loaded (but doesn't rest)", r == [{"loaded": True}], str(r))
# Verify it didn't add anything to the book by submitting a sell and getting no match
r = send(p, "submit", {"order_id":31,"user_id":2,"symbol":"TCS","side":"Sell","type":"Limit","limit_price":3600.0,"quantity":100})
check("no market order in book after load", len(r) == 0, str(r))
stop(p)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'═'*54}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'═'*54}\n")
sys.exit(0 if failed == 0 else 1)