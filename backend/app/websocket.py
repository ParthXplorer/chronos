"""
app/websocket.py
----------------
ConnectionManager  — tracks which WebSocket clients are subscribed to which symbol.
broadcast_loop     — background coroutine that runs every 2 seconds and pushes
                     live order-book snapshots to all connected clients.
"""

import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        # symbol (str) → set of active WebSocket connections
        self._subscribers: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, symbol: str, websocket: WebSocket):
        await websocket.accept()
        self._subscribers[symbol].add(websocket)

    def disconnect(self, symbol: str, websocket: WebSocket):
        self._subscribers[symbol].discard(websocket)
        # Clean up the key when nobody is watching
        if not self._subscribers[symbol]:
            del self._subscribers[symbol]

    async def broadcast(self, symbol: str, payload: dict):
        """Send payload to every subscriber of symbol; prune dead connections."""
        dead: list[WebSocket] = []
        for ws in list(self._subscribers.get(symbol, [])):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(symbol, ws)

    @property
    def active_symbols(self) -> list[str]:
        return list(self._subscribers.keys())


# Singleton used across the entire app
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Order-book query helper
# ---------------------------------------------------------------------------

def fetch_order_book(db: Session, symbol: str) -> dict:
    """Return top-5 bids and asks for *symbol* as a plain dict."""
    bids = (
        db.query(models.Order)
        .filter(
            models.Order.Symbol == symbol,
            models.Order.Side == "Buy",
            models.Order.Status.in_(["OPEN", "PARTIAL"]),
        )
        .order_by(
            models.Order.Limit_Price.desc(),
            models.Order.Timestamp.asc(),
        )
        .limit(5)
        .all()
    )

    asks = (
        db.query(models.Order)
        .filter(
            models.Order.Symbol == symbol,
            models.Order.Side == "Sell",
            models.Order.Status.in_(["OPEN", "PARTIAL"]),
        )
        .order_by(
            models.Order.Limit_Price.asc(),
            models.Order.Timestamp.asc(),
        )
        .limit(5)
        .all()
    )

    return {
        "symbol": symbol,
        "bids": [
            {
                "price": str(o.Limit_Price),
                "quantity": o.Rem_Qty,
                "order_id": o.Order_ID,
            }
            for o in bids
        ],
        "asks": [
            {
                "price": str(o.Limit_Price),
                "quantity": o.Rem_Qty,
                "order_id": o.Order_ID,
            }
            for o in asks
        ],
    }


# ---------------------------------------------------------------------------
# Background broadcast loop
# ---------------------------------------------------------------------------

async def broadcast_loop(interval: float = 2.0):
    """
    Runs forever (until cancelled at shutdown).
    Every *interval* seconds it fetches a fresh order-book snapshot for every
    symbol that currently has at least one WebSocket subscriber and broadcasts
    the result to those subscribers.
    """
    while True:
        await asyncio.sleep(interval)

        symbols = manager.active_symbols  # snapshot — avoids mutation during loop
        if not symbols:
            continue

        # Run the blocking DB queries in a thread pool so we don't block the
        # event loop
        loop = asyncio.get_event_loop()

        for symbol in symbols:
            try:
                snapshot = await loop.run_in_executor(
                    None, _sync_fetch, symbol
                )
                await manager.broadcast(symbol, snapshot)
            except Exception as exc:
                # Log and continue — never let one symbol crash the whole loop
                print(f"[broadcast_loop] error for {symbol}: {exc}")


def _sync_fetch(symbol: str) -> dict:
    """Synchronous wrapper around fetch_order_book for use with run_in_executor."""
    db: Session = SessionLocal()
    try:
        return fetch_order_book(db, symbol)
    finally:
        db.close()