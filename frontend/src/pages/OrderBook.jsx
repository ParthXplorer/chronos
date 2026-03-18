import { useEffect, useRef, useState } from "react";

export default function OrderBook({ symbol, onSymbolChange }) {
  const [book, setBook]     = useState({ bids: [], asks: [] });
  const [status, setStatus] = useState("CONNECTING");
  const [input, setInput]   = useState(symbol);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = useRef(null);

  const connect = (sym) => {
    if (wsRef.current) wsRef.current.close();
    setStatus("CONNECTING"); setBook({ bids: [], asks: [] });
    const ws = new WebSocket(`ws://localhost:8000/stocks/ws/orderbook/${sym}`);
    wsRef.current = ws;
    ws.onopen    = () => setStatus("LIVE");
    ws.onmessage = (e) => { setBook(JSON.parse(e.data)); setLastUpdate(new Date()); };
    ws.onerror   = () => setStatus("ERROR");
    ws.onclose   = () => setStatus("DISCONNECTED");
  };

  useEffect(() => { connect(symbol); setInput(symbol); return () => wsRef.current?.close(); }, [symbol]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const sym = input.trim().toUpperCase();
    if (sym) { onSymbolChange(sym); connect(sym); }
  };

  const maxQty = Math.max(...book.bids.map(b => b.quantity), ...book.asks.map(a => a.quantity), 1);
  const spread = book.bids[0] && book.asks[0]
    ? (parseFloat(book.asks[0].price) - parseFloat(book.bids[0].price)).toFixed(2)
    : null;
  const midPrice = book.bids[0] && book.asks[0]
    ? ((parseFloat(book.asks[0].price) + parseFloat(book.bids[0].price)) / 2).toFixed(2)
    : null;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <form onSubmit={handleSubmit} style={s.symbolForm}>
          <input style={s.symbolInput} value={input} onChange={e => setInput(e.target.value.toUpperCase())} placeholder="SYMBOL" />
          <button type="submit" style={s.loadBtn}>LOAD ↵</button>
        </form>
        <div style={s.statusRow}>
          <span style={status === "LIVE" ? s.statusLive : s.statusOff}>
            {status === "LIVE" ? "● " : "○ "}{status}
          </span>
          {lastUpdate && <span style={s.lastUpdate}>UPDATED {lastUpdate.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Mid price + spread */}
      {midPrice && (
        <div style={s.midBar}>
          <div style={s.midItem}>
            <span style={s.midLabel}>MID PRICE</span>
            <span style={s.midVal}>₹ {midPrice}</span>
          </div>
          <div style={s.midDivider} />
          <div style={s.midItem}>
            <span style={s.midLabel}>SPREAD</span>
            <span style={s.midVal}>₹ {spread}</span>
          </div>
          <div style={s.midDivider} />
          <div style={s.midItem}>
            <span style={s.midLabel}>BID DEPTH</span>
            <span style={{ ...s.midVal, color: "#10b981" }}>{book.bids.reduce((a, b) => a + b.quantity, 0)}</span>
          </div>
          <div style={s.midDivider} />
          <div style={s.midItem}>
            <span style={s.midLabel}>ASK DEPTH</span>
            <span style={{ ...s.midVal, color: "#ef4444" }}>{book.asks.reduce((a, b) => a + b.quantity, 0)}</span>
          </div>
        </div>
      )}

      {/* Order book grid */}
      <div style={s.bookGrid}>
        {/* Bids */}
        <div style={s.bookSide}>
          <div style={s.bookSideHeader}>
            <span style={s.bidTitle}>BIDS — BUY ORDERS</span>
            <div style={s.colHeaders}>
              <span>ORDER ID</span><span>QTY</span><span>PRICE</span>
            </div>
          </div>
          {book.bids.length === 0
            ? <div style={s.empty}>NO BID ORDERS</div>
            : book.bids.map((b) => (
              <div key={b.order_id} style={s.bookRow}>
                <div style={{ ...s.depthFill, width: `${(b.quantity / maxQty) * 100}%`, background: "rgba(16,185,129,0.08)", left: 0 }} />
                <span style={s.orderId}>#{b.order_id}</span>
                <span style={s.qty}>{b.quantity.toLocaleString()}</span>
                <span style={s.bidPrice}>₹ {parseFloat(b.price).toFixed(2)}</span>
              </div>
            ))}
        </div>

        {/* Asks */}
        <div style={s.bookSide}>
          <div style={s.bookSideHeader}>
            <span style={s.askTitle}>ASKS — SELL ORDERS</span>
            <div style={s.colHeaders}>
              <span>PRICE</span><span>QTY</span><span>ORDER ID</span>
            </div>
          </div>
          {book.asks.length === 0
            ? <div style={s.empty}>NO ASK ORDERS</div>
            : book.asks.map((a) => (
              <div key={a.order_id} style={s.bookRow}>
                <div style={{ ...s.depthFill, width: `${(a.quantity / maxQty) * 100}%`, background: "rgba(239,68,68,0.08)", right: 0, left: "auto" }} />
                <span style={s.askPrice}>₹ {parseFloat(a.price).toFixed(2)}</span>
                <span style={s.qty}>{a.quantity.toLocaleString()}</span>
                <span style={s.orderId}>#{a.order_id}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "12px", height: "100%" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  symbolForm: { display: "flex", gap: "8px", alignItems: "center" },
  symbolInput: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "2px", color: "#f0b429", padding: "8px 12px", fontSize: "14px", fontFamily: "var(--font-mono)", width: "120px", letterSpacing: "3px", fontWeight: 600 },
  loadBtn: { background: "#f0b429", color: "#07090f", border: "none", padding: "8px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px" },
  statusRow: { display: "flex", gap: "14px", alignItems: "center" },
  statusLive: { fontSize: "10px", color: "#10b981", letterSpacing: "2px", fontWeight: 700 },
  statusOff: { fontSize: "10px", color: "#ef4444", letterSpacing: "2px" },
  lastUpdate: { fontSize: "9px", color: "#334155", letterSpacing: "1px" },
  midBar: { display: "flex", alignItems: "center", background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "12px 20px", gap: "24px" },
  midItem: { display: "flex", flex: 1, flexDirection: "column", gap: "4px", alignItems: "center" },
  midLabel: { fontSize: "8px", color: "#475569", letterSpacing: "3px" },
  midVal: { fontSize: "16px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" },
  midDivider: { width: "1px", height: "32px", background: "rgba(255,255,255,0.06)" },
  bookGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flex: 1 },
  bookSide: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" },
  bookSideHeader: { padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" },
  bidTitle: { fontSize: "9px", color: "#10b981", letterSpacing: "3px", fontWeight: 700, display: "block", marginBottom: "6px" },
  askTitle: { fontSize: "9px", color: "#ef4444", letterSpacing: "3px", fontWeight: 700, display: "block", marginBottom: "6px" },
  colHeaders: { display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#334155", letterSpacing: "2px" },
  bookRow: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)", position: "relative", alignItems: "center", transition: "background 0.15s" },
  depthFill: { position: "absolute", top: 0, bottom: 0, transition: "width 0.4s ease" },
  orderId: { fontSize: "10px", color: "#334155", zIndex: 1 },
  qty: { fontSize: "12px", color: "#94a3b8", zIndex: 1, fontVariantNumeric: "tabular-nums" },
  bidPrice: { fontSize: "13px", color: "#10b981", fontWeight: 600, zIndex: 1, fontVariantNumeric: "tabular-nums" },
  askPrice: { fontSize: "13px", color: "#ef4444", fontWeight: 600, zIndex: 1, fontVariantNumeric: "tabular-nums" },
  empty: { padding: "32px", color: "#334155", fontSize: "10px", letterSpacing: "3px", textAlign: "center" },
};