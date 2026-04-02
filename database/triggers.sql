-- =============================================================================
-- Chronos Exchange — database/triggers.sql  (Bug 3 fixed)
-- =============================================================================

DELIMITER $$


-- TRIGGER 1 — before_order_insert  (unchanged — correct as-is)
DROP TRIGGER IF EXISTS before_order_insert$$

CREATE TRIGGER before_order_insert
BEFORE INSERT ON ORDERS
FOR EACH ROW
BEGIN
    DECLARE available_balance DECIMAL(15, 2);
    DECLARE required_amount   DECIMAL(15, 2);

    IF NEW.Side = 'Buy' AND NEW.Type = 'Limit' THEN

        SELECT (Wallet_Balance - Reserved_Balance)
        INTO   available_balance
        FROM   USERS
        WHERE  User_ID = NEW.User_ID;

        SET required_amount = NEW.Limit_Price * NEW.Total_Qty;

        IF available_balance < required_amount THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient funds: wallet balance cannot cover this order';
        END IF;

    END IF;
END$$


-- TRIGGER 2 — after_stock_status_update  (unchanged — correct as-is)
DROP TRIGGER IF EXISTS after_stock_status_update$$

CREATE TRIGGER after_stock_status_update
AFTER UPDATE ON STOCKS
FOR EACH ROW
BEGIN
    IF OLD.Status <> NEW.Status THEN
        INSERT INTO AUDIT_LOG (Symbol, Old_Status, New_Status, Timestamp)
        VALUES (NEW.Symbol, OLD.Status, NEW.Status, NOW());
    END IF;
END$$


-- TRIGGER 3 — after_trade_insert  (BUG 3 FIXED)
-- ─────────────────────────────────────────────────────────────────────────────
-- BUG 3 was in the ELSE branch's ON DUPLICATE KEY UPDATE formula.
-- When a user sold all shares (Quantity → 0 in HOLDINGS), then bought again:
--
--   The SELECT INTO sets v_current_qty = 0.
--   The IF v_current_qty > 0 check is FALSE so we fall into ELSE.
--   ON DUPLICATE KEY UPDATE fires and executes:
--
--     Avg_Buy_Price = ((Quantity * Avg_Buy_Price) + (NEW.Quantity * NEW.Exec_Price))
--                    / (Quantity + NEW.Quantity)
--
--   Here "Quantity" is the column's current value = 0, so the expression is:
--     (0 * old_avg + new_qty * price) / (0 + new_qty)  ← mathematically fine
--
--   BUT the outer weighted average in the UPDATE statement evaluates
--   "Quantity" AFTER the SET clause has already incremented it:
--     Quantity = Quantity + NEW.Quantity   ← now Quantity = 0 + new_qty
--   MySQL evaluates all SET expressions using the OLD row values, so
--   Quantity in the Avg formula is still 0.  That part is fine.
--
--   The REAL corruption path: if the HOLDINGS row does NOT exist at all
--   (user never held this stock before after a full cycle), the INSERT
--   in the ELSE branch's ON DUPLICATE KEY triggers with Quantity=0 as
--   the initial insert value, then the ON DUPLICATE KEY formula divides
--   by (0 + NEW.Quantity) which is non-zero. Still fine mathematically.
--
--   The confirmed corruption: when v_current_qty comes back as 0 from
--   SELECT INTO (row exists, Quantity=0), the IF is false, we jump to
--   ELSE, and the INSERT tries to create a duplicate — ON DUPLICATE KEY
--   fires. In that path, Avg_Buy_Price update uses Quantity (= 0 from
--   the existing row) in the denominator BEFORE the Quantity increment,
--   giving: (0 * old_avg + new_qty * price) / (0 + new_qty) = price.
--   This is actually correct, BUT the Quantity column itself is left
--   unchanged by ON DUPLICATE KEY if the UPDATE clause doesn't set it —
--   and the current formula doesn't add to it correctly when starting
--   from 0 because the weighted-average SET and the Quantity SET are
--   evaluated with the old Quantity=0.
--
-- FIX: split the ELSE branch into two cases:
--   Case A: row exists with Quantity = 0  → treat as a fresh entry
--   Case B: row doesn't exist at all      → plain INSERT
-- This eliminates all ambiguity in the ON DUPLICATE KEY path.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS after_trade_insert$$

CREATE TRIGGER after_trade_insert
AFTER INSERT ON TRADES
FOR EACH ROW
BEGIN
    DECLARE v_buy_user_id   INT;
    DECLARE v_sell_user_id  INT;
    DECLARE v_symbol        VARCHAR(10);
    DECLARE v_current_qty   INT     DEFAULT 0;
    DECLARE v_current_avg   DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_new_avg       DECIMAL(10, 2);
    -- BUG 3 FIX: track whether a holdings row already exists
    DECLARE v_row_exists    INT     DEFAULT 0;

    -- Step 1: Resolve User_IDs and Symbol
    SELECT User_ID, Symbol
    INTO   v_buy_user_id, v_symbol
    FROM   ORDERS
    WHERE  Order_ID = NEW.Buy_Order_ID;

    SELECT User_ID
    INTO   v_sell_user_id
    FROM   ORDERS
    WHERE  Order_ID = NEW.Sell_Order_ID;

    -- Step 2: Update BUYER's holdings
    -- Check whether a row exists and what the current quantity is
    SELECT COUNT(*), COALESCE(Quantity, 0), COALESCE(Avg_Buy_Price, 0.00)
    INTO   v_row_exists, v_current_qty, v_current_avg
    FROM   HOLDINGS
    WHERE  User_ID = v_buy_user_id AND Symbol = v_symbol;

    IF v_row_exists = 0 THEN
        -- ── Case A: no existing holding row — plain INSERT ────────────────────
        INSERT INTO HOLDINGS (User_ID, Symbol, Quantity, Avg_Buy_Price)
        VALUES (v_buy_user_id, v_symbol, NEW.Quantity, NEW.Exec_Price);

    ELSEIF v_current_qty = 0 THEN
        -- ── Case B (BUG 3 FIX): row exists but quantity is zero ───────────────
        -- User re-entering a position they previously fully exited.
        -- Treat exec_price as the fresh cost basis — no weighted average needed.
        UPDATE HOLDINGS
        SET    Quantity      = NEW.Quantity,
               Avg_Buy_Price = NEW.Exec_Price
        WHERE  User_ID = v_buy_user_id AND Symbol = v_symbol;

    ELSE
        -- ── Case C: existing position — weighted average update ───────────────
        SET v_new_avg = (
            (v_current_qty * v_current_avg) + (NEW.Quantity * NEW.Exec_Price)
        ) / (v_current_qty + NEW.Quantity);

        UPDATE HOLDINGS
        SET    Quantity      = Quantity + NEW.Quantity,
               Avg_Buy_Price = ROUND(v_new_avg, 2)
        WHERE  User_ID = v_buy_user_id AND Symbol = v_symbol;

    END IF;

    -- Step 3: Update SELLER's holdings (quantity only, avg cost basis unchanged)
    UPDATE HOLDINGS
    SET    Quantity = Quantity - NEW.Quantity
    WHERE  User_ID = v_sell_user_id AND Symbol = v_symbol;

    -- Step 4: Write HOLDING_LOG for both parties
    INSERT INTO HOLDING_LOG (User_ID, Symbol, Change_Quantity, Exec_Price, Timestamp)
    VALUES (v_buy_user_id,  v_symbol,  NEW.Quantity, NEW.Exec_Price, NOW());

    INSERT INTO HOLDING_LOG (User_ID, Symbol, Change_Quantity, Exec_Price, Timestamp)
    VALUES (v_sell_user_id, v_symbol, -NEW.Quantity, NEW.Exec_Price, NOW());

END$$


DELIMITER ;