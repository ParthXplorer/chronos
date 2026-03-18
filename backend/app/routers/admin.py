from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app import models, auth

router = APIRouter(tags=["Admin & Wallet"])


# ── POST /wallet/deposit ──────────────────────────────────────────────────────
@router.post("/wallet/deposit")
def deposit(
    amount: float,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Add funds to the authenticated user's wallet."""
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")
    if amount > 10_000_000:
        raise HTTPException(status_code=422, detail="Single deposit limit is ₹1,00,00,000")

    current_user.Wallet_Balance += Decimal(str(amount))
    db.commit()
    db.refresh(current_user)

    return {
        "message":         f"₹{amount:,.2f} deposited successfully",
        "wallet_balance":  float(current_user.Wallet_Balance),
        "available_balance": float(current_user.Wallet_Balance - current_user.Reserved_Balance),
    }


# ── GET /wallet/balance ───────────────────────────────────────────────────────
@router.get("/wallet/balance")
def get_balance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Return current wallet balances for the authenticated user."""
    return {
        "wallet_balance":    float(current_user.Wallet_Balance),
        "reserved_balance":  float(current_user.Reserved_Balance),
        "available_balance": float(current_user.Wallet_Balance - current_user.Reserved_Balance),
    }


# ── GET /orders/history ───────────────────────────────────────────────────────
@router.get("/trades/history")
def get_trade_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    All trades the authenticated user participated in (buy or sell side),
    last 30 days, newest first.
    """
    from sqlalchemy import or_
    from sqlalchemy.orm import aliased

    BuyOrder  = aliased(models.Order)
    SellOrder = aliased(models.Order)

    trades = (
        db.query(models.Trade, BuyOrder, SellOrder)
        .join(BuyOrder,  models.Trade.Buy_Order_ID  == BuyOrder.Order_ID)
        .join(SellOrder, models.Trade.Sell_Order_ID == SellOrder.Order_ID)
        .filter(
            or_(
                BuyOrder.User_ID  == current_user.User_ID,
                SellOrder.User_ID == current_user.User_ID,
            )
        )
        .order_by(models.Trade.Timestamp.desc())
        .limit(100)
        .all()
    )

    result = []
    for trade, buy_order, sell_order in trades:
        side = "Buy" if buy_order.User_ID == current_user.User_ID else "Sell"
        result.append({
            "trade_id":   trade.Trade_ID,
            "symbol":     buy_order.Symbol,
            "side":       side,
            "quantity":   trade.Quantity,
            "exec_price": float(trade.Exec_Price),
            "total_value": round(float(trade.Exec_Price) * trade.Quantity, 2),
            "fee":        float(trade.Fee),
            "timestamp":  str(trade.Timestamp),
        })
    return result


# ── POST /admin/stocks/{symbol}/halt ─────────────────────────────────────────
@router.post("/admin/stocks/{symbol}/halt")
def halt_stock(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Halt trading on a stock. Admin only. Fires the audit_log trigger."""
    if current_user.Role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    stock = db.query(models.Stock).filter(
        models.Stock.Symbol == symbol.upper()
    ).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    if stock.Status == "Halted":
        raise HTTPException(status_code=400, detail=f"{symbol.upper()} is already halted")

    stock.Status = "Halted"
    db.commit()
    return {"message": f"{symbol.upper()} trading halted", "symbol": symbol.upper(), "status": "Halted"}


# ── POST /admin/stocks/{symbol}/resume ───────────────────────────────────────
@router.post("/admin/stocks/{symbol}/resume")
def resume_stock(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Resume trading on a halted stock. Admin only."""
    if current_user.Role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    stock = db.query(models.Stock).filter(
        models.Stock.Symbol == symbol.upper()
    ).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    if stock.Status == "Active":
        raise HTTPException(status_code=400, detail=f"{symbol.upper()} is already active")

    stock.Status = "Active"
    db.commit()
    return {"message": f"{symbol.upper()} trading resumed", "symbol": symbol.upper(), "status": "Active"}


# ── POST /admin/stocks/{symbol}/close ────────────────────────────────────────
@router.post("/admin/stocks/{symbol}/close")
def market_close(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Snapshot LTP → Prev_Close for a symbol (end-of-day operation).
    In production this would be called by a scheduled job for all stocks.
    Admin only.
    """
    if current_user.Role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    stock = db.query(models.Stock).filter(
        models.Stock.Symbol == symbol.upper()
    ).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    old_prev = float(stock.Prev_Close)
    stock.Prev_Close = stock.LTP
    db.commit()

    return {
        "message":    f"Prev_Close updated for {symbol.upper()}",
        "symbol":     symbol.upper(),
        "prev_close": float(stock.LTP),
        "was":        old_prev,
    }
