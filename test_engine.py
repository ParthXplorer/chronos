#!/usr/bin/env python3
"""
Integration test: Python → C++ engine → parse fills
Runs without a database — just tests the IPC layer.
"""
import json
import subprocess
import sys
from pathlib import Path

ENGINE = Path(__file__).parent / "engine" / "bin" / "chronos_engine"

def send_order(proc, order: dict) -> list[dict]:
    proc.stdin.write(json.dumps(order) + "\n\n")
    proc.stdin.flush()
    fills = []
    while True:
        line = proc.stdout.readline().strip()
        if not line:
            break
        fills.append(json.loads(line))
    return fills

def run_tests():
    proc = subprocess.Popen(
        [str(ENGINE)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, bufsize=1
    )

    passed = failed = 0

    def check(name, fills, expected_qty, expected_price=None):
        nonlocal passed, failed
        total = sum(f["quantity"] for f in fills)
        ok = total == expected_qty
        if expected_price and fills:
            ok = ok and abs(fills[0]["exec_price"] - expected_price) < 0.001
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}: fills={len(fills)}, qty={total}", end="")
        if fills:
            print(f", price={fills[0]['exec_price']:.2f}, fee={fills[0]['fee']:.4f}", end="")
        print()
        if ok: passed += 1
        else:   failed += 1

    print("\n── Test 1: Full cross ──────────────────────────────")
    fills = send_order(proc, {"order_id":1,"user_id":1,"symbol":"AAPL","side":"Sell","type":"Limit","limit_price":150.0,"quantity":100})
    check("resting sell", fills, 0)
    fills = send_order(proc, {"order_id":2,"user_id":2,"symbol":"AAPL","side":"Buy","type":"Limit","limit_price":151.0,"quantity":100})
    check("aggressive buy → full fill", fills, 100, 150.0)

    print("\n── Test 2: Partial fill ────────────────────────────")
    fills = send_order(proc, {"order_id":3,"user_id":1,"symbol":"TSLA","side":"Sell","type":"Limit","limit_price":700.0,"quantity":60})
    check("resting sell 60", fills, 0)
    fills = send_order(proc, {"order_id":4,"user_id":2,"symbol":"TSLA","side":"Buy","type":"Limit","limit_price":700.0,"quantity":100})
    check("aggressive buy 100 → partial fill 60", fills, 60, 700.0)

    print("\n── Test 3: No cross ────────────────────────────────")
    fills = send_order(proc, {"order_id":5,"user_id":1,"symbol":"GOOGL","side":"Sell","type":"Limit","limit_price":2810.0,"quantity":10})
    fills = send_order(proc, {"order_id":6,"user_id":2,"symbol":"GOOGL","side":"Buy","type":"Limit","limit_price":2800.0,"quantity":10})
    check("spread = no match", fills, 0)

    print("\n── Test 4: Market order ────────────────────────────")
    fills = send_order(proc, {"order_id":7,"user_id":1,"symbol":"INFY","side":"Sell","type":"Limit","limit_price":1450.0,"quantity":200})
    check("resting sell", fills, 0)
    fills = send_order(proc, {"order_id":8,"user_id":2,"symbol":"INFY","side":"Buy","type":"Market","limit_price":0,"quantity":50})
    check("market buy 50", fills, 50, 1450.0)

    print("\n── Test 5: Self-trade prevention ───────────────────")
    fills = send_order(proc, {"order_id":9,"user_id":99,"symbol":"MSFT","side":"Sell","type":"Limit","limit_price":300.0,"quantity":10})
    fills = send_order(proc, {"order_id":10,"user_id":99,"symbol":"MSFT","side":"Buy","type":"Limit","limit_price":300.0,"quantity":10})
    check("same user — no trade", fills, 0)

    print("\n── Test 6: Multi-level fill ─────────────────────────")
    # Three asks at different prices, one large buy sweeps them all
    fills = send_order(proc, {"order_id":11,"user_id":1,"symbol":"TCS","side":"Sell","type":"Limit","limit_price":3600.0,"quantity":30})
    fills = send_order(proc, {"order_id":12,"user_id":1,"symbol":"TCS","side":"Sell","type":"Limit","limit_price":3601.0,"quantity":30})
    fills = send_order(proc, {"order_id":13,"user_id":1,"symbol":"TCS","side":"Sell","type":"Limit","limit_price":3602.0,"quantity":30})
    fills = send_order(proc, {"order_id":14,"user_id":2,"symbol":"TCS","side":"Buy","type":"Limit","limit_price":3605.0,"quantity":90})
    check("sweep 3 ask levels → 3 fills, 90 qty", fills, 90)
    print(f"     fill prices: {[f['exec_price'] for f in fills]}")

    print("\n── Test 7: Fee calculation ──────────────────────────")
    # 100 shares @ 200.00 = notional 20000, fee = 0.01% = 2.00
    fills = send_order(proc, {"order_id":15,"user_id":1,"symbol":"WIP","side":"Sell","type":"Limit","limit_price":200.0,"quantity":100})
    fills = send_order(proc, {"order_id":16,"user_id":2,"symbol":"WIP","side":"Buy","type":"Limit","limit_price":200.0,"quantity":100})
    expected_fee = round(200.0 * 100 * 0.0001, 2)
    ok = fills and abs(fills[0]["fee"] - expected_fee) < 0.001
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] fee: expected={expected_fee}, got={fills[0]['fee'] if fills else 'no fills'}")
    if ok: passed += 1
    else:   failed += 1

    proc.stdin.close()
    proc.wait()

    print(f"\n{'═'*46}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'═'*46}\n")
    return failed

if __name__ == "__main__":
    sys.exit(run_tests())