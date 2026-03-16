from pydantic import BaseModel, EmailStr
from decimal import Decimal
from typing import Optional
from datetime import datetime

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Optional[str] = "Retail"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    User_ID: int
    Name: str
    Email: str
    Role: str
    Wallet_Balance: Decimal
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    symbol: str
    side: str
    type: str
    limit_price: Optional[Decimal] = None
    quantity: int

class OrderOut(BaseModel):
    Order_ID: int
    Symbol: str
    Side: str
    Type: str
    Limit_Price: Optional[Decimal]
    Total_Qty: int
    Rem_Qty: int
    Status: str
    Timestamp: datetime
    class Config:
        from_attributes = True

class StockOut(BaseModel):
    Symbol: str
    Sector: str
    LTP: Decimal
    Status: str
    class Config:
        from_attributes = True

class HoldingOut(BaseModel):
    Symbol: str
    Quantity: int
    Avg_Buy_Price: Decimal
    class Config:
        from_attributes = True