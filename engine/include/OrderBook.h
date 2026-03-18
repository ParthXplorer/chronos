#pragma once

#include "Types.h"

#include <map>
#include <deque>
#include <vector>
#include <functional>
#include <stdexcept>

// ── PriceLevel ────────────────────────────────────────────────────────────────
// A FIFO queue of orders sitting at the same limit price.
// Time priority is preserved naturally because orders are pushed to the back.
struct PriceLevel {
    std::deque<Order> orders;

    void push(const Order& o)  { orders.push_back(o); }
    bool empty()         const { return orders.empty(); }
    Order& front()             { return orders.front(); }
    void   pop()               { orders.pop_front(); }
};

// ── OrderBook ─────────────────────────────────────────────────────────────────
//
// Bids: std::map<double, PriceLevel, std::greater<double>>
//   → highest price is map.begin() (best bid)
//
// Asks: std::map<double, PriceLevel>
//   → lowest price is map.begin() (best ask)
//
// Both sides use price-time priority:
//   1. Best price matched first
//   2. Ties broken by insertion order (FIFO via deque)
//
class OrderBook {
public:
    using BidMap = std::map<double, PriceLevel, std::greater<double>>;
    using AskMap = std::map<double, PriceLevel>;

    // ── Insert a resting order ────────────────────────────────────────────────
    void addBid(const Order& o) { bids_[o.limit_price].push(o); }
    void addAsk(const Order& o) { asks_[o.limit_price].push(o); }

    // ── Best-price accessors ──────────────────────────────────────────────────
    bool hasBid() const { return !bids_.empty(); }
    bool hasAsk() const { return !asks_.empty(); }

    double bestBidPrice() const {
        if (bids_.empty()) throw std::runtime_error("No bids");
        return bids_.begin()->first;
    }
    double bestAskPrice() const {
        if (asks_.empty()) throw std::runtime_error("No asks");
        return asks_.begin()->first;
    }

    // Front order at best price (mutable — we modify Rem_Qty in-place)
    Order& bestBid() { return bids_.begin()->second.front(); }
    Order& bestAsk() { return asks_.begin()->second.front(); }

    // Remove the exhausted front order from the best level;
    // clean up the price level itself if it empties.
    void popBestBid() {
        auto it = bids_.begin();
        it->second.pop();
        if (it->second.empty()) bids_.erase(it);
    }
    void popBestAsk() {
        auto it = asks_.begin();
        it->second.pop();
        if (it->second.empty()) asks_.erase(it);
    }

    // ── Snapshot helpers (used by the Python WS feed via REST) ────────────────
    // Returns up to `depth` levels from the bid side (price desc).
    std::vector<std::pair<double,int64_t>> bidLevels(size_t depth = 5) const {
        std::vector<std::pair<double,int64_t>> out;
        for (auto& [price, level] : bids_) {
            if (out.size() >= depth) break;
            int64_t qty = 0;
            for (auto& o : level.orders) qty += o.quantity;
            out.emplace_back(price, qty);
        }
        return out;
    }
    // Returns up to `depth` levels from the ask side (price asc).
    std::vector<std::pair<double,int64_t>> askLevels(size_t depth = 5) const {
        std::vector<std::pair<double,int64_t>> out;
        for (auto& [price, level] : asks_) {
            if (out.size() >= depth) break;
            int64_t qty = 0;
            for (auto& o : level.orders) qty += o.quantity;
            out.emplace_back(price, qty);
        }
        return out;
    }

private:
    BidMap bids_;   // highest price → best bid
    AskMap asks_;   // lowest  price → best ask
};