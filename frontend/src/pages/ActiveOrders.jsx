import { useEffect, useState } from "react";
import { api } from "../api";

export default function ActiveOrders({ token }) {
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await api(token).get("/orders/active");
      setOrders(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 5000);
    return () => clearInterval(t);
  }, [token]);

  const cancel = async (orderId) => {
    setCancelling(orderId);
    try {
      await api(token).delete(`/orders/${orderId}`);
      await fetchOrders();
    } catch (e) { console.error(e); }
    finally { setCancelling(null); }
  };

  const buyCount  = orders.filter(o => o.Side === "Buy").length;
  const sellCount = orders.filter(o => o.Side === "Sell").length;
  const totalQty  = orders.reduce((a, o) => a + o.Rem_Qty, 0);

  return (
    <div style={s.page}>
      <div style={s.summaryRow}>
        {[
          { label: "OPEN ORDERS",   val: orders.length, color: "var(--amber)" },
          { label: "BUY ORDERS",    val: buyCount,       color: "var(--green)" },
          { label: "SELL ORDERS",   val: sellCount,      color: "var(--red)"   },
          { label: "TOTAL REM QTY", val: totalQty.toLocaleString(), color: "var(--text-2)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.summCard}>
            <div style={s.summLabel}>{label}</div>
            <div style={{ ...s.summVal, color }}>{val}</div>
          </div>
        ))}
        <button style={s.refreshBtn} onClick={fetchOrders}>
          ↻ REFRESH
        </button>
      </div>

      <div style={s.tableWrap}>
        <div style={s.tableHead}>
          <span style={s.tableTitle}>ACTIVE ORDERS</span>
          <div style={s.tableRight}>
            <span style={s.autoRefreshTag}>AUTO-REFRESH 5s</span>
            <span style={s.liveDot} />
          </div>
        </div>

        {loading ? (
          <div style={s.stateBox}>
            <span style={s.spinner} />
            <span style={s.stateText}>LOADING ORDERS...</span>
          </div>
        ) : orders.length === 0 ? (
          <div style={s.stateBox}>
            <div style={s.emptyIcon}>≋</div>
            <div style={s.stateText}>NO ACTIVE ORDERS</div>
            <div style={s.stateSub}>All orders have been filled or cancelled</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {[
                    "ORDER ID", "SYMBOL", "SIDE", "TYPE",
                    "LIMIT PRICE", "TOTAL", "REMAINING", "FILL %",
                    "STATUS", "TIME", "ACTION",
                  ].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const isBuy     = o.Side === "Buy";
                  const filled    = o.Total_Qty - o.Rem_Qty;
                  const fillPct   = ((filled / o.Total_Qty) * 100).toFixed(0);
                  const isCancelling = cancelling === o.Order_ID;

                  return (
                    <tr key={o.Order_ID} style={s.tr}>
                      <td style={s.tdId}>#{o.Order_ID}</td>
                      <td style={s.tdSym}>{o.Symbol}</td>
                      <td style={s.td}>
                        <span style={isBuy ? s.buyBadge : s.sellBadge}>
                          {isBuy ? "▲ BUY" : "▼ SELL"}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={s.typeBadge}>{o.Type.toUpperCase()}</span>
                      </td>
                      <td style={s.tdPrice}>
                        {o.Limit_Price ? `₹ ${parseFloat(o.Limit_Price).toFixed(2)}` : "MKT"}
                      </td>
                      <td style={s.td}>{o.Total_Qty.toLocaleString()}</td>
                      <td style={s.td}>{o.Rem_Qty.toLocaleString()}</td>
                      <td style={s.td}>
                        <div style={s.fillWrap}>
                          <div style={s.fillTrack}>
                            <div style={{
                              ...s.fillBar,
                              width: `${fillPct}%`,
                              background: isBuy ? "var(--green)" : "var(--red)",
                            }} />
                          </div>
                          <span style={s.fillPct}>{fillPct}%</span>
                        </div>
                      </td>
                      <td style={s.td}>
                        <span style={o.Status === "PARTIAL" ? s.statusPartial : s.statusOpen}>
                          {o.Status}
                        </span>
                      </td>
                      <td style={s.tdTime}>
                        {new Date(o.Timestamp).toLocaleTimeString()}
                      </td>
                      <td style={s.td}>
                        <button
                          style={isCancelling ? s.cancelOff : s.cancelBtn}
                          onClick={() => cancel(o.Order_ID)}
                          disabled={isCancelling}
                        >
                          {isCancelling ? "..." : "CANCEL"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "12px" },

  summaryRow: { display: "flex", gap: "8px", alignItems: "stretch", flexShrink: 0 },
  summCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    flex: 1,
  },
  summLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px", marginBottom: "5px" },
  summVal: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "1px",
  },
  refreshBtn: {
    background: "var(--amber-dim)",
    border: "1px solid var(--border-amber)",
    color: "var(--amber)",
    padding: "10px 16px",
    fontSize: "9px",
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    fontWeight: 600,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  tableWrap: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    flex: 1,
  },
  tableHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
  },
  tableTitle: { fontSize: "9px", color: "var(--amber)", letterSpacing: "4px", fontWeight: 700 },
  tableRight: { display: "flex", alignItems: "center", gap: "8px" },
  autoRefreshTag: { fontSize: "7px", color: "var(--text-5)", letterSpacing: "2px" },
  liveDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    background: "var(--green)", display: "inline-block",
    animation: "pulse-dot 2s ease-in-out infinite",
  },

  stateBox: {
    padding: "60px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    color: "var(--text-5)",
  },
  spinner: {
    width: "14px", height: "14px",
    border: "2px solid rgba(255,255,255,0.1)",
    borderTopColor: "var(--amber)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },
  stateText: { fontSize: "10px", color: "var(--text-5)", letterSpacing: "3px" },
  stateSub: { fontSize: "9px", color: "var(--text-5)", letterSpacing: "1.5px" },
  emptyIcon: { fontSize: "24px", opacity: 0.15, marginBottom: "4px" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: "11px" },
  th: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: "7px",
    letterSpacing: "2px",
    color: "var(--text-5)",
    borderBottom: "1px solid var(--border-dim)",
    fontWeight: 500,
    background: "var(--bg-card)",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid var(--border-dim)" },
  tdId: { padding: "9px 12px", color: "var(--text-5)", fontSize: "10px", whiteSpace: "nowrap" },
  tdSym: { padding: "9px 12px", color: "var(--amber)", fontWeight: 700, letterSpacing: "1.5px" },
  td: { padding: "9px 12px", color: "var(--text-2)", whiteSpace: "nowrap" },
  tdPrice: { padding: "9px 12px", color: "var(--text-0)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  tdTime: { padding: "9px 12px", color: "var(--text-5)", fontSize: "10px", whiteSpace: "nowrap" },

  buyBadge: { color: "var(--green)", fontSize: "8px", fontWeight: 700, letterSpacing: "1px" },
  sellBadge: { color: "var(--red)", fontSize: "8px", fontWeight: 700, letterSpacing: "1px" },
  typeBadge: { fontSize: "8px", color: "var(--text-3)", letterSpacing: "1px" },
  statusOpen: { color: "var(--amber)", fontSize: "8px", letterSpacing: "2px", fontWeight: 600 },
  statusPartial: { color: "var(--blue)", fontSize: "8px", letterSpacing: "2px", fontWeight: 600 },

  fillWrap: { display: "flex", alignItems: "center", gap: "6px" },
  fillTrack: {
    width: "48px", height: "3px",
    background: "var(--bg-2)",
    borderRadius: "2px",
    overflow: "hidden",
    flexShrink: 0,
  },
  fillBar: { height: "100%", borderRadius: "2px", transition: "width 0.4s" },
  fillPct: { fontSize: "9px", color: "var(--text-4)", minWidth: "28px" },

  cancelBtn: {
    background: "none",
    border: "1px solid rgba(244,63,94,0.25)",
    color: "var(--red)",
    padding: "3px 9px",
    fontSize: "8px",
    letterSpacing: "1.5px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    transition: "background 0.15s",
  },
  cancelOff: {
    background: "none",
    border: "1px solid var(--border-dim)",
    color: "var(--text-5)",
    padding: "3px 9px",
    fontSize: "8px",
    letterSpacing: "1.5px",
    cursor: "not-allowed",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
  },
};