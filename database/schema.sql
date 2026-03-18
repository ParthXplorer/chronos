CREATE DATABASE chronos_db;
USE chronos_db;


CREATE TABLE USERS (
    User_ID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Phone VARCHAR(15),
    Role ENUM('Retail', 'Admin', 'MarketMaker') DEFAULT 'Retail',
    Wallet_Balance DECIMAL(15, 2) DEFAULT 0.00,
    Reserved_Balance DECIMAL(15, 2) DEFAULT 0.00,
    Password_Hash VARCHAR(255) NOT NULL DEFAULT '',
    Is_Active BOOLEAN DEFAULT TRUE,
    CONSTRAINT chk_wallet_positive CHECK (Wallet_Balance >= 0),
    CONSTRAINT chk_reserved_positive CHECK (Reserved_Balance >= 0)
);



CREATE TABLE STOCKS (
    Symbol VARCHAR(10) PRIMARY KEY,
    Sector VARCHAR(50),
    LTP DECIMAL(10, 2) DEFAULT 0.00, -- Last Traded Price
    Status ENUM('Active', 'Halted') DEFAULT 'Active'
);


CREATE TABLE ORDERS (
    Order_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT NOT NULL,
    Symbol VARCHAR(10) NOT NULL,
    Side ENUM('Buy', 'Sell') NOT NULL,
    Type ENUM('Limit', 'Market') NOT NULL,
    Limit_Price DECIMAL(10, 2), -- Nullable for Market Orders
    Total_Qty INT NOT NULL,
    Rem_Qty INT NOT NULL,
    Status ENUM('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED') DEFAULT 'OPEN',
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_order_user FOREIGN KEY (User_ID) REFERENCES USERS(User_ID),
    CONSTRAINT fk_order_stock FOREIGN KEY (Symbol) REFERENCES STOCKS(Symbol),
    
    -- Integrity Constraints
    CONSTRAINT chk_qty_positive CHECK (Total_Qty > 0),
    CONSTRAINT chk_rem_qty_valid CHECK (Rem_Qty >= 0 AND Rem_Qty <= Total_Qty)
);

--  Create TRADES Table
-- Explicitly links a Buy Order and a Sell Order as per your unique schema design
CREATE TABLE TRADES (
    Trade_ID INT PRIMARY KEY AUTO_INCREMENT,
    Buy_Order_ID INT NOT NULL,
    Sell_Order_ID INT NOT NULL,
    Quantity INT NOT NULL,
    Exec_Price DECIMAL(10, 2) NOT NULL,
    Fee DECIMAL(10, 2) DEFAULT 0.00,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_trade_buy_order FOREIGN KEY (Buy_Order_ID) REFERENCES ORDERS(Order_ID),
    CONSTRAINT fk_trade_sell_order FOREIGN KEY (Sell_Order_ID) REFERENCES ORDERS(Order_ID),

    -- Integrity Constraints
    CONSTRAINT chk_trade_qty CHECK (Quantity > 0),
    CONSTRAINT chk_self_trade_prevention CHECK (Buy_Order_ID <> Sell_Order_ID) 
);

--  Create HOLDINGS Table
CREATE TABLE HOLDINGS (
    User_ID INT,
    Symbol VARCHAR(10),
    Quantity INT NOT NULL DEFAULT 0,
    Avg_Buy_Price DECIMAL(10, 2) DEFAULT 0.00,

    -- Composite Primary Key
    PRIMARY KEY (User_ID, Symbol),

    -- Foreign Keys
    CONSTRAINT fk_holding_user FOREIGN KEY (User_ID) REFERENCES USERS(User_ID),
    CONSTRAINT fk_holding_stock FOREIGN KEY (Symbol) REFERENCES STOCKS(Symbol),

    -- Integrity Constraints
    CONSTRAINT chk_holding_qty CHECK (Quantity >= 0) -- Prevents Negative Inventory
);

--  Create AUDIT_LOG Table (Tracks Stock Status Changes)
CREATE TABLE AUDIT_LOG (
    Log_ID INT PRIMARY KEY AUTO_INCREMENT,
    Symbol VARCHAR(10) NOT NULL,
    Old_Status VARCHAR(20),
    New_Status VARCHAR(20),
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_stock FOREIGN KEY (Symbol) REFERENCES STOCKS(Symbol)
);

--  Create HOLDING_LOG Table (Tracks Portfolio History)
CREATE TABLE HOLDING_LOG (
    Log_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT NOT NULL,
    Symbol VARCHAR(10) NOT NULL,
    Change_Quantity INT NOT NULL, -- Can be negative for Sells
    Exec_Price DECIMAL(10, 2),
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hlog_user FOREIGN KEY (User_ID) REFERENCES USERS(User_ID),
    CONSTRAINT fk_hlog_stock FOREIGN KEY (Symbol) REFERENCES STOCKS(Symbol)
);


-- A. Matching Engine Optimization
-- Critical for "Price-Time Priority" matching. 
-- Helps find the lowest Sell price or highest Buy price quickly for a specific symbol.
CREATE INDEX idx_orders_matching ON ORDERS(Symbol, Status, Side, Limit_Price, Timestamp);

-- B. Portfolio & Wallet Optimization
-- Speeds up "Portfolio Summary" and "Real-Time Holdings" queries.
CREATE INDEX idx_holdings_user ON HOLDINGS(User_ID);

-- C. Order Book View
-- Optimizes "Depth of Market" queries (Top 5 Buys/Sells).
CREATE INDEX idx_orders_book ON ORDERS(Symbol, Status, Side);

-- D. Analytics
-- Speeds up "Trade History" and "Whale Alert" queries.
CREATE INDEX idx_trades_timestamp ON TRADES(Timestamp);
CREATE INDEX idx_trades_user_lookup ON TRADES(Buy_Order_ID, Sell_Order_ID);


-- 1. Insert USERS (Admin and Retail Traders)
INSERT INTO USERS (Name, Email, Phone, Role, Wallet_Balance, Reserved_Balance) VALUES
('System Admin', 'admin@chronos.com', '000-000-0000', 'Admin', 0.00, 0.00),
('Parth Choyal', 'parth@example.com', '9876543210', 'Retail', 50000.00, 5000.00), -- Has an open order
('Divanshu Jain', 'divanshu@example.com', '9876543211', 'Retail', 75000.00, 0.00),
('Prabhav Singhal', 'prabhav@example.com', '9876543212', 'Retail', 100000.00, 12000.00);

-- 2. Insert STOCKS (Tech Sector)
INSERT INTO STOCKS (Symbol, Sector, LTP, Status) VALUES
('AAPL', 'Technology', 150.00, 'Active'),
('GOOGL', 'Technology', 2800.00, 'Active'),
('TSLA', 'Automotive', 700.00, 'Active'),
('MSFT', 'Technology', 300.00, 'Halted'); -- Example of halted stock

-- 3. Insert ORDERS (Mix of Filled, Partial, and Open)
-- Scenario: Prabhav wants to buy AAPL, Parth is selling AAPL.
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status, Timestamp) VALUES
-- Order 1: Prabhav places Buy Order for 100 AAPL @ 150 (FILLED)
(4, 'AAPL', 'Buy', 'Limit', 150.00, 100, 0, 'FILLED', '2023-10-24 09:30:00'),
-- Order 2: Parth places Sell Order for 100 AAPL @ 150 (FILLED)
(2, 'AAPL', 'Sell', 'Limit', 150.00, 100, 0, 'FILLED', '2023-10-24 09:35:00'),
-- Order 3: Divanshu places Buy Order for TSLA (OPEN)
(3, 'TSLA', 'Buy', 'Limit', 690.00, 50, 50, 'OPEN', '2023-10-24 10:00:00'),
-- Order 4: Parth places Sell Order for TSLA (PARTIAL FILL)
(2, 'TSLA', 'Sell', 'Limit', 700.00, 20, 10, 'PARTIAL', '2023-10-24 10:05:00');

-- 4. Insert TRADES (Matching the Filled Orders above)
-- Matching Order 1 (Buy) and Order 2 (Sell)
INSERT INTO TRADES (Buy_Order_ID, Sell_Order_ID, Quantity, Exec_Price, Fee, Timestamp) VALUES
(1, 2, 100, 150.00, 15.00, '2023-10-24 09:35:01');

-- 5. Insert HOLDINGS (Reflecting the trades)
-- Prabhav bought 100 AAPL
INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price) VALUES
(4, 'AAPL', 100, 150.00);

-- Parth Sold his AAPL (Assuming he had them previously, or currently 0 if short selling wasn't allowed. 
-- For this simulation, let's say he still has 50 left from a previous unknown trade)
INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price) VALUES
(2, 'AAPL', 50, 145.00);

-- 6. Insert AUDIT_LOG (Tracking the Halt on MSFT)
INSERT INTO AUDIT_LOG (Symbol, Old_Status, New_Status, Timestamp) VALUES
('MSFT', 'Active', 'Halted', '2023-10-24 11:00:00');

-- 7. Insert HOLDING_LOG (History of Prabhav's buy)
INSERT INTO HOLDING_LOG (User_ID, Symbol, Change_Quantity, Exec_Price, Timestamp) VALUES
(4, 'AAPL', 100, 150.00, '2023-10-24 09:35:01');



-- 1. ADD NEW USERS (Market Makers & More Retail)
INSERT INTO USERS (Name, Email, Phone, Role, Wallet_Balance, Reserved_Balance) VALUES
('Alice Broker', 'alice@marketmaker.com', '111-222-3333', 'MarketMaker', 5000000.00, 0.00), -- Deep pockets
('Bob Trader', 'bob@retail.com', '444-555-6666', 'Retail', 25000.00, 0.00),   -- Small retail investor
('Charlie Scalper', 'charlie@hft.com', '777-888-9999', 'Retail', 200000.00, 50000.00); -- Active trader


-- 2. ADD MORE STOCKS (Banking & Pharma Sectors)
INSERT INTO STOCKS (Symbol, Sector, LTP, Status) VALUES
('INFY', 'Technology', 1450.00, 'Active'),
('HDFCBANK', 'Banking', 1600.00, 'Active'),
('ICICIBANK', 'Banking', 950.00, 'Active'),
('SUNPHARMA', 'Healthcare', 1120.00, 'Active');

-- 3. SEED INITIAL HOLDINGS (So users have stocks to sell)

-- Giving Alice (Market Maker) a large inventory of INFY and HDFCBANK
INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price) VALUES
(5, 'INFY', 5000, 1200.00),      -- Alice owns 5000 INFY
(5, 'HDFCBANK', 2000, 1500.00);  -- Alice owns 2000 HDFC


-- 4. COMPLEX ORDER SCENARIOS

-- SCENARIO A: PARTIAL FILL (Alice sells large block, Bob buys small chunk)
-- 1. Alice places a large Sell Order for 1000 INFY (Order ID will be roughly 5)
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status, Timestamp) 
VALUES (5, 'INFY', 'Sell', 'Limit', 1450.00, 1000, 950, 'PARTIAL', NOW());

-- 2. Bob places a Buy Order for 50 INFY (Order ID 6) - MATCHES ALICE
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status, Timestamp) 
VALUES (6, 'INFY', 'Buy', 'Limit', 1450.00, 50, 0, 'FILLED', NOW());

-- SCENARIO B: OPEN ORDERS (Liquidity Gap)
-- 3. Charlie wants to buy HDFCBANK cheap @ 1580, but Market Price is 1600
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status, Timestamp) 
VALUES (7, 'HDFCBANK', 'Buy', 'Limit', 1580.00, 200, 200, 'OPEN', NOW());

-- SCENARIO C: CANCELLED ORDER
-- 4. Bob changes his mind about buying SUNPHARMA
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status, Timestamp) 
VALUES (6, 'SUNPHARMA', 'Buy', 'Limit', 1100.00, 100, 100, 'CANCELLED', NOW());

-- 5. RECORD THE TRADES (For Scenario A)
-- Recording the match between Alice (Sell Order 5) and Bob (Buy Order 6)
-- Note: You might need to adjust Order_IDs (5 and 6) if your previous auto-increment was different.
INSERT INTO TRADES (Buy_Order_ID, Sell_Order_ID, Quantity, Exec_Price, Fee, Timestamp) 
VALUES (6, 5, 50, 1450.00, 14.50, NOW());


-- 6. UPDATE HOLDINGS (Post-Trade)
-- Bob gets his 50 INFY
INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price) VALUES (6, 'INFY', 50, 1450.00);

-- Alice's holdings decrease (Update existing record)
UPDATE HOLDINGS SET Quantity = Quantity - 50 WHERE User_ID = 5 AND Symbol = 'INFY';


-- 7. AUDIT LOGS (System Events)
-- Simulating a "Circuit Breaker" where a stock was halted briefly
INSERT INTO AUDIT_LOG (Symbol, Old_Status, New_Status, Timestamp) VALUES
('INFY', 'Active', 'Halted', '2023-10-25 14:00:00'),
('INFY', 'Halted', 'Active', '2023-10-25 14:05:00');







-- populate tables
INSERT INTO USERS (Name, Email, Phone, Role, Wallet_Balance)
VALUES
('Rahul Sharma','rahul@gmail.com','9123456789','Retail',60000),
('Sneha Kapoor','sneha@gmail.com','9871234567','Retail',85000),
('Market Bot','bot@exchange.com','9999999999','MarketMaker',10000000);


INSERT INTO STOCKS VALUES
('TCS','Technology',3600,'Active'),
('RELIANCE','Energy',2500,'Active'),
('WIPRO','Technology',420,'Active');




INSERT INTO ORDERS 
(User_ID,Symbol,Side,Type,Limit_Price,Total_Qty,Rem_Qty,Status)
VALUES
(6,'AAPL','Buy','Limit',149,30,30,'OPEN'),
(7,'AAPL','Sell','Limit',151,40,40,'OPEN'),
(6,'TSLA','Buy','Limit',695,20,20,'OPEN'),
(5,'TSLA','Sell','Limit',705,100,100,'OPEN');





INSERT INTO TRADES
(Buy_Order_ID,Sell_Order_ID,Quantity,Exec_Price,Fee)
VALUES
(6,5,20,1450,10),
(3,4,10,700,7);



SELECT * FROM USERS;
SELECT * FROM STOCKS;
SELECT * FROM ORDERS;
SELECT * FROM TRADES;
SELECT * FROM HOLDINGS;
SELECT * FROM AUDIT_LOG;
SELECT * FROM HOLDING_LOG;


-- populate tables
INSERT INTO USERS (Name, Email, Phone, Role, Wallet_Balance)
VALUES
('Rahul Sharma','rahul@gmail.com','9123456789','Retail',60000),
('Sneha Kapoor','sneha@gmail.com','9871234567','Retail',85000),
('Market Bot','bot@exchange.com','9999999999','MarketMaker',10000000);


INSERT INTO STOCKS VALUES
('TCS','Technology',3600,'Active'),
('RELIANCE','Energy',2500,'Active'),
('WIPRO','Technology',420,'Active');




INSERT INTO ORDERS 
(User_ID,Symbol,Side,Type,Limit_Price,Total_Qty,Rem_Qty,Status)
VALUES
(6,'AAPL','Buy','Limit',149,30,30,'OPEN'),
(7,'AAPL','Sell','Limit',151,40,40,'OPEN'),
(6,'TSLA','Buy','Limit',695,20,20,'OPEN'),
(5,'TSLA','Sell','Limit',705,100,100,'OPEN');





INSERT INTO TRADES
(Buy_Order_ID,Sell_Order_ID,Quantity,Exec_Price,Fee)
VALUES
(6,5,20,1450,10),
(3,4,10,700,7);