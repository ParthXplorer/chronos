import { useEffect, useRef, useState } from "react";

export default function OrderBook({ symbol, onSymbolChange }) {
  const [book,       setBook]       = useState({ bids: [], asks: [] });
  const [status,     setStatus]     = useState("CONNECTING");
  const [input,      setInput]      = useState(symbol);
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

  useEffect(() => {
    connect(symbol);
    setInput(symbol);
    return () => wsRef.current?.close();
  }, [symbol]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const sym = input.trim().toUpperCase();
    if (sym) { onSymbolChange(sym); connect(sym); }
  };

  const maxQty  = Math.max(...book.bids.map(b => b.quantity), ...book.asks.map(a => a.quantity), 1);
  const spread  = book.bids[0] && book.asks[0]
    ? (parseFloat(book.asks[0].price) - parseFloat(book.bids[0].price)).toFixed(2)
    : null;
  const midPrice = book.bids[0] && book.asks[0]
    ? ((parseFloat(book.asks[0].price) + parseFloat(book.bids[0].price)) / 2).toFixed(2)
    : null;
  const bidDepth = book.bids.reduce((a, b) => a + b.quantity, 0);
  const askDepth = book.asks.reduce((a, b) => a + b.quantity, 0);
  const depthRatio = bidDepth + askDepth > 0 ? bidDepth / (bidDepth + askDepth) : 0.5;

  const StatusDot = () => {
    const color = status === "LIVE" ? "var(--green)" : status === "CONNECTING" ? "var(--amber)" : "var(--red)";
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color, fontWeight: 700, letterSpacing: "2px" }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block", animation: status === "LIVE" ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
        {status}
      </span>
    );
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <form onSubmit={handleSubmit} style={s.symbolForm}>
          <span style={s.symbolPrompt}>SYMBOL</span>
          <input
            style={s.symbolInput}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
          />
          <button type="submit" style={s.loadBtn}>LOAD ↵</button>
        </form>
        <div style={s.headerRight}>
          <StatusDot />
          {lastUpdate && (
            <span style={s.lastUpdate}>
              UPDATED {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {midPrice && (
        <div style={s.midBar}>
          {[
            { label: "MID PRICE",  val: `₹ ${midPrice}`, color: "var(--text-0)" },
            { label: "SPREAD",     val: `₹ ${spread}`,   color: "var(--amber)" },
            { label: "BID DEPTH",  val: bidDepth.toLocaleString(), color: "var(--green)" },
            { label: "ASK DEPTH",  val: askDepth.toLocaleString(), color: "var(--red)" },
          ].map(({ label, val, color }, i, arr) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={s.midItem}>
                <div style={s.midLabel}>{label}</div>
                <div style={{ ...s.midVal, color }}>{val}</div>
              </div>
              {i < arr.length - 1 && <div style={s.midDivider} />}
            </div>
          ))}
          <div style={s.depthBar}>
            <div style={s.depthLabel}>BID / ASK RATIO</div>
            <div style={s.depthTrack}>
              <div style={{ ...s.depthFillBid, width: `${depthRatio * 100}%` }} />
              <div style={{ ...s.depthFillAsk, flex: 1 }} />
            </div>
            <div style={s.depthNums}>
              <span style={{ color: "var(--green)" }}>{(depthRatio * 100).toFixed(0)}%</span>
              <span style={{ color: "var(--red)" }}>{((1 - depthRatio) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      <div style={s.bookGrid}>
        <div style={s.bookSide}>
          <div style={s.bookSideHeader}>
            <span style={s.bidTitle}>▲ BIDS — BUY ORDERS</span>
            <div style={s.colHeaders}>
              <span>ORDER ID</span><span>QTY</span><span>PRICE</span>
            </div>
          </div>
          {book.bids.length === 0
            ? <div style={s.empty}>NO BID ORDERS</div>
            : book.bids.map((b) => (
              <div key={b.order_id} style={s.bookRow}>
                <div style={{
                  ...s.depthRowFill,
                  width: `${(b.quantity / maxQty) * 100}%`,
                  background: "rgba(16,185,129,0.07)",
                  left: 0,
                }} />
                <span style={s.orderId}>#{b.order_id}</span>
                <span style={s.qty}>{b.quantity.toLocaleString()}</span>
                <span style={s.bidPrice}>₹ {parseFloat(b.price).toFixed(2)}</span>
              </div>
            ))}
        </div>

        <div style={s.bookSide}>
          <div style={s.bookSideHeader}>
            <span style={s.askTitle}>▼ ASKS — SELL ORDERS</span>
            <div style={s.colHeaders}>
              <span>PRICE</span><span>QTY</span><span>ORDER ID</span>
            </div>
          </div>
          {book.asks.length === 0
            ? <div style={s.empty}>NO ASK ORDERS</div>
            : book.asks.map((a) => (
              <div key={a.order_id} style={s.bookRow}>
                <div style={{
                  ...s.depthRowFill,
                  width: `${(a.quantity / maxQty) * 100}%`,
                  background: "rgba(244,63,94,0.07)",
                  right: 0,
                  left: "auto",
                }} />
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

  header: { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  symbolForm: { display: "flex", gap: "8px", alignItems: "center" },
  symbolPrompt: { fontSize: "8px", color: "var(--text-4)", letterSpacing: "3px" },
  symbolInput: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-sm)",
    color: "var(--amber)",
    padding: "8px 14px",
    fontSize: "15px",
    fontFamily: "var(--font-mono)",
    width: "120px",
    letterSpacing: "3px",
    fontWeight: 700,
    transition: "border-color 0.15s",
  },
  loadBtn: {
    background: "var(--amber)",
    color: "#05080f",
    border: "none",
    padding: "8px 14px",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
  },
  headerRight: { display: "flex", gap: "14px", alignItems: "center" },
  lastUpdate: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "1px" },

  midBar: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "12px 20px",
    flexShrink: 0,
  },
  midItem: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  midLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px" },
  midVal: {
    fontFamily: "var(--font-display)",
    fontSize: "17px",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },
  midDivider: { width: "1px", height: "36px", background: "var(--border-dim)", marginRight: "20px" },

  depthBar: { marginLeft: "auto", width: "150px" },
  depthLabel: { fontSize: "7px", color: "var(--text-5)", letterSpacing: "2px", marginBottom: "5px" },
  depthTrack: {
    height: "4px",
    background: "var(--bg-2)",
    borderRadius: "2px",
    overflow: "hidden",
    display: "flex",
  },
  depthFillBid: { height: "100%", background: "var(--green)", transition: "width 0.4s" },
  depthFillAsk: { height: "100%", background: "var(--red)" },
  depthNums: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "8px",
    marginTop: "3px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },

  bookGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flex: 1 },
  bookSide: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  bookSideHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
    flexShrink: 0,
  },
  bidTitle: { fontSize: "8px", color: "var(--green)", letterSpacing: "2.5px", fontWeight: 700, display: "block", marginBottom: "6px" },
  askTitle: { fontSize: "8px", color: "var(--red)",   letterSpacing: "2.5px", fontWeight: 700, display: "block", marginBottom: "6px" },
  colHeaders: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "7px",
    color: "var(--text-5)",
    letterSpacing: "2px",
  },

  bookRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "9px 14px",
    borderBottom: "1px solid var(--border-dim)",
    position: "relative",
    alignItems: "center",
    transition: "background 0.15s",
  },
  depthRowFill: { position: "absolute", top: 0, bottom: 0, transition: "width 0.4s ease" },
  orderId: { fontSize: "9px", color: "var(--text-5)", zIndex: 1, fontVariantNumeric: "tabular-nums" },
  qty:     { fontSize: "11px", color: "var(--text-2)", zIndex: 1, fontVariantNumeric: "tabular-nums" },
  bidPrice: { fontSize: "12px", color: "var(--green)", fontWeight: 600, zIndex: 1, fontVariantNumeric: "tabular-nums" },
  askPrice: { fontSize: "12px", color: "var(--red)",   fontWeight: 600, zIndex: 1, fontVariantNumeric: "tabular-nums" },
  empty: { padding: "40px", color: "var(--text-5)", fontSize: "9px", letterSpacing: "3px", textAlign: "center" },
};