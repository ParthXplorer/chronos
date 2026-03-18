#include "MatchingEngine.h"
#include <cmath>

// ── Internal helper ───────────────────────────────────────────────────────────

OrderBook& MatchingEngine::getBook(const std::string& symbol) {
    return books_[symbol];   // default-constructs an empty OrderBook if new
}

// ── makeFill ──────────────────────────────────────────────────────────────────
// Called only when we already know aggressor and resting cross.
// Computes fill quantity (the minimum of the two remaining quantities),
// applies it, and returns the TradeResult.
TradeResult MatchingEngine::makeFill(Order& aggressor, Order& resting) {
    int64_t fill_qty = std::min(aggressor.quantity, resting.quantity);

    // Execution price is always the resting order's limit price
    // (the order that was already sitting in the book sets the price).
    double exec_price = resting.limit_price;

    double notional = exec_price * static_cast<double>(fill_qty);
    double fee      = std::round(notional * FEE_RATE * 100.0) / 100.0;

    // Identify buy/sell order IDs for the TRADES insert
    int64_t buy_id, sell_id;
    if (aggressor.side == Side::Buy) {
        buy_id  = aggressor.order_id;
        sell_id = resting.order_id;
    } else {
        buy_id  = resting.order_id;
        sell_id = aggressor.order_id;
    }

    TradeResult tr{buy_id, sell_id, fill_qty, exec_price, fee};

    // Deduct from both sides
    aggressor.quantity -= fill_qty;
    resting.quantity   -= fill_qty;

    return tr;
}

// ── restOrder ─────────────────────────────────────────────────────────────────
// Replay path: insert an order directly onto the book, no matching.
void MatchingEngine::restOrder(const Order& order) {
    if (order.type == OrderType::Market) return;   // market orders never rest
    if (order.quantity <= 0)             return;   // nothing to place

    OrderBook& book = getBook(order.symbol);
    if (order.side == Side::Buy)  book.addBid(order);
    else                          book.addAsk(order);
}


std::vector<TradeResult> MatchingEngine::matchLimit(Order& incoming) {
    std::vector<TradeResult> fills;
    OrderBook& book = getBook(incoming.symbol);

    if (incoming.side == Side::Buy) {
        // A buy limit crosses when its limit_price >= best ask price
        while (incoming.quantity > 0 && book.hasAsk()) {
            double best_ask = book.bestAskPrice();
            if (incoming.limit_price < best_ask) break;  // no longer crosses

            Order& resting = book.bestAsk();

            // Self-trade prevention
            if (incoming.user_id == resting.user_id) {
                // Skip this level — don't pop it, just stop matching
                // (a more sophisticated engine would scan deeper, but for
                //  this exchange design we simply stop the aggressor here)
                break;
            }

            fills.push_back(makeFill(incoming, resting));

            if (resting.quantity == 0) book.popBestAsk();
        }

        // Rest any unfilled remainder on the bid side
        if (incoming.quantity > 0) {
            book.addBid(incoming);
        }

    } else {
        // A sell limit crosses when its limit_price <= best bid price
        while (incoming.quantity > 0 && book.hasBid()) {
            double best_bid = book.bestBidPrice();
            if (incoming.limit_price > best_bid) break;

            Order& resting = book.bestBid();

            if (incoming.user_id == resting.user_id) {
                break;
            }

            fills.push_back(makeFill(incoming, resting));

            if (resting.quantity == 0) book.popBestBid();
        }

        if (incoming.quantity > 0) {
            book.addAsk(incoming);
        }
    }

    return fills;
}

// ── matchMarket ───────────────────────────────────────────────────────────────
std::vector<TradeResult> MatchingEngine::matchMarket(Order& incoming) {
    std::vector<TradeResult> fills;
    OrderBook& book = getBook(incoming.symbol);

    if (incoming.side == Side::Buy) {
        while (incoming.quantity > 0 && book.hasAsk()) {
            Order& resting = book.bestAsk();

            if (incoming.user_id == resting.user_id) break;

            // For market orders we use the resting ask's limit price
            // makeFill() already picks resting.limit_price as exec_price
            fills.push_back(makeFill(incoming, resting));

            if (resting.quantity == 0) book.popBestAsk();
        }
        // Market orders never rest — if unfilled, they are simply rejected
        // (the Python bridge treats remaining_qty > 0 as a partial/cancel)

    } else {
        while (incoming.quantity > 0 && book.hasBid()) {
            Order& resting = book.bestBid();

            if (incoming.user_id == resting.user_id) break;

            fills.push_back(makeFill(incoming, resting));

            if (resting.quantity == 0) book.popBestBid();
        }
    }

    return fills;
}

// ── submitOrder ───────────────────────────────────────────────────────────────
std::vector<TradeResult> MatchingEngine::submitOrder(Order incoming) {
    if (incoming.type == OrderType::Market) {
        return matchMarket(incoming);
    }
    return matchLimit(incoming);
}