#pragma once

#include <string>
#include <cstdint>

// ── Side ──────────────────────────────────────────────────────────────────────
enum class Side : uint8_t { Buy, Sell };

// ── OrderType ─────────────────────────────────────────────────────────────────
enum class OrderType : uint8_t { Limit, Market };

// ── Order ─────────────────────────────────────────────────────────────────────
// Mirrors the ORDERS table row; the engine only cares about the fields below.
struct Order {
    int64_t  order_id   = 0;
    int64_t  user_id    = 0;
    std::string symbol;
    Side     side       = Side::Buy;
    OrderType type      = OrderType::Limit;
    double   limit_price = 0.0;   // 0 for Market orders
    int64_t  quantity   = 0;      // remaining quantity to match
};

// ── TradeResult ───────────────────────────────────────────────────────────────
// One fill event. The engine emits a stream of these (one per match step).
// The Python bridge reads them and inserts rows into TRADES + updates ORDERS.
struct TradeResult {
    int64_t buy_order_id  = 0;
    int64_t sell_order_id = 0;
    int64_t quantity      = 0;
    double  exec_price    = 0.0;
    double  fee           = 0.0;  // 0.01% of notional — computed in engine
};