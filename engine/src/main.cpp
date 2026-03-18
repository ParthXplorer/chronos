// engine/src/main.cpp
//
// IPC protocol
// ─────────────────────────────────────────────────────────────────────────────
// Every message is a single JSON object on one line, followed by a blank line.
// The engine replies with zero-or-more JSON lines then a blank line terminator.
//
// ── Command: "submit" (normal order placement) ────────────────────────────────
// STDIN:
//   {"cmd":"submit","order_id":<int>,"user_id":<int>,"symbol":"<str>",
//    "side":"Buy"|"Sell","type":"Limit"|"Market",
//    "limit_price":<float>,"quantity":<int>}
//
// STDOUT: zero or more trade lines, then blank line
//   {"buy_order_id":<int>,"sell_order_id":<int>,
//    "quantity":<int>,"exec_price":<float>,"fee":<float>}
//
// ── Command: "load" (replay resting order on startup, no matching) ───────────
// STDIN:  same fields as submit, cmd="load"
// STDOUT: exactly one line, then blank line
//   {"loaded":true}
//
// ── Command: "ping" (health check) ───────────────────────────────────────────
// STDIN:  {"cmd":"ping"}
// STDOUT: {"pong":true}  + blank line
//
// STDERR: any error messages (the Python bridge logs these)
// ─────────────────────────────────────────────────────────────────────────────

#include "MatchingEngine.h"

#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <cstdlib>
#include <cctype>

// ── Minimal JSON helpers ──────────────────────────────────────────────────────
// We use a hand-rolled parser to keep the binary dependency-free.
// The input schema is fixed and small, so this is safe and fast.

static std::string trim(const std::string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    size_t b = s.find_last_not_of(" \t\r\n");
    return (a == std::string::npos) ? "" : s.substr(a, b - a + 1);
}

// Extract the string value for a given key from a flat JSON object.
// Handles both quoted strings and bare numbers/booleans.
static std::string jsonGet(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) return "";
    pos += needle.size();
    // skip whitespace and colon
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == ':')) ++pos;
    if (pos >= json.size()) return "";

    if (json[pos] == '"') {
        // quoted string
        ++pos;
        size_t end = json.find('"', pos);
        return (end == std::string::npos) ? "" : json.substr(pos, end - pos);
    } else {
        // number / bare value — read until comma, } or whitespace
        size_t end = pos;
        while (end < json.size() && json[end] != ',' && json[end] != '}' && !std::isspace((unsigned char)json[end]))
            ++end;
        return trim(json.substr(pos, end - pos));
    }
}

// ── JSON output helpers ───────────────────────────────────────────────────────

static std::string tradeToJson(const TradeResult& t) {
    // Use fixed-precision for price and fee
    char buf[256];
    std::snprintf(buf, sizeof(buf),
        "{\"buy_order_id\":%lld,\"sell_order_id\":%lld,"
        "\"quantity\":%lld,\"exec_price\":%.2f,\"fee\":%.2f}",
        (long long)t.buy_order_id,
        (long long)t.sell_order_id,
        (long long)t.quantity,
        t.exec_price,
        t.fee);
    return std::string(buf);
}

// ── Parse an Order from a JSON string ────────────────────────────────────────

static Order parseOrder(const std::string& json) {
    Order o;
    o.order_id    = std::stoll(jsonGet(json, "order_id"));
    o.user_id     = std::stoll(jsonGet(json, "user_id"));
    o.symbol      = jsonGet(json, "symbol");

    std::string side = jsonGet(json, "side");
    if (side == "Buy")       o.side = Side::Buy;
    else if (side == "Sell") o.side = Side::Sell;
    else throw std::runtime_error("Unknown side: " + side);

    std::string type = jsonGet(json, "type");
    if (type == "Limit")        o.type = OrderType::Limit;
    else if (type == "Market")  o.type = OrderType::Market;
    else throw std::runtime_error("Unknown type: " + type);

    std::string lp = jsonGet(json, "limit_price");
    o.limit_price = lp.empty() ? 0.0 : std::stod(lp);

    o.quantity = std::stoll(jsonGet(json, "quantity"));
    return o;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

int main() {
    // Disable buffering so Python reads output immediately
    std::cout.setf(std::ios::unitbuf);
    std::cerr.setf(std::ios::unitbuf);

    MatchingEngine engine;
    std::string line;

    while (std::getline(std::cin, line)) {
        line = trim(line);
        if (line.empty()) continue;

        try {
            std::string cmd = jsonGet(line, "cmd");

            // ── Ping ──────────────────────────────────────────────────────────
            if (cmd == "ping") {
                std::cout << "{\"pong\":true}\n\n";
                std::cout.flush();
                continue;
            }

            // ── Load (replay resting order, no matching) ──────────────────────
            if (cmd == "load") {
                Order order = parseOrder(line);
                engine.restOrder(order);
                std::cout << "{\"loaded\":true}\n\n";
                std::cout.flush();
                continue;
            }

            // ── Submit (default — also accepts missing cmd for compatibility) ──
            Order order = parseOrder(line);
            std::vector<TradeResult> fills = engine.submitOrder(order);

            for (const auto& fill : fills) {
                std::cout << tradeToJson(fill) << "\n";
            }
            std::cout << "\n";
            std::cout.flush();

        } catch (const std::exception& ex) {
            std::cerr << "[engine error] " << ex.what() << "\n";
            std::cout << "\n";   // unblock the Python reader
            std::cout.flush();
        }
    }

    return 0;
}