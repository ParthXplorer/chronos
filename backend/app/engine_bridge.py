"""
backend/app/engine_bridge.py
─────────────────────────────────────────────────────────────────────────────
Manages the long-lived C++ matching engine subprocess.

Public API
──────────
    reload_open_orders(db)   Called once at startup — replays all OPEN/PARTIAL
                             orders into the engine so in-memory book state
                             matches the DB after a restart.

    submit_order(db, order)  Called per POST /orders — sends the order,
                             collects fills, persists everything to DB.

    ping()                   Health check — True if engine is alive.

    shutdown_engine()        Graceful shutdown on app exit.

IPC protocol (see engine/src/main.cpp for full spec)
─────────────────────────────────────────────────────
    Send:  one JSON line + blank line  →  stdin
    Recv:  zero-or-more JSON lines + blank line  ←  stdout

Commands:  "submit" | "load" | "ping"
"""

import json
import logging
import subprocess
import threading
from decimal import Decimal
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session
from app import models

log = logging.getLogger("engine_bridge")

# ── Binary path ───────────────────────────────────────────────────────────────
_ENGINE_PATH = (
    Path(__file__).resolve().parent.parent.parent / "engine" / "bin" / "chronos_engine"
)

# ── Singleton process + mutex ─────────────────────────────────────────────────
_proc: Optional[subprocess.Popen] = None
_lock = threading.Lock()


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_engine() -> subprocess.Popen:
    """Return the running engine process, (re)starting it if necessary."""
    global _proc
    if _proc is None or _proc.poll() is not None:
        if not _ENGINE_PATH.exists():
            raise RuntimeError(
                f"Matching engine binary not found at {_ENGINE_PATH}.\n"
                "Build it with:\n"
                "  cd engine && mkdir -p bin\n"
                "  g++ -std=c++17 -O2 -Iinclude src/main.cpp "
                "src/MatchingEngine.cpp -o bin/chronos_engine"
            )
        log.info("Starting C++ matching engine: %s", _ENGINE_PATH)
        _proc = subprocess.Popen(
            [str(_ENGINE_PATH)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,   # line-buffered — essential for readline() protocol
        )
    return _proc


def _send_raw(cmd: str, payload: dict) -> list[dict]:
    """
    Core IPC call — MUST be called with _lock held.

    Serialises {"cmd": cmd, ...payload} to the engine stdin, then reads
    response lines until the blank-line terminator.  Returns all parsed
    JSON objects received before the terminator.
    """
    engine = _get_engine()
    message = json.dumps({"cmd": cmd, **payload}) + "\n\n"
    engine.stdin.write(message)
    engine.stdin.flush()

    results: list[dict] = []
    while True:
        line = engine.stdout.readline()
        if line is None:
            log.warning("Engine stdout closed unexpectedly")
            break
        line = line.strip()
        if not line:
            break   # blank line = end of this response
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError as exc:
            log.warning("Bad JSON from engine: %r — %s", line, exc)

    return results


def _order_payload(order: models.Order) -> dict:
    return {
        "order_id":    order.Order_ID,
        "user_id":     order.User_ID,
        "symbol":      order.Symbol,
        "side":        order.Side,
        "type":        order.Type,
        "limit_price": float(order.Limit_Price or 0),
        "quantity":    order.Rem_Qty,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def ping() -> bool:
    """Return True if the engine process is alive and responding."""
    try:
        with _lock:
            results = _send_raw("ping", {})
        return bool(results and results[0].get("pong"))
    except Exception as exc:
        log.error("Engine ping failed: %s", exc)
        return False


def reload_open_orders(db: Session) -> int:
    """
    Replay all OPEN and PARTIAL limit orders from the DB into the engine's
    in-memory order books.  Must be called once at application startup,
    before any orders are submitted.

    Replay order: ascending Timestamp — preserves price-time priority.
    No matching occurs; each order is placed directly onto the book via the
    "load" command.

    Returns the count of orders successfully loaded.
    """
    open_orders = (
        db.query(models.Order)
        .filter(models.Order.Status.in_(["OPEN", "PARTIAL"]))
        .order_by(models.Order.Timestamp.asc())
        .all()
    )

    if not open_orders:
        log.info("reload_open_orders: book starts empty (no open orders in DB)")
        return 0

    log.info("reload_open_orders: replaying %d orders...", len(open_orders))
    loaded = errors = 0

    with _lock:
        for order in open_orders:
            # Market orders should never be in OPEN/PARTIAL state, but skip
            # defensively — they have no limit_price and can't rest on the book.
            if order.Type == "Market":
                log.warning(
                    "Skipping market order %d (status=%s) during reload",
                    order.Order_ID, order.Status,
                )
                continue

            try:
                resp = _send_raw("load", _order_payload(order))
                if resp and resp[0].get("loaded"):
                    loaded += 1
                else:
                    log.warning(
                        "Engine rejected load for order %d: %s",
                        order.Order_ID, resp,
                    )
                    errors += 1
            except Exception as exc:
                log.error("Failed to load order %d: %s", order.Order_ID, exc)
                errors += 1

    log.info("reload_open_orders: %d loaded, %d errors", loaded, errors)
    return loaded


def submit_order(db: Session, order: models.Order) -> list[dict]:
    """
    Submit a newly created order to the engine and persist any fills.

    Returns list of fill dicts — empty if the order rested without matching.
    """
    with _lock:
        fills = _send_raw("submit", _order_payload(order))

    if fills:
        _persist_fills(db, fills)

    return fills


# ─────────────────────────────────────────────────────────────────────────────
# DB persistence
# ─────────────────────────────────────────────────────────────────────────────

def _persist_fills(db: Session, fills: list[dict]) -> None:
    """
    Write a batch of engine fills to the database in a single transaction.

    Per fill:
      1. INSERT TRADES row  →  after_trade_insert trigger fires:
           • Updates HOLDINGS (weighted-avg cost basis on buy side)
           • Writes HOLDING_LOG entries for both parties
      2. UPDATE ORDERS (Rem_Qty, Status) for both sides
      3. Release buyer's Reserved_Balance for the filled notional
      4. Debit buyer's Wallet_Balance by the actual cost
      5. Credit seller's Wallet_Balance (proceeds minus fee)
    """
    try:
        for fill in fills:
            qty        = int(fill["quantity"])
            exec_price = Decimal(str(fill["exec_price"]))
            fee        = Decimal(str(fill["fee"]))
            buy_id     = int(fill["buy_order_id"])
            sell_id    = int(fill["sell_order_id"])

            # 1 ── Trade row ───────────────────────────────────────────────────
            db.add(models.Trade(
                Buy_Order_ID  = buy_id,
                Sell_Order_ID = sell_id,
                Quantity      = qty,
                Exec_Price    = exec_price,
                Fee           = fee,
            ))
            db.flush()   # assign Trade_ID before trigger reads it

            # 2 ── Order statuses ──────────────────────────────────────────────
            for oid in (buy_id, sell_id):
                o = (
                    db.query(models.Order)
                    .filter(models.Order.Order_ID == oid)
                    .with_for_update()
                    .first()
                )
                if o is None:
                    continue
                o.Rem_Qty = max(0, o.Rem_Qty - qty)
                o.Status  = "FILLED" if o.Rem_Qty == 0 else "PARTIAL"

            # 3 & 4 ── Buyer wallet ────────────────────────────────────────────
            buy_order = (
                db.query(models.Order)
                .filter(models.Order.Order_ID == buy_id)
                .first()
            )
            if buy_order:
                buyer = (
                    db.query(models.User)
                    .filter(models.User.User_ID == buy_order.User_ID)
                    .with_for_update()
                    .first()
                )
                if buyer:
                    cost = exec_price * qty
                    if buy_order.Type == "Limit":
                        # Reservation was taken at limit_price * qty, not exec_price.
                        # Release at limit_price to match what was reserved.
                        reserved_release = Decimal(str(buy_order.Limit_Price)) * qty
                        buyer.Reserved_Balance = max(
                            Decimal("0.00"), buyer.Reserved_Balance - reserved_release
                        )
                        # If the order is now fully filled, flush any rounding
                        # remainder so Reserved_Balance returns exactly to 0.
                        if buy_order.Rem_Qty == 0:
                            buyer.Reserved_Balance = Decimal("0.00")
                    buyer.Wallet_Balance -= cost

            # 5 ── Seller wallet ───────────────────────────────────────────────
            sell_order = (
                db.query(models.Order)
                .filter(models.Order.Order_ID == sell_id)
                .first()
            )
            if sell_order:
                seller = (
                    db.query(models.User)
                    .filter(models.User.User_ID == sell_order.User_ID)
                    .with_for_update()
                    .first()
                )
                if seller:
                    seller.Wallet_Balance += exec_price * qty - fee

        db.commit()

    except Exception:
        db.rollback()
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────────────────────────────────

def shutdown_engine() -> None:
    """Close engine stdin so it exits cleanly on EOF."""
    global _proc
    if _proc and _proc.poll() is None:
        log.info("Shutting down matching engine")
        try:
            _proc.stdin.close()
            _proc.wait(timeout=3)
        except Exception:
            _proc.kill()
        _proc = None