from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.websocket import manager, fetch_order_book

router = APIRouter(prefix="/stocks", tags=["Stocks"])


# ---------------------------------------------------------------------------
# REST endpoints (unchanged)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[schemas.StockOut])
def get_all_stocks(db: Session = Depends(get_db)):
    """Returns all active stocks with their last traded price."""
    return db.query(models.Stock).filter(models.Stock.Status == "Active").all()


@router.get("/{symbol}/orderbook")
def get_order_book(symbol: str, db: Session = Depends(get_db)):
    """HTTP snapshot of the current order book (top 5 bids & asks)."""
    return fetch_order_book(db, symbol.upper())


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ws://localhost:8000/ws/orderbook/{symbol}
# ---------------------------------------------------------------------------

@router.websocket("/ws/orderbook/{symbol}")
async def orderbook_ws(symbol: str, websocket: WebSocket):
    """
    Real-time order-book feed for *symbol*.

    On connect   → client is registered with the ConnectionManager.
    Every 2 s    → broadcast_loop (started at app startup) pushes a fresh
                   top-5 bid/ask snapshot to this client.
    On disconnect → client is cleanly removed from the manager.

    Message format (JSON):
    {
        "symbol": "AAPL",
        "bids": [{"price": "150.00", "quantity": 300, "order_id": 12}, ...],
        "asks": [{"price": "150.50", "quantity": 100, "order_id": 17}, ...]
    }
    """
    sym = symbol.upper()
    await manager.connect(sym, websocket)

    # Send an immediate snapshot so the client doesn't wait up to 2 s
    db: Session = next(get_db())
    try:
        snapshot = fetch_order_book(db, sym)
    finally:
        db.close()
    await websocket.send_json(snapshot)

    try:
        # Keep the connection alive; the broadcast_loop handles outbound pushes.
        # We still need to receive (and discard) any client pings / messages
        # so that WebSocketDisconnect is raised properly on close.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(sym, websocket)