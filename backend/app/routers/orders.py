from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app import models, schemas, auth
from app.engine_bridge import submit_order

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("/", status_code=201)
def place_order(
    order_data: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # ── Step 1: Validate stock ────────────────────────────────────────────────
    stock = db.query(models.Stock).filter(
        models.Stock.Symbol == order_data.symbol.upper()
    ).first()
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    if stock.Status == "Halted":
        raise HTTPException(status_code=400, detail="Trading halted for this stock")

    # ── Step 2: Validate order fields ─────────────────────────────────────────
    if order_data.side not in ("Buy", "Sell"):
        raise HTTPException(status_code=422, detail="side must be 'Buy' or 'Sell'")
    if order_data.type not in ("Limit", "Market"):
        raise HTTPException(status_code=422, detail="type must be 'Limit' or 'Market'")
    if order_data.type == "Limit" and not order_data.limit_price:
        raise HTTPException(status_code=422, detail="limit_price is required for Limit orders")
    if order_data.type == "Market" and order_data.side == "Buy":
        if stock.LTP == 0:
            raise HTTPException(status_code=400, detail="No last traded price available for market order")

    # ── Step 3: Reserve funds for buy orders (BUG 1 FIX) ──────────────────────
    if order_data.side == "Buy":
        if order_data.type == "Limit":
            required = order_data.limit_price * order_data.quantity
        else:
            required = stock.LTP * order_data.quantity

        # FIX: Acquire a row lock AND force SQLAlchemy to discard the cached user
        locked_user = db.query(models.User).filter(
            models.User.User_ID == current_user.User_ID
        ).with_for_update().populate_existing().first()

        available = locked_user.Wallet_Balance - locked_user.Reserved_Balance
        if available < required:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        
        locked_user.Reserved_Balance += required
        db.add(locked_user)

    # ── Step 4: Persist the order ─────────────────────────────────────────────
    new_order = models.Order(
        User_ID     = current_user.User_ID,
        Symbol      = order_data.symbol.upper(),
        Side        = order_data.side,
        Type        = order_data.type,
        Limit_Price = order_data.limit_price,
        Total_Qty   = order_data.quantity,
        Rem_Qty     = order_data.quantity,
        Status      = "OPEN",
    )
    db.add(new_order)
    db.commit() # Note: This commit officially reserves the funds and RELEASES the row lock
    db.refresh(new_order)

    # ── Step 5: Send to the C++ matching engine ───────────────────────────────
    try:
        fills = submit_order(db, new_order)
    except RuntimeError as e:
        fills = []
        print(f"[engine_bridge] {e}")

    # ── Step 6: Market orders must fill immediately or be cancelled ───────────
    db.refresh(new_order)

    if new_order.Type == "Market" and new_order.Status in ("OPEN", "PARTIAL"):
        unfilled_qty = new_order.Rem_Qty  

        if order_data.side == "Buy" and unfilled_qty > 0:
            release = Decimal(str(stock.LTP)) * unfilled_qty
            
            # FIX: Re-acquire the row lock with populate_existing
            locked_user = db.query(models.User).filter(
                models.User.User_ID == current_user.User_ID
            ).with_for_update().populate_existing().first()

            locked_user.Reserved_Balance = max(
                Decimal("0.00"),
                locked_user.Reserved_Balance - release
            )
            db.add(locked_user)

        new_order.Status  = "CANCELLED"
        new_order.Rem_Qty = 0
        db.commit()
        db.refresh(new_order)

        was_partial = len(fills) > 0
        msg = (
            "Market order partially filled and remainder cancelled"
            if was_partial
            else "Market order cancelled — no liquidity available"
        )
        return {
            "order": {
                "order_id":    new_order.Order_ID,
                "symbol":      new_order.Symbol,
                "side":        new_order.Side,
                "type":        new_order.Type,
                "limit_price": str(new_order.Limit_Price),
                "total_qty":   new_order.Total_Qty,
                "rem_qty":     new_order.Rem_Qty,
                "status":      new_order.Status,
                "timestamp":   str(new_order.Timestamp),
            },
            "fills": fills,
            "message": msg,
        }

    return {
        "order": {
            "order_id":    new_order.Order_ID,
            "symbol":      new_order.Symbol,
            "side":        new_order.Side,
            "type":        new_order.Type,
            "limit_price": str(new_order.Limit_Price),
            "total_qty":   new_order.Total_Qty,
            "rem_qty":     new_order.Rem_Qty,
            "status":      new_order.Status,
            "timestamp":   str(new_order.Timestamp),
        },
        "fills": fills,
    }


@router.delete("/{order_id}", status_code=200)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Lock the order to prevent it from being filled while we cancel it
    order = db.query(models.Order).filter(
        models.Order.Order_ID == order_id,
        models.Order.User_ID  == current_user.User_ID,
    ).with_for_update().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.Status in ("FILLED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {order.Status} order")

    if order.Side == "Buy" and order.Type == "Limit" and order.Limit_Price:
        release = order.Limit_Price * order.Rem_Qty
        
        # BUG 2 FIX: Acquire a row lock on the user with populate_existing
        locked_user = db.query(models.User).filter(
            models.User.User_ID == current_user.User_ID
        ).with_for_update().populate_existing().first()

        locked_user.Reserved_Balance = max(
            Decimal("0.00"),
            locked_user.Reserved_Balance - release
        )
        db.add(locked_user)

    order.Status  = "CANCELLED"
    order.Rem_Qty = 0
    db.commit()

    return {"message": f"Order {order_id} cancelled"}


@router.get("/active", response_model=list[schemas.OrderOut])
def get_active_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Order).filter(
        models.Order.User_ID == current_user.User_ID,
        models.Order.Status.in_(["OPEN", "PARTIAL"]),
    ).order_by(models.Order.Timestamp.desc()).all()


@router.get("/history")
def get_order_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    orders = db.query(models.Order).filter(
        models.Order.User_ID == current_user.User_ID,
    ).order_by(models.Order.Timestamp.desc()).limit(100).all()

    return [
        {
            "order_id":    o.Order_ID,
            "symbol":      o.Symbol,
            "side":        o.Side,
            "type":        o.Type,
            "limit_price": str(o.Limit_Price),
            "total_qty":   o.Total_Qty,
            "rem_qty":     o.Rem_Qty,
            "status":      o.Status,
            "timestamp":   str(o.Timestamp),
        }
        for o in orders
    ]