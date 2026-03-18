#pragma once

#include "Types.h"
#include "OrderBook.h"

#include <unordered_map>
#include <vector>
#include <string>

// ── MatchingEngine ────────────────────────────────────────────────────────────
//
// Owns one OrderBook per symbol.
// submitOrder() is the single entry point — it routes to matchLimit() or
// matchMarket() and returns all TradeResult objects produced by that order.
//
// Design decisions:
//   • Limit order:  match against the opposite side first (aggressive match),
//                   then rest any unfilled remainder on the book.
//   • Market order: match aggressively until filled or the book is exhausted;
//                   never rest on the book (a market order is always immediate).
//   • Fee:          0.01 % of notional (exec_price × qty), charged on each fill.
//   • Self-trade:   prevented — if buy_user_id == sell_user_id the fill is
//                   skipped (the resting order is left in place, the aggressor
//                   continues scanning deeper prices).
//
class MatchingEngine {
public:
    // Normal entry point — match aggressively, rest remainder, return fills.
    std::vector<TradeResult> submitOrder(Order incoming);

    // Replay entry point — place an order directly onto the book WITHOUT
    // attempting to match it.  Used on startup to restore book state from
    // the DB.  Market orders are silently ignored (they can never rest).
    void restOrder(const Order& order);

private:
    // Per-symbol order books
    std::unordered_map<std::string, OrderBook> books_;

    // Returns or creates the book for `symbol`
    OrderBook& getBook(const std::string& symbol);

    // Match a limit order aggressively, return fills, rest remainder.
    std::vector<TradeResult> matchLimit(Order& incoming);

    // Match a market order aggressively until filled or book exhausted.
    std::vector<TradeResult> matchMarket(Order& incoming);

    // Core fill step: given aggressor + resting order that have already been
    // confirmed to cross, produce one TradeResult and adjust both quantities.
    TradeResult makeFill(Order& aggressor, Order& resting);

    static constexpr double FEE_RATE = 0.0001;  // 0.01 %
};