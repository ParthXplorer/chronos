from sqlalchemy import Column, Integer, String, DECIMAL, Enum, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "USERS"
    User_ID          = Column(Integer, primary_key=True, index=True)
    Name             = Column(String(100), nullable=False)
    Email            = Column(String(100), unique=True, nullable=False)
    Phone            = Column(String(15))
    Role             = Column(Enum('Retail', 'Admin', 'MarketMaker'), default='Retail')
    Wallet_Balance   = Column(DECIMAL(15, 2), default=0.00)
    Reserved_Balance = Column(DECIMAL(15, 2), default=0.00)
    Password_Hash    = Column(String(255), nullable=False, default='')
    Is_Active        = Column(Boolean, default=True)

class Stock(Base):
    __tablename__ = "STOCKS"
    Symbol = Column(String(10), primary_key=True)
    Sector = Column(String(50))
    LTP        = Column(DECIMAL(10, 2), default=0.00)
    Prev_Close = Column(DECIMAL(10, 2), default=0.00)
    Status     = Column(Enum('Active', 'Halted'), default='Active')

class Order(Base):
    __tablename__ = "ORDERS"
    Order_ID    = Column(Integer, primary_key=True, index=True)
    User_ID     = Column(Integer, ForeignKey("USERS.User_ID"), nullable=False)
    Symbol      = Column(String(10), ForeignKey("STOCKS.Symbol"), nullable=False)
    Side        = Column(Enum('Buy', 'Sell'), nullable=False)
    Type        = Column(Enum('Limit', 'Market'), nullable=False)
    Limit_Price = Column(DECIMAL(10, 2))
    Total_Qty   = Column(Integer, nullable=False)
    Rem_Qty     = Column(Integer, nullable=False)
    Status      = Column(Enum('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED'), default='OPEN')
    Timestamp   = Column(DateTime, server_default=func.now())

class Trade(Base):
    __tablename__ = "TRADES"
    Trade_ID      = Column(Integer, primary_key=True, index=True)
    Buy_Order_ID  = Column(Integer, ForeignKey("ORDERS.Order_ID"), nullable=False)
    Sell_Order_ID = Column(Integer, ForeignKey("ORDERS.Order_ID"), nullable=False)
    Quantity      = Column(Integer, nullable=False)
    Exec_Price    = Column(DECIMAL(10, 2), nullable=False)
    Fee           = Column(DECIMAL(10, 2), default=0.00)
    Timestamp     = Column(DateTime, server_default=func.now())

class Holding(Base):
    __tablename__ = "HOLDINGS"
    User_ID       = Column(Integer, ForeignKey("USERS.User_ID"), primary_key=True)
    Symbol        = Column(String(10), ForeignKey("STOCKS.Symbol"), primary_key=True)
    Quantity      = Column(Integer, nullable=False, default=0)
    Avg_Buy_Price = Column(DECIMAL(10, 2), default=0.00)