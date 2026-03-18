from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/stocks", tags=["Stocks"])

@router.get("/", response_model=list[schemas.StockOut])
def get_all_stocks(db: Session = Depends(get_db)):
    # Returns all active stocks with their last traded price
    return db.query(models.Stock).filter(models.Stock.Status == 'Active').all()

@router.get("/{symbol}/orderbook")
def get_order_book(symbol: str, db: Session = Depends(get_db)):
    # Top 5 buy orders — highest price first (best bids)
    buy_orders = db.query(models.Order).filter(
        models.Order.Symbol == symbol,
        models.Order.Side == 'Buy',
        models.Order.Status.in_(['OPEN', 'PARTIAL'])
    ).order_by(models.Order.Limit_Price.desc(), models.Order.Timestamp.asc()).limit(5).all()

    # Top 5 sell orders — lowest price first (best asks)
    sell_orders = db.query(models.Order).filter(
        models.Order.Symbol == symbol,
        models.Order.Side == 'Sell',
        models.Order.Status.in_(['OPEN', 'PARTIAL'])
    ).order_by(models.Order.Limit_Price.asc(), models.Order.Timestamp.asc()).limit(5).all()

    return {
        "symbol": symbol,
        "bids": [{"price": str(o.Limit_Price), "quantity": o.Rem_Qty, "order_id": o.Order_ID} for o in buy_orders],
        "asks": [{"price": str(o.Limit_Price), "quantity": o.Rem_Qty, "order_id": o.Order_ID} for o in sell_orders]
    }