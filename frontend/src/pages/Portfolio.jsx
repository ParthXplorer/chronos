import { useEffect, useState } from "react";
import { api } from "../api";

export default function Portfolio({ token }) {
  const [pnl, setPnl]         = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const [p, s] = await Promise.all([
        api(token).get("/portfolio/pnl"),
        api(token).get("/portfolio/summary"),
      ]);
      setPnl(p.data); setSummary(s.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); const t = setInterval(fetch, 10000); return () => clearInterval(t); }, [token]);

  if (loading) return <div style={s.loading}>LOADING PORTFOLIO...</div>;

  const totalPnl = pnl?.total_unrealized_pnl ?? 0;
  const pnlPositive = totalPnl >= 0;

  return (
    <div style={s.page}>
      {/* Summary cards */}
      <div style={s.cards}>
        {[
          { label: "TOTAL VALUE",     val: `₹ ${summary?.total_portfolio_value?.toLocaleString("en-IN", {minimumFractionDigits: 2}) ?? "—"}`, color: "#e2e8f0", sub: "PORTFOLIO" },
          { label: "CASH AVAILABLE",  val: `₹ ${summary?.available_balance?.toLocaleString("en-IN", {minimumFractionDigits: 2}) ?? "—"}`, color: "#e2e8f0", sub: "FREE MARGIN" },
          { label: "HOLDINGS VALUE",  val: `₹ ${summary?.holdings_value?.toLocaleString("en-IN", {minimumFractionDigits: 2}) ?? "—"}`, color: "#f0b429", sub: "INVESTED" },
          { label: "RESERVED",        val: `₹ ${summary?.reserved_balance?.toLocaleString("en-IN", {minimumFractionDigits: 2}) ?? "—"}`, color: "#94a3b8", sub: "IN ORDERS" },
          { label: "UNREALIZED P&L",  val: `${pnlPositive ? "+" : ""}₹ ${totalPnl.toLocaleString("en-IN", {minimumFractionDigits: 2})}`, color: pnlPositive ? "#10b981" : "#ef4444", sub: pnlPositive ? "PROFIT" : "LOSS" },
        ].map(({ label, val, color, sub }) => (
          <div key={label} style={s.card}>
            <div style={s.cardTop}>
              <span style={s.cardLabel}>{label}</span>
              <span style={s.cardSub}>{sub}</span>
            </div>
            <div style={{ ...s.cardVal, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* P&L bar */}
      {summary && (
        <div style={s.allocationBar}>
          <div style={s.allocLabel}>CAPITAL ALLOCATION</div>
          <div style={s.allocTrack}>
            {summary.holdings_value > 0 && (
              <div style={{ ...s.allocFill, background: "#f0b429", width: `${(summary.holdings_value / summary.total_portfolio_value) * 100}%` }} />
            )}
            {summary.reserved_balance > 0 && (
              <div style={{ ...s.allocFill, background: "#3b82f6", width: `${(summary.reserved_balance / summary.total_portfolio_value) * 100}%` }} />
            )}
            <div style={{ ...s.allocFill, background: "#1e293b", flex: 1 }} />
          </div>
          <div style={s.allocLegend}>
            <span style={s.legendDot("#f0b429")}>● Holdings</span>
            <span style={s.legendDot("#3b82f6")}>● Reserved</span>
            <span style={s.legendDot("#1e293b")}>● Cash</span>
          </div>
        </div>
      )}

      {/* Positions */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>OPEN POSITIONS</span>
          <span style={s.posCount}>{pnl?.positions?.length ?? 0} POSITIONS</span>
        </div>
        {!pnl?.positions?.length
          ? <div style={s.empty}>NO OPEN POSITIONS — START TRADING TO BUILD YOUR PORTFOLIO</div>
          : (
            <table style={s.table}>
              <thead>
                <tr>
                  {["SYMBOL", "QTY", "AVG COST", "CMP", "INVESTED", "CURRENT", "UNRLZD P&L", "RETURN"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pnl.positions.map((p, i) => {
                  const pos = p.unrealized_pnl >= 0;
                  return (
                    <tr key={p.symbol} style={s.tr}>
                      <td style={s.tdSym}>{p.symbol}</td>
                      <td style={s.td}>{p.quantity.toLocaleString()}</td>
                      <td style={s.td}>₹ {parseFloat(p.avg_buy_price).toFixed(2)}</td>
                      <td style={s.td}>₹ {parseFloat(p.current_price).toFixed(2)}</td>
                      <td style={s.td}>₹ {(p.avg_buy_price * p.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td style={s.td}>₹ {p.current_value?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...s.td, color: pos ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                        {pos ? "+" : ""}₹ {p.unrealized_pnl?.toFixed(2)}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.pctBadge, background: pos ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: pos ? "#10b981" : "#ef4444", borderColor: pos ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)" }}>
                          {pos ? "▲" : "▼"} {Math.abs(p.pnl_percent?.toFixed(2))}%
                        </span>
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

const legendDot = (color) => ({ fontSize: "10px", color: "#94a3b8", display: "flex", gap: "4px", alignItems: "center" });

const s = {
  page: { display: "flex", flexDirection: "column", gap: "14px" },
  loading: { color: "#334155", fontSize: "11px", letterSpacing: "3px", padding: "40px" },
  cards: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" },
  card: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "14px 16px" },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  cardLabel: { fontSize: "8px", color: "#475569", letterSpacing: "3px" },
  cardSub: { fontSize: "8px", color: "#1e293b", letterSpacing: "2px" },
  cardVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  allocationBar: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "12px 16px" },
  allocLabel: { fontSize: "8px", color: "#334155", letterSpacing: "3px", marginBottom: "8px" },
  allocTrack: { height: "6px", borderRadius: "3px", overflow: "hidden", display: "flex", background: "#111827" },
  allocFill: { height: "100%", transition: "width 0.5s ease" },
  allocLegend: { display: "flex", gap: "16px", marginTop: "8px", fontSize: "10px", color: "#94a3b8" },
  legendDot: (c) => ({ color: c }),
  section: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" },
  sectionHeader: { display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" },
  sectionTitle: { fontSize: "9px", color: "#f0b429", letterSpacing: "4px", fontWeight: 700 },
  posCount: { fontSize: "9px", color: "#334155", letterSpacing: "2px" },
  empty: { padding: "40px", color: "#334155", fontSize: "10px", letterSpacing: "2px", textAlign: "center" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "10px 14px", fontSize: "8px", letterSpacing: "2px", color: "#334155", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 500, background: "#0c1018" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.03)" },
  tdSym: { padding: "11px 14px", color: "#f0b429", fontWeight: 700, letterSpacing: "2px", fontSize: "13px" },
  td: { padding: "11px 14px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" },
  pctBadge: { padding: "2px 7px", borderRadius: "2px", fontSize: "10px", fontWeight: 700, border: "1px solid", letterSpacing: "1px" },
};