import { useEffect, useState } from "react";
import { api } from "../api";

export default function ActiveOrders({ token }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const fetch = async () => {
    try {
      const res = await api(token).get("/orders/active");
      setOrders(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); const t = setInterval(fetch, 5000); return () => clearInterval(t); }, [token]);

  const cancel = async (orderId) => {
    setCancelling(orderId);
    try {
      await api(token).delete(`/orders/${orderId}`);
      await fetch();
    } catch (e) { console.error(e); }
    finally { setCancelling(null); }
  };

  const totalBuy  = orders.filter(o => o.Side === "Buy").length;
  const totalSell = orders.filter(o => o.Side === "Sell").length;
  const totalQty  = orders.reduce((a, o) => a + o.Rem_Qty, 0);

  return (
    <div style={s.page}>
      {/* Summary */}
      <div style={s.summary}>
        {[
          { label: "OPEN ORDERS",  val: orders.length, color: "#f0b429" },
          { label: "BUY ORDERS",   val: totalBuy,       color: "#10b981" },
          { label: "SELL ORDERS",  val: totalSell,      color: "#ef4444" },
          { label: "TOTAL REM QTY",val: totalQty.toLocaleString(), color: "#94a3b8" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.summCard}>
            <div style={s.summLabel}>{label}</div>
            <div style={{ ...s.summVal, color }}>{val}</div>
          </div>
        ))}
        <button style={s.refreshBtn} onClick={fetch}>↻ REFRESH</button>
      </div>

      {/* Orders table */}
      <div style={s.tableWrap}>
        <div style={s.tableHeader}>
          <span style={s.tableTitle}>ACTIVE ORDERS</span>
          <span style={s.autoRefresh}>AUTO-REFRESH 5s</span>
        </div>
        {loading
          ? <div style={s.loading}>LOADING ORDERS...</div>
          : !orders.length
            ? <div style={s.empty}>NO ACTIVE ORDERS</div>
            : (
              <table style={s.table}>
                <thead>
                  <tr>
                    {["ORDER ID", "SYMBOL", "SIDE", "TYPE", "LIMIT PRICE", "TOTAL", "REMAINING", "FILLED%", "STATUS", "TIME", "ACTION"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const isBuy   = o.Side === "Buy";
                    const filled  = o.Total_Qty - o.Rem_Qty;
                    const filledPct = ((filled / o.Total_Qty) * 100).toFixed(0);
                    return (
                      <tr key={o.Order_ID} style={s.tr}>
                        <td style={s.tdId}>#{o.Order_ID}</td>
                        <td style={s.tdSym}>{o.Symbol}</td>
                        <td style={s.td}>
                          <span style={isBuy ? s.buyBadge : s.sellBadge}>
                            {isBuy ? "▲ BUY" : "▼ SELL"}
                          </span>
                        </td>
                        <td style={s.td}>{o.Type.toUpperCase()}</td>
                        <td style={s.tdPrice}>{o.Limit_Price ? `₹ ${parseFloat(o.Limit_Price).toFixed(2)}` : "MKT"}</td>
                        <td style={s.td}>{o.Total_Qty.toLocaleString()}</td>
                        <td style={s.td}>{o.Rem_Qty.toLocaleString()}</td>
                        <td style={s.td}>
                          <div style={s.fillBar}>
                            <div style={{ ...s.fillFill, width: `${filledPct}%`, background: isBuy ? "#10b981" : "#ef4444" }} />
                          </div>
                          <span style={s.fillPct}>{filledPct}%</span>
                        </td>
                        <td style={s.td}>
                          <span style={o.Status === "PARTIAL" ? s.statusPartial : s.statusOpen}>
                            {o.Status}
                          </span>
                        </td>
                        <td style={s.tdTime}>{new Date(o.Timestamp).toLocaleTimeString()}</td>
                        <td style={s.td}>
                          <button
                            style={cancelling === o.Order_ID ? s.cancelBtnLoading : s.cancelBtn}
                            onClick={() => cancel(o.Order_ID)}
                            disabled={cancelling === o.Order_ID}
                          >
                            {cancelling === o.Order_ID ? "..." : "CANCEL"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "14px" },
  summary: { display: "flex", gap: "8px", alignItems: "center" },
  summCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "10px 16px", flex: 1 },
  summLabel: { fontSize: "8px", color: "#475569", letterSpacing: "3px", marginBottom: "4px" },
  summVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700 },
  refreshBtn: { background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)", color: "#f0b429", padding: "10px 16px", fontSize: "9px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px", height: "100%", whiteSpace: "nowrap" },
  tableWrap: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" },
  tableHeader: { display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", alignItems: "center" },
  tableTitle: { fontSize: "9px", color: "#f0b429", letterSpacing: "4px", fontWeight: 700 },
  autoRefresh: { fontSize: "8px", color: "#1e293b", letterSpacing: "2px" },
  loading: { padding: "40px", color: "#334155", fontSize: "11px", letterSpacing: "3px", textAlign: "center" },
  empty: { padding: "40px", color: "#334155", fontSize: "10px", letterSpacing: "3px", textAlign: "center" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "11px" },
  th: { textAlign: "left", padding: "9px 12px", fontSize: "8px", letterSpacing: "2px", color: "#334155", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 500, background: "#0c1018", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.03)" },
  tdId: { padding: "10px 12px", color: "#334155", fontSize: "10px" },
  tdSym: { padding: "10px 12px", color: "#f0b429", fontWeight: 700, letterSpacing: "2px", fontSize: "12px" },
  td: { padding: "10px 12px", color: "#94a3b8" },
  tdPrice: { padding: "10px 12px", color: "#e2e8f0", fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  tdTime: { padding: "10px 12px", color: "#334155", fontSize: "10px" },
  buyBadge: { color: "#10b981", fontSize: "9px", fontWeight: 700, letterSpacing: "1px" },
  sellBadge: { color: "#ef4444", fontSize: "9px", fontWeight: 700, letterSpacing: "1px" },
  statusOpen: { color: "#f0b429", fontSize: "9px", letterSpacing: "2px", fontWeight: 600 },
  statusPartial: { color: "#3b82f6", fontSize: "9px", letterSpacing: "2px", fontWeight: 600 },
  fillBar: { display: "inline-block", width: "40px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", verticalAlign: "middle", marginRight: "5px" },
  fillFill: { height: "100%", borderRadius: "2px", transition: "width 0.3s" },
  fillPct: { fontSize: "9px", color: "#475569" },
  cancelBtn: { background: "none", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "3px 8px", fontSize: "8px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px" },
  cancelBtnLoading: { background: "none", border: "1px solid rgba(255,255,255,0.06)", color: "#334155", padding: "3px 8px", fontSize: "8px", letterSpacing: "2px", cursor: "not-allowed", fontFamily: "var(--font-mono)", borderRadius: "2px" },
};