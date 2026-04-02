from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.database import get_db
from app import models, auth

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# 1. Top Gainers — top 3 stocks by percentage gain vs previous close
# AFTER
@router.get("/top-gainers")
def top_gainers(db: Session = Depends(get_db)):
    # BUG-4 FIX: filter Prev_Close > 0 AND LTP > Prev_Close (actual gainers only)
    # The Prev_Close > 0 guard already existed but the LTP > Prev_Close filter
    # is added to exclude flat/losing stocks from the gainers list.
    stocks = db.query(models.Stock).filter(
        models.Stock.Status == 'Active',
        models.Stock.Prev_Close > 0,                          # exclude uninitialized stocks
        models.Stock.LTP > models.Stock.Prev_Close            # actual gainers only
    ).order_by(
        ((models.Stock.LTP - models.Stock.Prev_Close) / models.Stock.Prev_Close).desc()
    ).limit(3).all()

    return [
        {
            "symbol": s.Symbol,
            "sector": s.Sector,
            "ltp": str(s.LTP),
            "prev_close": str(s.Prev_Close),
            # BUG-4 FIX: wrap in guard even though DB filter should prevent it
            "change_pct": round(
                (float(s.LTP) - float(s.Prev_Close)) / float(s.Prev_Close) * 100, 2
            ) if float(s.Prev_Close) > 0 else 0.0
        }
        for s in stocks
    ]

# 2. Whale Alert — trades with value > 100,000
@router.get("/whale-alert")
def whale_alert(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from datetime import datetime, timedelta

    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    trades = db.query(models.Trade).filter(
        (models.Trade.Exec_Price * models.Trade.Quantity) > 100000,
        models.Trade.Timestamp >= one_hour_ago
    ).order_by(models.Trade.Timestamp.desc()).all()

    return [
        {
            "trade_id": t.Trade_ID,
            "quantity": t.Quantity,
            "exec_price": str(t.Exec_Price),
            "value": round(float(t.Exec_Price) * t.Quantity, 2),
            "timestamp": str(t.Timestamp)
        }
        for t in trades
    ]

# 3. Liquidity Check — total buy vs sell quantity for a symbol
@router.get("/liquidity/{symbol}")
def liquidity_check(symbol: str, db: Session = Depends(get_db)):
    buy_qty = db.query(func.sum(models.Order.Rem_Qty)).filter(
        models.Order.Symbol == symbol.upper(),
        models.Order.Side == 'Buy',
        models.Order.Status.in_(['OPEN', 'PARTIAL'])
    ).scalar() or 0

    sell_qty = db.query(func.sum(models.Order.Rem_Qty)).filter(
        models.Order.Symbol == symbol.upper(),
        models.Order.Side == 'Sell',
        models.Order.Status.in_(['OPEN', 'PARTIAL'])
    ).scalar() or 0

    return {
        "symbol": symbol.upper(),
        "total_demand": buy_qty,
        "total_supply": sell_qty,
        "liquidity_ratio": round(buy_qty / sell_qty, 2) if sell_qty > 0 else None
    }

# 4. System Volume — total trading volume today
@router.get("/volume")
def system_volume(db: Session = Depends(get_db)):
    result = db.query(
        func.sum(models.Trade.Quantity * models.Trade.Exec_Price).label("total_volume"),
        func.sum(models.Trade.Fee).label("total_fees"),
        func.count(models.Trade.Trade_ID).label("total_trades")
    ).filter(
        func.date(models.Trade.Timestamp) == func.current_date()
    ).first()

    return {
        "total_volume": round(float(result.total_volume or 0), 2),
        "total_fees_collected": round(float(result.total_fees or 0), 2),
        "total_trades": result.total_trades or 0
    }

# 5. Volatility — standard deviation of trade prices for a symbol
@router.get("/volatility/{symbol}")
def volatility(symbol: str, db: Session = Depends(get_db)):
    result = db.query(
        func.stddev(models.Trade.Exec_Price).label("stddev"),
        func.avg(models.Trade.Exec_Price).label("avg_price"),
        func.count(models.Trade.Trade_ID).label("total_trades")
    ).join(
        models.Order, models.Trade.Buy_Order_ID == models.Order.Order_ID
    ).filter(
        models.Order.Symbol == symbol.upper()
    ).first()

    return {
        "symbol": symbol.upper(),
        "avg_price": round(float(result.avg_price or 0), 2),
        "std_deviation": round(float(result.stddev or 0), 2),
        "total_trades": result.total_trades or 0,
        "risk_level": "High" if float(result.stddev or 0) > 50 else "Low"
    }

# 6. User Activity Audit — users with 50+ orders but 0 trades (bots/spam)
@router.get("/audit/suspicious-users")
def suspicious_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Only admins can see this
    if current_user.Role != 'Admin':
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")

    results = db.execute(text("""
        SELECT u.User_ID, u.Name, u.Email, COUNT(o.Order_ID) as order_count
        FROM USERS u
        JOIN ORDERS o ON u.User_ID = o.User_ID
        LEFT JOIN TRADES t ON o.Order_ID = t.Buy_Order_ID OR o.Order_ID = t.Sell_Order_ID
        WHERE t.Trade_ID IS NULL
        GROUP BY u.User_ID, u.Name, u.Email
        HAVING COUNT(o.Order_ID) > 2
    """)).fetchall()

    return [{"user_id": r[0], "name": r[1], "email": r[2], "order_count": r[3]} for r in results]