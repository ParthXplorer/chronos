-- =============================================================================
-- Chronos Exchange — Task 6: Transaction Conflict Tests
-- =============================================================================

-- =============================================================================
-- SETUP: Clean slate for tests (Bulletproof dynamic user)
-- =============================================================================

-- Generate a random 8-character string for a guaranteed unique email
SET @rand_ext = LEFT(REPLACE(UUID(), '-', ''), 8);
SET @dyn_email = CONCAT('test_', @rand_ext, '@chronos.com');

-- Insert a fresh test user
INSERT INTO USERS (Name, Email, Phone, Role, Wallet_Balance, Reserved_Balance)
VALUES ('Test Trader X', @dyn_email, '9000000001', 'Retail', 10000.00, 0.00);

-- Capture the new valid user id
SET @uid = LAST_INSERT_ID();

-- Insert a test stock
INSERT IGNORE INTO STOCKS (Symbol, Sector, LTP, Prev_Close, Status)
VALUES ('XTEST', 'Technology', 100.00, 95.00, 'Active');

SELECT CONCAT('Test user ID = ', @uid, ' | Email = ', @dyn_email) AS setup_info;


-- =============================================================================
-- TEST 1 — Double-spend race (Bug 1)
-- =============================================================================

-- ── Session A (paste into connection 1) ──────────────────────────────────────
START TRANSACTION;
   SELECT Wallet_Balance - Reserved_Balance AS available_balance
   FROM USERS WHERE User_ID = @uid;

   DO SLEEP(3);

   UPDATE USERS
   SET Reserved_Balance = Reserved_Balance + 9000.00
   WHERE User_ID = @uid;

   INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
   VALUES (@uid, 'XTEST', 'Buy', 'Limit', 100.00, 90, 90, 'OPEN');
COMMIT;

-- ── Session B (paste into connection 2, run WHILE Session A is sleeping) ─────
START TRANSACTION;
   SELECT Wallet_Balance - Reserved_Balance AS available_balance
   FROM USERS WHERE User_ID = @uid;

   UPDATE USERS
   SET Reserved_Balance = Reserved_Balance + 9000.00
   WHERE User_ID = @uid;

   INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
   VALUES (@uid, 'XTEST', 'Buy', 'Limit', 100.00, 90, 90, 'OPEN');
COMMIT;

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT
   Wallet_Balance,
   Reserved_Balance,
   Wallet_Balance - Reserved_Balance AS available,
   CASE
     WHEN Reserved_Balance > Wallet_Balance THEN '*** BUG CONFIRMED: over-reserved ***'
     ELSE 'OK'
   END AS status
FROM USERS WHERE User_ID = @uid;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM ORDERS WHERE User_ID = @uid;
UPDATE USERS SET Reserved_Balance = 0.00 WHERE User_ID = @uid;


-- =============================================================================
-- TEST 2 — Concurrent cancel race (Bug 2)
-- =============================================================================

UPDATE USERS SET Reserved_Balance = 6000.00 WHERE User_ID = @uid;

INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (@uid, 'XTEST', 'Buy', 'Limit', 100.00, 30, 30, 'OPEN'),
       (@uid, 'XTEST', 'Buy', 'Limit', 100.00, 30, 30, 'OPEN');

SET @oid1 = LAST_INSERT_ID();
SET @oid2 = @oid1 + 1;

-- ── Session A ────────────────────────────────────────────────────────────────
START TRANSACTION;
   SELECT Reserved_Balance FROM USERS WHERE User_ID = @uid;
   DO SLEEP(2);
   
   UPDATE USERS SET Reserved_Balance = Reserved_Balance - 3000.00 WHERE User_ID = @uid;
   UPDATE ORDERS SET Status = 'CANCELLED', Rem_Qty = 0 WHERE Order_ID = @oid1;
COMMIT;

-- ── Session B (run during Session A's sleep) ─────────────────────────────────
START TRANSACTION;
   SELECT Reserved_Balance FROM USERS WHERE User_ID = @uid;
   
   UPDATE USERS SET Reserved_Balance = Reserved_Balance - 3000.00 WHERE User_ID = @uid;
   UPDATE ORDERS SET Status = 'CANCELLED', Rem_Qty = 0 WHERE Order_ID = @oid2;
COMMIT;

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT
   Reserved_Balance,
   CASE
     WHEN Reserved_Balance < 0 THEN '*** BUG CONFIRMED: negative Reserved_Balance ***'
     WHEN Reserved_Balance = 0 THEN 'OK: both cancels correctly applied'
     ELSE 'PARTIAL: one cancel applied'
   END AS status
FROM USERS WHERE User_ID = @uid;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM ORDERS WHERE User_ID = @uid;
UPDATE USERS SET Reserved_Balance = 0.00 WHERE User_ID = @uid;


-- =============================================================================
-- TEST 3 — Trigger zero-quantity re-entry (Bug 3)
-- =============================================================================

INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price)
VALUES (@uid, 'XTEST', 0, 100.00)
ON DUPLICATE KEY UPDATE Quantity = 0, Avg_Buy_Price = 100.00;

INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (@uid, 'XTEST', 'Buy', 'Limit', 105.00, 5, 5, 'FILLED');
SET @buy_oid = LAST_INSERT_ID();

INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (1, 'XTEST', 'Sell', 'Limit', 105.00, 5, 5, 'FILLED');
SET @sell_oid = LAST_INSERT_ID();

INSERT INTO TRADES (Buy_Order_ID, Sell_Order_ID, Quantity, Exec_Price, Fee)
VALUES (@buy_oid, @sell_oid, 5, 105.00, 0.05);

-- Check if Avg_Buy_Price was corrupted
SELECT
   Quantity,
   Avg_Buy_Price,
   CASE
     WHEN Avg_Buy_Price IS NULL THEN '*** BUG CONFIRMED: Avg_Buy_Price is NULL ***'
     WHEN Avg_Buy_Price = 105.00 THEN 'OK: correct average price'
     ELSE CONCAT('WRONG: expected 105.00, got ', Avg_Buy_Price)
   END AS status
FROM HOLDINGS WHERE User_ID = @uid AND Symbol = 'XTEST';

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM TRADES WHERE Buy_Order_ID = @buy_oid;
DELETE FROM ORDERS WHERE Order_ID IN (@buy_oid, @sell_oid);
DELETE FROM HOLDING_LOG WHERE User_ID = @uid AND Symbol = 'XTEST';
DELETE FROM HOLDINGS WHERE User_ID = @uid AND Symbol = 'XTEST';


-- =============================================================================
-- TEST 4 — Holdings/wallet ordering (Bug 4) + rollback behavior
-- =============================================================================

UPDATE USERS SET Wallet_Balance = 50.00, Reserved_Balance = 0.00 WHERE User_ID = @uid;

START TRANSACTION;
   INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price)
   VALUES (@uid, 'XTEST', 10, 100.00)
   ON DUPLICATE KEY UPDATE Quantity = Quantity + 10, Avg_Buy_Price = 100.00;

   -- Should fail and rollback
   UPDATE USERS SET Wallet_Balance = Wallet_Balance - 1000.00 WHERE User_ID = @uid;
COMMIT;

SELECT
   u.Wallet_Balance,
   h.Quantity,
   CASE
     WHEN u.Wallet_Balance < 0 THEN '*** BUG: wallet went negative ***'
     WHEN h.Quantity IS NULL OR h.Quantity = 0 THEN 'OK: transaction rolled back atomically'
     WHEN h.Quantity > 0 AND u.Wallet_Balance >= 0 THEN '*** BUG: holdings updated but wallet not debited ***'
     ELSE 'Unexpected state'
   END AS atomicity_status
FROM USERS u
LEFT JOIN HOLDINGS h ON h.User_ID = u.User_ID AND h.Symbol = 'XTEST'
WHERE u.User_ID = @uid;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM HOLDINGS WHERE User_ID = @uid AND Symbol = 'XTEST';
UPDATE USERS SET Wallet_Balance = 10000.00, Reserved_Balance = 0.00 WHERE User_ID = @uid;


-- =============================================================================
-- TEST 5 — Trigger self-trade check 
-- =============================================================================

INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (@uid, 'XTEST', 'Buy',  'Limit', 100.00, 10, 10, 'FILLED');
SET @same_oid = LAST_INSERT_ID();

INSERT INTO TRADES (Buy_Order_ID, Sell_Order_ID, Quantity, Exec_Price, Fee)
VALUES (@same_oid, @same_oid, 10, 100.00, 0.10);

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM ORDERS WHERE Order_ID = @same_oid;


-- =============================================================================
-- TEST 6 — Trigger before_order_insert
-- =============================================================================

-- Should fail:
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (@uid, 'XTEST', 'Buy', 'Limit', 1500.00, 10, 10, 'OPEN');

-- Should pass:
INSERT INTO ORDERS (User_ID, Symbol, Side, Type, Limit_Price, Total_Qty, Rem_Qty, Status)
VALUES (@uid, 'XTEST', 'Buy', 'Limit', 500.00, 10, 10, 'OPEN');

SELECT Reserved_Balance FROM USERS WHERE User_ID = @uid;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
DELETE FROM ORDERS WHERE User_ID = @uid;


-- =============================================================================
-- TEST 7 — Deadlock scenario 
-- =============================================================================

INSERT IGNORE INTO STOCKS (Symbol, Sector, LTP, Prev_Close, Status)
VALUES ('YTEST', 'Technology', 200.00, 190.00, 'Active');

SET @dyn_email_b = CONCAT('test_', LEFT(REPLACE(UUID(), '-', ''), 8), '_b@chronos.com');
INSERT INTO USERS (Name, Email, Role, Wallet_Balance, Password_Hash)
VALUES ('Trader B', @dyn_email_b, 'Retail', 20000.00, 'x');
SET @uid2 = LAST_INSERT_ID();

-- ── Session A ────────────────────────────────────────────────────────────────
START TRANSACTION;
   UPDATE USERS SET Reserved_Balance = Reserved_Balance + 1000.00 WHERE User_ID = @uid;
   DO SLEEP(2);
   UPDATE USERS SET Reserved_Balance = Reserved_Balance + 2000.00 WHERE User_ID = @uid2;
COMMIT;

-- ── Session B (run during Session A's sleep) ─────────────────────────────────
START TRANSACTION;
   UPDATE USERS SET Reserved_Balance = Reserved_Balance + 2000.00 WHERE User_ID = @uid2;
   UPDATE USERS SET Reserved_Balance = Reserved_Balance + 1000.00 WHERE User_ID = @uid;
COMMIT;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
UPDATE USERS SET Reserved_Balance = 0.00 WHERE User_ID IN (@uid, @uid2);
DELETE FROM USERS WHERE User_ID = @uid2;
DELETE FROM STOCKS WHERE Symbol = 'YTEST';


-- =============================================================================
-- TEST 8 — Isolation level demonstration
-- =============================================================================

START TRANSACTION;
   SELECT Symbol, LTP FROM STOCKS WHERE Sector = 'Technology';
   DO SLEEP(5);
   SELECT Symbol, LTP FROM STOCKS WHERE Sector = 'Technology';
COMMIT;

SELECT @@transaction_isolation;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
UPDATE STOCKS SET LTP = 100.00 WHERE Symbol = 'XTEST';


-- =============================================================================
-- FINAL CLEANUP
-- =============================================================================

DELETE FROM HOLDING_LOG WHERE User_ID = @uid OR Symbol = 'XTEST';
DELETE FROM HOLDINGS WHERE User_ID = @uid;
DELETE FROM ORDERS WHERE User_ID = @uid;
DELETE FROM USERS WHERE User_ID = @uid;
DELETE FROM STOCKS WHERE Symbol = 'XTEST';