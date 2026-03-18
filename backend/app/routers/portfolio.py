from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, auth

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

@router.get("/holdings")
def get_holdings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    holdings = db.query(models.Holding).filter(
        models.Holding.User_ID == current_user.User_ID,
        models.Holding.Quantity > 0
    ).all()

    return [
        {
            "symbol": h.Symbol,
            "quantity": h.Quantity,
            "avg_buy_price": str(h.Avg_Buy_Price)
        }
        for h in holdings
    ]

@router.get("/pnl")
def get_pnl(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    holdings = db.query(models.Holding).filter(
        models.Holding.User_ID == current_user.User_ID,
        models.Holding.Quantity > 0
    ).all()

    result = []
    total_pnl = 0

    for h in holdings:
        # Get current market price from STOCKS table
        stock = db.query(models.Stock).filter(
            models.Stock.Symbol == h.Symbol
        ).first()

        if stock:
            current_price = float(stock.LTP)
            avg_price = float(h.Avg_Buy_Price)
            quantity = h.Quantity

            unrealized_pnl = (current_price - avg_price) * quantity
            pnl_percent = ((current_price - avg_price) / avg_price) * 100
            total_pnl += unrealized_pnl

            result.append({
                "symbol": h.Symbol,
                "quantity": quantity,
                "avg_buy_price": avg_price,
                "current_price": current_price,
                "unrealized_pnl": round(unrealized_pnl, 2),
                "pnl_percent": round(pnl_percent, 2),
                "current_value": round(current_price * quantity, 2)
            })

    return {
        "positions": result,
        "total_unrealized_pnl": round(total_pnl, 2)
    }

@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    holdings = db.query(models.Holding).filter(
        models.Holding.User_ID == current_user.User_ID,
        models.Holding.Quantity > 0
    ).all()

    holdings_value = 0
    for h in holdings:
        stock = db.query(models.Stock).filter(
            models.Stock.Symbol == h.Symbol
        ).first()
        if stock:
            holdings_value += float(stock.LTP) * h.Quantity

    available_balance = float(current_user.Wallet_Balance) - float(current_user.Reserved_Balance)

    return {
        "user": current_user.Name,
        "cash_balance": float(current_user.Wallet_Balance),
        "reserved_balance": float(current_user.Reserved_Balance),
        "available_balance": round(available_balance, 2),
        "holdings_value": round(holdings_value, 2),
        "total_portfolio_value": round(available_balance + holdings_value, 2)
    }