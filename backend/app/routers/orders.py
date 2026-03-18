from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("/", response_model=schemas.OrderOut, status_code=201)
def place_order(
    order_data: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Step 1 — Check stock exists and is not halted
    stock = db.query(models.Stock).filter(
        models.Stock.Symbol == order_data.symbol.upper()
    ).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    if stock.Status == 'Halted':
        raise HTTPException(status_code=400, detail="Trading halted for this stock")

    # Step 2 — For limit buy orders, reserve the funds in the wallet
    # This prevents the user from placing 10 buy orders with the same money
    if order_data.side == 'Buy' and order_data.type == 'Limit':
        required = order_data.limit_price * order_data.quantity
        available = current_user.Wallet_Balance - current_user.Reserved_Balance
        if available < required:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        current_user.Reserved_Balance += required

    # Step 3 — Create the order
    new_order = models.Order(
        User_ID     = current_user.User_ID,
        Symbol      = order_data.symbol.upper(),
        Side        = order_data.side,
        Type        = order_data.type,
        Limit_Price = order_data.limit_price,
        Total_Qty   = order_data.quantity,
        Rem_Qty     = order_data.quantity,
        Status      = 'OPEN'
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@router.get("/active", response_model=list[schemas.OrderOut])
def get_active_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Only returns THIS user's open/partial orders — not everyone's
    return db.query(models.Order).filter(
        models.Order.User_ID == current_user.User_ID,
        models.Order.Status.in_(['OPEN', 'PARTIAL'])
    ).order_by(models.Order.Timestamp.desc()).all()