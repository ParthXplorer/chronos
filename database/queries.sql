-- =============================================================================
-- Chronos Exchange — database/queries.sql
-- =============================================================================
-- 12 analytical and operational queries.
-- Replace the placeholder values (e.g. 'AAPL', user_id = 2) with parameters
-- when calling these from application code.
-- =============================================================================


-- =============================================================================
-- Q1 — Market Watch
-- Purpose : Live LTP for all stocks in the Technology sector.
-- Use case : "Market Watch" panel on the front-end dashboard.
-- =============================================================================
SELECT  Symbol,
        LTP,
        Status
FROM    STOCKS
WHERE   Sector = 'Technology'
  AND   Status = 'Active'
ORDER   BY Symbol;


-- =============================================================================
-- Q2 — Order Book View (Price-Time Priority)
-- Purpose : Top 5 bids and top 5 asks for a specific symbol.
-- Use case : Real-time depth-of-market widget.
-- Note    : Two separate result sets — run together or call separately.
--           Replace 'AAPL' with the target symbol.
-- =============================================================================

-- Top 5 Bids (highest price first; ties broken by earliest timestamp)
SELECT  Order_ID,
        Limit_Price  AS Price,
        Rem_Qty      AS Quantity,
        Timestamp
FROM    ORDERS
WHERE   Symbol = 'AAPL'
  AND   Side   = 'Buy'
  AND   Status IN ('OPEN', 'PARTIAL')
ORDER   BY Limit_Price DESC, Timestamp ASC
LIMIT   5;

-- Top 5 Asks (lowest price first; ties broken by earliest timestamp)
SELECT  Order_ID,
        Limit_Price  AS Price,
        Rem_Qty      AS Quantity,
        Timestamp
FROM    ORDERS
WHERE   Symbol = 'AAPL'
  AND   Side   = 'Sell'
  AND   Status IN ('OPEN', 'PARTIAL')
ORDER   BY Limit_Price ASC, Timestamp ASC
LIMIT   5;


-- =============================================================================
-- Q3 — Active Orders for a Specific User
-- Purpose : All open or partially filled orders for user_id = 2, newest first.
-- Use case : "My Orders" tab in the user portal.
-- =============================================================================
SELECT  Order_ID,
        Symbol,
        Side,
        Type,
        Limit_Price,
        Total_Qty,
        Rem_Qty,
        Status,
        Timestamp
FROM    ORDERS
WHERE   User_ID = 2                          -- replace with target user_id
  AND   Status IN ('OPEN', 'PARTIAL')
ORDER   BY Timestamp DESC;


-- =============================================================================
-- Q4 — Trade History (Last 30 Days)
-- Purpose : All trades involving a specific user in the past 30 days,
--           with execution price and total cost per trade.
-- Use case : "Trade History" page; downloadable statement.
-- Note    : A user can appear on either side of a trade, so we UNION
--           the buy-side and sell-side lookups.
-- =============================================================================
SELECT  t.Trade_ID,
        o.Symbol,
        'Buy'                                     AS Side,
        t.Quantity,
        t.Exec_Price,
        ROUND(t.Exec_Price * t.Quantity, 2)       AS Total_Cost,
        t.Fee,
        t.Timestamp
FROM    TRADES t
JOIN    ORDERS o ON o.Order_ID = t.Buy_Order_ID
WHERE   o.User_ID = 2                            -- replace with target user_id
  AND   t.Timestamp >= NOW() - INTERVAL 30 DAY

UNION ALL

SELECT  t.Trade_ID,
        o.Symbol,
        'Sell'                                    AS Side,
        t.Quantity,
        t.Exec_Price,
        ROUND(t.Exec_Price * t.Quantity, 2)       AS Total_Cost,
        t.Fee,
        t.Timestamp
FROM    TRADES t
JOIN    ORDERS o ON o.Order_ID = t.Sell_Order_ID
WHERE   o.User_ID = 2                            -- replace with target user_id
  AND   t.Timestamp >= NOW() - INTERVAL 30 DAY

ORDER   BY Timestamp DESC;


-- =============================================================================
-- Q5 — Top Gainers / Losers
-- Purpose : Top 3 stocks by highest LTP (gainers).
--           Swap ORDER BY direction for bottom 3 (losers).
-- Use case : "Movers" widget on the dashboard.
-- =============================================================================

-- Top 3 Gainers
SELECT  Symbol,
        Sector,
        LTP
FROM    STOCKS
WHERE   Status = 'Active'
ORDER   BY LTP DESC
LIMIT   3;

-- Top 3 Losers
SELECT  Symbol,
        Sector,
        LTP
FROM    STOCKS
WHERE   Status = 'Active'
ORDER   BY LTP ASC
LIMIT   3;


-- =============================================================================
-- Q6 — Volatility Analysis
-- Purpose : Standard deviation of execution prices for AAPL.
-- Use case : Risk badge on stock detail page ("High / Low volatility").
-- Note    : STDDEV_POP uses the entire population of trades.
--           Use STDDEV_SAMP if you want the sample std-dev.
-- =============================================================================
SELECT  o.Symbol,
        ROUND(STDDEV_POP(t.Exec_Price), 4)   AS Price_StdDev,
        ROUND(AVG(t.Exec_Price),        2)   AS Avg_Price,
        MIN(t.Exec_Price)                    AS Min_Price,
        MAX(t.Exec_Price)                    AS Max_Price,
        COUNT(*)                             AS Total_Trades
FROM    TRADES t
JOIN    ORDERS o ON o.Order_ID = t.Buy_Order_ID
WHERE   o.Symbol = 'AAPL';


-- =============================================================================
-- Q7 — Whale Alert
-- Purpose : All trades with notional value > 100 000 executed in the last hour.
-- Use case : Real-time "Whale Alert" feed; compliance monitoring.
-- =============================================================================
SELECT  t.Trade_ID,
        o.Symbol,
        t.Quantity,
        t.Exec_Price,
        ROUND(t.Exec_Price * t.Quantity, 2)  AS Trade_Value,
        t.Fee,
        t.Timestamp
FROM    TRADES t
JOIN    ORDERS o ON o.Order_ID = t.Buy_Order_ID
WHERE   (t.Exec_Price * t.Quantity) > 100000
  AND   t.Timestamp >= NOW() - INTERVAL 1 HOUR
ORDER   BY t.Timestamp DESC;


-- =============================================================================
-- Q8 — Liquidity Check (Supply vs Demand)
-- Purpose : Total remaining buy quantity vs total remaining sell quantity
--           for TSLA across all open/partial orders.
-- Use case : Liquidity indicator; "market depth" summary card.
-- =============================================================================
SELECT
    SUM(CASE WHEN Side = 'Buy'  THEN Rem_Qty ELSE 0 END)  AS Total_Demand,
    SUM(CASE WHEN Side = 'Sell' THEN Rem_Qty ELSE 0 END)  AS Total_Supply,
    ROUND(
        SUM(CASE WHEN Side = 'Buy'  THEN Rem_Qty ELSE 0 END) /
        NULLIF(SUM(CASE WHEN Side = 'Sell' THEN Rem_Qty ELSE 0 END), 0)
    , 2)                                                   AS Demand_Supply_Ratio
FROM    ORDERS
WHERE   Symbol = 'TSLA'
  AND   Status IN ('OPEN', 'PARTIAL');


-- =============================================================================
-- Q9 — Unrealized P&L
-- Purpose : For every position in a user's portfolio, compare average buy
--           price against the current LTP to compute unrealized gain/loss.
-- Use case : Portfolio P&L table; displayed on the holdings screen.
-- =============================================================================
SELECT  h.Symbol,
        h.Quantity,
        h.Avg_Buy_Price,
        s.LTP                                               AS Current_Price,
        ROUND((s.LTP - h.Avg_Buy_Price) * h.Quantity, 2)   AS Unrealized_PnL,
        ROUND(
            ((s.LTP - h.Avg_Buy_Price) / h.Avg_Buy_Price) * 100
        , 2)                                                AS PnL_Percent
FROM    HOLDINGS h
JOIN    STOCKS   s ON s.Symbol = h.Symbol
WHERE   h.User_ID  = 2                       -- replace with target user_id
  AND   h.Quantity > 0
ORDER   BY Unrealized_PnL DESC;


-- =============================================================================
-- Q10 — System Volume (Today)
-- Purpose : Total shares traded, total notional turnover, and total fees
--           collected across the entire exchange for the current calendar day.
-- Use case : Exchange health dashboard; end-of-day report.
-- =============================================================================
SELECT  COALESCE(SUM(Quantity), 0)                    AS Total_Shares_Traded,
        COALESCE(SUM(Exec_Price * Quantity), 0)       AS Total_Notional_Value,
        COALESCE(SUM(Fee), 0)                         AS Total_Fees_Collected,
        COUNT(*)                                      AS Total_Trades
FROM    TRADES
WHERE   DATE(Timestamp) = CURDATE();


-- =============================================================================
-- Q11 — User Activity Audit (Suspicious Users)
-- Purpose : Find users who have placed more than 2 orders but have never
--           been involved in a completed trade (neither as buyer nor seller).
-- Use case : Admin panel — bot detection, spam prevention.
-- Note    : LEFT JOIN to TRADES on both sides; NULL Trade_ID means
--           none of their orders were matched.
-- =============================================================================
SELECT  u.User_ID,
        u.Name,
        u.Email,
        COUNT(DISTINCT o.Order_ID)   AS Order_Count
FROM    USERS  u
JOIN    ORDERS o ON o.User_ID = u.User_ID
LEFT JOIN TRADES t
       ON  t.Buy_Order_ID  = o.Order_ID
        OR t.Sell_Order_ID = o.Order_ID
WHERE   t.Trade_ID IS NULL           -- never participated in a trade
GROUP   BY u.User_ID, u.Name, u.Email
HAVING  COUNT(DISTINCT o.Order_ID) > 2
ORDER   BY Order_Count DESC;


-- =============================================================================
-- Q12 — Commission Report
-- Purpose : Total fees collected by the exchange, broken down by stock symbol
--           and aggregated overall.
-- Use case : Finance team report; revenue tracking.
-- =============================================================================
SELECT  o.Symbol,
        COUNT(t.Trade_ID)               AS Trade_Count,
        SUM(t.Quantity)                 AS Total_Volume,
        ROUND(SUM(t.Fee), 2)            AS Fees_Collected
FROM    TRADES t
JOIN    ORDERS o ON o.Order_ID = t.Buy_Order_ID
GROUP   BY o.Symbol
ORDER   BY Fees_Collected DESC;