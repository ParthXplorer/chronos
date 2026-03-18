import { useState } from "react";
import { api } from "../api";

export default function PlaceOrder({ token, defaultSymbol }) {
  const [form, setForm]   = useState({ symbol: defaultSymbol || "", side: "Buy", type: "Limit", limit_price: "", quantity: "" });
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm({...form, [k]: e.target.value});

  const submit = async (e) => {
    e.preventDefault(); setError(""); setResult(null); setLoading(true);
    try {
      const payload = {
        symbol: form.symbol.toUpperCase(), side: form.side, type: form.type,
        quantity: parseInt(form.quantity),
        limit_price: form.type === "Limit" ? parseFloat(form.limit_price) : null,
      };
      const res = await api(token).post("/orders/", payload);
      setResult(res.data.order || res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Order rejected");
    } finally { setLoading(false); }
  };

  const notional = form.limit_price && form.quantity
    ? (parseFloat(form.limit_price) * parseInt(form.quantity)).toFixed(2)
    : null;
  const isBuy = form.side === "Buy";

  return (
    <div style={s.page}>
      {/* Order ticket */}
      <div style={s.ticket}>
        <div style={s.ticketHeader}>
          <span style={s.ticketTitle}>ORDER TICKET</span>
          <span style={s.ticketSub}>CHRONOS EXCHANGE</span>
        </div>

        {/* Side toggle */}
        <div style={s.sideToggle}>
          <button type="button"
            style={isBuy ? s.toggleBuyActive : s.toggleInactive}
            onClick={() => setForm({...form, side: "Buy"})}>
            ▲ BUY
          </button>
          <button type="button"
            style={!isBuy ? s.toggleSellActive : s.toggleInactive}
            onClick={() => setForm({...form, side: "Sell"})}>
            ▼ SELL
          </button>
        </div>

        <form onSubmit={submit} style={s.form}>
          {/* Symbol */}
          <div style={s.formRow}>
            <div style={s.field}>
              <label style={s.label}>INSTRUMENT</label>
              <input style={{ ...s.input, color: "#f0b429", fontWeight: 700, letterSpacing: "3px", fontSize: "15px" }}
                value={form.symbol} onChange={f("symbol")} placeholder="AAPL" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>ORDER TYPE</label>
              <select style={s.input} value={form.type} onChange={f("type")}>
                <option value="Limit">LIMIT</option>
                <option value="Market">MARKET</option>
              </select>
            </div>
          </div>

          {/* Price + Qty */}
          <div style={s.formRow}>
            {form.type === "Limit" && (
              <div style={s.field}>
                <label style={s.label}>LIMIT PRICE (₹)</label>
                <input style={s.input} type="number" step="0.01" value={form.limit_price}
                  onChange={f("limit_price")} placeholder="0.00" required />
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>QUANTITY</label>
              <input style={s.input} type="number" min="1" value={form.quantity}
                onChange={f("quantity")} placeholder="0" required />
            </div>
          </div>

          {/* Notional value */}
          {notional && (
            <div style={s.notional}>
              <div style={s.notionalRow}>
                <span style={s.notionalLabel}>ESTIMATED VALUE</span>
                <span style={s.notionalVal}>₹ {parseFloat(notional).toLocaleString("en-IN", {minimumFractionDigits: 2})}</span>
              </div>
              <div style={s.notionalRow}>
                <span style={s.notionalLabel}>EST. FEE (0.01%)</span>
                <span style={s.notionalFee}>₹ {(parseFloat(notional) * 0.0001).toFixed(4)}</span>
              </div>
              <div style={s.notionalBar}>
                <div style={{ ...s.notionalFill, background: isBuy ? "#10b981" : "#ef4444", width: "100%" }} />
              </div>
            </div>
          )}

          {error && <div style={s.error}>✗ {error}</div>}

          <button type="submit"
            style={loading ? s.btnLoading : isBuy ? s.btnBuy : s.btnSell}
            disabled={loading}>
            {loading ? "PLACING ORDER..." : `PLACE ${form.side.toUpperCase()} ORDER`}
          </button>
        </form>
      </div>

      {/* Success confirmation */}
      {result && (
        <div style={s.confirm}>
          <div style={s.confirmHeader}>
            <span style={s.confirmIcon}>✓</span>
            <span style={s.confirmTitle}>ORDER CONFIRMED</span>
          </div>
          <div style={s.confirmGrid}>
            {[
              ["ORDER ID",  `#${result.order_id || result.Order_ID}`],
              ["SYMBOL",    result.symbol || result.Symbol],
              ["SIDE",      result.side   || result.Side],
              ["TYPE",      result.type   || result.Type],
              ["PRICE",     `₹ ${result.limit_price || result.Limit_Price || "MARKET"}`],
              ["QTY",       result.total_qty || result.Total_Qty],
              ["STATUS",    result.status || result.Status],
            ].map(([k, v]) => (
              <div key={k} style={s.confirmRow}>
                <span style={s.confirmKey}>{k}</span>
                <span style={s.confirmVal}>{v}</span>
              </div>
            ))}
          </div>
          <button style={s.newOrderBtn} onClick={() => setResult(null)}>NEW ORDER</button>
        </div>
      )}

      {/* Quick reference */}
      <div style={s.reference}>
        <div style={s.refTitle}>QUICK GUIDE</div>
        {[
          ["LIMIT ORDER",  "Execute at specified price or better"],
          ["MARKET ORDER", "Execute immediately at best available price"],
          ["BUY",          "Reserves funds from wallet balance"],
          ["SELL",         "Requires existing holdings in portfolio"],
        ].map(([k, v]) => (
          <div key={k} style={s.refRow}>
            <span style={s.refKey}>{k}</span>
            <span style={s.refVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  page: { display: "grid", gridTemplateColumns: "360px 1fr 1fr", gap: "14px", alignItems: "start" },
  ticket: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" },
  ticketHeader: { padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  ticketTitle: { fontSize: "10px", color: "#f0b429", letterSpacing: "4px", fontWeight: 700 },
  ticketSub: { fontSize: "8px", color: "#334155", letterSpacing: "2px" },
  sideToggle: { display: "flex", margin: "14px 16px 0" },
  toggleBuyActive: { flex: 1, background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", color: "#10b981", padding: "10px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px 0 0 2px" },
  toggleSellActive: { flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", color: "#ef4444", padding: "10px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "0 2px 2px 0" },
  toggleInactive: { flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.06)", color: "#334155", padding: "10px", fontSize: "11px", letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)" },
  form: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "8px", color: "#475569", letterSpacing: "3px" },
  input: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", color: "#e2e8f0", padding: "9px 12px", fontSize: "12px", fontFamily: "var(--font-mono)", width: "100%" },
  notional: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "2px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" },
  notionalRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  notionalLabel: { fontSize: "8px", color: "#475569", letterSpacing: "2px" },
  notionalVal: { fontSize: "14px", color: "#e2e8f0", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  notionalFee: { fontSize: "11px", color: "#475569", fontVariantNumeric: "tabular-nums" },
  notionalBar: { height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px", overflow: "hidden", marginTop: "2px" },
  notionalFill: { height: "100%", borderRadius: "1px" },
  error: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "2px", padding: "8px 12px", color: "#ef4444", fontSize: "11px" },
  btnBuy: { background: "#10b981", color: "#07090f", border: "none", borderRadius: "2px", padding: "12px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)" },
  btnSell: { background: "#ef4444", color: "#fff", border: "none", borderRadius: "2px", padding: "12px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)" },
  btnLoading: { background: "#111827", color: "#334155", border: "none", borderRadius: "2px", padding: "12px", fontSize: "11px", letterSpacing: "3px", cursor: "not-allowed", fontFamily: "var(--font-mono)" },
  confirm: { background: "#0c1018", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "3px", overflow: "hidden" },
  confirmHeader: { padding: "12px 16px", borderBottom: "1px solid rgba(16,185,129,0.1)", background: "rgba(16,185,129,0.05)", display: "flex", gap: "8px", alignItems: "center" },
  confirmIcon: { color: "#10b981", fontSize: "14px" },
  confirmTitle: { fontSize: "10px", color: "#10b981", letterSpacing: "4px", fontWeight: 700 },
  confirmGrid: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  confirmRow: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.03)" },
  confirmKey: { fontSize: "9px", color: "#475569", letterSpacing: "2px" },
  confirmVal: { fontSize: "12px", color: "#e2e8f0", fontWeight: 600 },
  newOrderBtn: { margin: "0 16px 16px", width: "calc(100% - 32px)", background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#475569", padding: "8px", fontSize: "9px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px" },
  reference: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "14px 16px" },
  refTitle: { fontSize: "9px", color: "#334155", letterSpacing: "4px", marginBottom: "12px" },
  refRow: { display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px" },
  refKey: { fontSize: "9px", color: "#f0b429", letterSpacing: "2px", fontWeight: 600 },
  refVal: { fontSize: "10px", color: "#475569", lineHeight: 1.5 },
};