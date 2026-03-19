-- =============================================================================
-- Chronos Exchange — database/triggers.sql
-- =============================================================================
-- Three triggers that enforce business rules at the database layer, acting as
-- a hard safety net even if application-level checks are bypassed.
-- =============================================================================

-- Required to redefine the statement delimiter so trigger bodies
-- (which contain semicolons) don't confuse the MySQL parser.
DELIMITER $$



-- TRIGGER 1 — before_order_insert  (Pre-Insert Funds Check)

-- Fires BEFORE every INSERT into ORDERS.
-- Business rule: a user cannot place a Limit Buy order if their available
-- balance (Wallet_Balance - Reserved_Balance) is less than the order's
-- total notional value (Limit_Price × Total_Qty).
--
-- Why here and not only in the API?
--   The API already checks this, but a DB-level guard protects against:
--     • Direct SQL inserts during testing / admin work
--     • Race conditions where two orders are placed simultaneously
--       before either Reserved_Balance update is committed


DROP TRIGGER IF EXISTS before_order_insert$$

CREATE TRIGGER before_order_insert
BEFORE INSERT ON ORDERS
FOR EACH ROW
BEGIN
    DECLARE available_balance DECIMAL(15, 2);
    DECLARE required_amount   DECIMAL(15, 2);

    -- Only enforce the check for Limit Buy orders.
    -- Market orders don't have a Limit_Price, and Sell orders
    -- don't require the user to have cash upfront.
    IF NEW.Side = 'Buy' AND NEW.Type = 'Limit' THEN

        -- Pull the user's current balances
        SELECT (Wallet_Balance - Reserved_Balance)
        INTO   available_balance
        FROM   USERS
        WHERE  User_ID = NEW.User_ID;

        SET required_amount = NEW.Limit_Price * NEW.Total_Qty;

        IF available_balance < required_amount THEN
            -- SIGNAL is MySQL's mechanism for raising an application-level error.
            -- SQLSTATE '45000' = generic user-defined exception.
            -- The MESSAGE_TEXT surfaces in FastAPI as the 400/500 error detail.
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient funds: wallet balance cannot cover this order';
        END IF;

    END IF;
END$$


-- TRIGGER 2 — after_stock_status_update  (Audit Trail)

-- Fires AFTER every UPDATE on the STOCKS table.
-- Business rule: whenever a stock's Status changes (Active ↔ Halted),
-- an immutable record must be written to AUDIT_LOG.
--
-- OLD and NEW are MySQL's pseudo-records giving the row's values
-- before and after the UPDATE statement.


DROP TRIGGER IF EXISTS after_stock_status_update$$

CREATE TRIGGER after_stock_status_update
AFTER UPDATE ON STOCKS
FOR EACH ROW
BEGIN
    -- Only log when Status actually changed — ignore LTP-only updates
    IF OLD.Status <> NEW.Status THEN
        INSERT INTO AUDIT_LOG (Symbol, Old_Status, New_Status, Timestamp)
        VALUES (NEW.Symbol, OLD.Status, NEW.Status, NOW());
    END IF;
END$$


-- TRIGGER 3 — after_trade_insert  (Holdings Update + Holding Log)

-- Fires AFTER every INSERT into TRADES.
-- This is the most critical trigger — it keeps the HOLDINGS table and
-- HOLDING_LOG in sync with every executed trade without requiring the
-- matching engine to issue extra queries.
--
-- Buyer side:
--   • If the buyer already holds the stock → increase Quantity and
--     recalculate Avg_Buy_Price using the weighted-average formula:
--       new_avg = (old_qty * old_avg + new_qty * exec_price) / (old_qty + new_qty)
--   • If the buyer has no existing holding → INSERT a new row.
--
-- Seller side:
--   • Decrease Quantity by the traded amount.
--   • Quantity can reach 0 but never goes negative (the schema's
--     CHECK constraint on HOLDINGS enforces this as a final backstop).
--
-- Both sides log to HOLDING_LOG for portfolio history.


DROP TRIGGER IF EXISTS after_trade_insert$$

CREATE TRIGGER after_trade_insert
AFTER INSERT ON TRADES
FOR EACH ROW
BEGIN
    -- Variables to look up the buyer's and seller's User_IDs and the stock symbol
    DECLARE v_buy_user_id   INT;
    DECLARE v_sell_user_id  INT;
    DECLARE v_symbol        VARCHAR(10);

    -- Variables for the buyer's current holding (used in weighted-avg calc)
    DECLARE v_current_qty   INT DEFAULT 0;
    DECLARE v_current_avg   DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_new_avg       DECIMAL(10, 2);


    -- Step 1: Resolve User_IDs and Symbol from the two linked orders

    SELECT User_ID, Symbol
    INTO   v_buy_user_id, v_symbol
    FROM   ORDERS
    WHERE  Order_ID = NEW.Buy_Order_ID;

    SELECT User_ID
    INTO   v_sell_user_id
    FROM   ORDERS
    WHERE  Order_ID = NEW.Sell_Order_ID;

  
    -- Step 2: Update BUYER's holdings


    -- Check whether the buyer already owns this stock
    SELECT Quantity, Avg_Buy_Price
    INTO   v_current_qty, v_current_avg
    FROM   HOLDINGS
    WHERE  User_ID = v_buy_user_id AND Symbol = v_symbol;

    IF v_current_qty > 0 THEN
        -- Weighted-average cost basis recalculation
        SET v_new_avg = (
            (v_current_qty * v_current_avg) + (NEW.Quantity * NEW.Exec_Price)
        ) / (v_current_qty + NEW.Quantity);

        UPDATE HOLDINGS
        SET    Quantity      = Quantity + NEW.Quantity,
               Avg_Buy_Price = ROUND(v_new_avg, 2)
        WHERE  User_ID = v_buy_user_id AND Symbol = v_symbol;
    ELSE
        -- No existing holding — open a new position
        INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price)
        VALUES (v_buy_user_id, v_symbol, NEW.Quantity, NEW.Exec_Price)
        ON DUPLICATE KEY UPDATE
            -- Handles the edge case where Quantity = 0 row already exists
            Quantity      = Quantity + NEW.Quantity,
            Avg_Buy_Price = ROUND(
                ((Quantity * Avg_Buy_Price) + (NEW.Quantity * NEW.Exec_Price))
                / (Quantity + NEW.Quantity), 2
            );
    END IF;

    
    -- Step 3: Update SELLER's holdings
   
    -- We only decrease Quantity. Avg_Buy_Price is unchanged on a sell —
    -- the cost basis of remaining shares doesn't change.
    UPDATE HOLDINGS
    SET    Quantity = Quantity - NEW.Quantity
    WHERE  User_ID = v_sell_user_id AND Symbol = v_symbol;

   
    -- Step 4: Write HOLDING_LOG records for both parties
  
    -- Buyer log: positive Change_Quantity = acquired shares
    INSERT INTO HOLDING_LOG (User_ID, Symbol, Change_Quantity, Exec_Price, Timestamp)
    VALUES (v_buy_user_id, v_symbol, NEW.Quantity, NEW.Exec_Price, NOW());

    -- Seller log: negative Change_Quantity = disposed shares
    INSERT INTO HOLDING_LOG (User_ID, Symbol, Change_Quantity, Exec_Price, Timestamp)
    VALUES (v_sell_user_id, v_symbol, -NEW.Quantity, NEW.Exec_Price, NOW());

END$$


-- Restore the default delimiter
DELIMITER ;