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
    std::vector<Order> skipped;  // self-trade orders temporarily removed

    if (incoming.side == Side::Buy) {
        while (incoming.quantity > 0 && book.hasAsk()) {
            double best_ask = book.bestAskPrice();
            if (incoming.limit_price < best_ask) break;

            Order& resting = book.bestAsk();

            if (incoming.user_id == resting.user_id) {
                skipped.push_back(resting);  // save a copy
                book.popBestAsk();           // remove so next bestAsk() advances
                continue;
            }

            fills.push_back(makeFill(incoming, resting));
            if (resting.quantity == 0) book.popBestAsk();
        }
        // Restore skipped orders — note: they rejoin at back of their
        // price level, losing original time priority (known tradeoff)
        for (auto& o : skipped) book.addAsk(o);

        if (incoming.quantity > 0) book.addBid(incoming);

    } else {
        while (incoming.quantity > 0 && book.hasBid()) {
            double best_bid = book.bestBidPrice();
            if (incoming.limit_price > best_bid) break;

            Order& resting = book.bestBid();

            if (incoming.user_id == resting.user_id) {
                skipped.push_back(resting);
                book.popBestBid();
                continue;
            }

            fills.push_back(makeFill(incoming, resting));
            if (resting.quantity == 0) book.popBestBid();
        }
        for (auto& o : skipped) book.addBid(o);

        if (incoming.quantity > 0) book.addAsk(incoming);
    }

    return fills;
}

// ── matchMarket ───────────────────────────────────────────────────────────────
std::vector<TradeResult> MatchingEngine::matchMarket(Order& incoming) {
    std::vector<TradeResult> fills;
    OrderBook& book = getBook(incoming.symbol);
    std::vector<Order> skipped;

    if (incoming.side == Side::Buy) {
        while (incoming.quantity > 0 && book.hasAsk()) {
            Order& resting = book.bestAsk();

            if (incoming.user_id == resting.user_id) {
                skipped.push_back(resting);
                book.popBestAsk();
                continue;
            }

            fills.push_back(makeFill(incoming, resting));
            if (resting.quantity == 0) book.popBestAsk();
        }
        for (auto& o : skipped) book.addAsk(o);

    } else {
        while (incoming.quantity > 0 && book.hasBid()) {
            Order& resting = book.bestBid();

            if (incoming.user_id == resting.user_id) {
                skipped.push_back(resting);
                book.popBestBid();
                continue;
            }

            fills.push_back(makeFill(incoming, resting));
            if (resting.quantity == 0) book.popBestBid();
        }
        for (auto& o : skipped) book.addBid(o);
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