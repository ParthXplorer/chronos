import { useEffect, useState } from "react";
import { api } from "../api";

export default function Portfolio({ token }) {
  const [pnl,     setPnl]     = useState(null);
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

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, 10000);
    return () => clearInterval(t);
  }, [token]);

  if (loading) return (
    <div style={s.loadWrap}>
      <span style={s.spinner} />
      <span style={s.loadText}>LOADING PORTFOLIO...</span>
    </div>
  );

  const totalPnl  = pnl?.total_unrealized_pnl ?? 0;
  const pnlUp     = totalPnl >= 0;
  const tvp       = summary?.total_portfolio_value ?? 1;
  const holdPct   = summary ? Math.min(100, (summary.holdings_value / tvp) * 100) : 0;
  const resvPct   = summary ? Math.min(100, (summary.reserved_balance / tvp) * 100) : 0;

  return (
    <div style={s.page}>
      <div style={s.cards}>
        {[
          { label: "TOTAL PORTFOLIO",  val: summary?.total_portfolio_value, prefix: "₹", color: "var(--text-0)", sub: "TOTAL VALUE" },
          { label: "CASH AVAILABLE",   val: summary?.available_balance,      prefix: "₹", color: "var(--blue)",  sub: "FREE MARGIN" },
          { label: "HOLDINGS VALUE",   val: summary?.holdings_value,         prefix: "₹", color: "var(--amber)", sub: "INVESTED" },
          { label: "RESERVED",         val: summary?.reserved_balance,       prefix: "₹", color: "var(--text-3)", sub: "IN ORDERS" },
          { label: "UNREALIZED P&L",
            val: Math.abs(totalPnl),
            prefix: (pnlUp ? "+" : "−") + "₹",
            color: pnlUp ? "var(--green)" : "var(--red)",
            sub: pnlUp ? "PROFIT" : "LOSS",
            glow: true,
          },
        ].map(({ label, val, prefix, color, sub, glow }) => (
          <div key={label} style={{ ...s.card, ...(glow ? { borderColor: color.replace("var(--", "rgba(").replace(")", ", 0.2)") } : {}) }}>
            <div style={s.cardTop}>
              <span style={s.cardLabel}>{label}</span>
              <span style={s.cardSub}>{sub}</span>
            </div>
            <div style={{ ...s.cardVal, color }}>
              {prefix} {(val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {summary && (
        <div style={s.alloc}>
          <div style={s.allocHead}>
            <span style={s.allocTitle}>CAPITAL ALLOCATION</span>
            <div style={s.allocLegend}>
              {[
                { color: "var(--amber)", label: `Holdings ${holdPct.toFixed(1)}%` },
                { color: "var(--blue)",  label: `Reserved ${resvPct.toFixed(1)}%` },
                { color: "var(--text-5)", label: "Cash" },
              ].map(({ color, label }) => (
                <span key={label} style={s.allocLegItem}>
                  <span style={{ ...s.allocDot, background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div style={s.allocTrack}>
            <div style={{ ...s.allocFill, background: "var(--amber)", width: `${holdPct}%` }} />
            <div style={{ ...s.allocFill, background: "var(--blue)",  width: `${resvPct}%` }} />
            <div style={{ ...s.allocFill, background: "var(--bg-3)", flex: 1 }} />
          </div>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>OPEN POSITIONS</span>
          <span style={s.posCount}>{pnl?.positions?.length ?? 0} POSITIONS · AUTO-REFRESH 10s</span>
        </div>

        {!pnl?.positions?.length
          ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>◎</div>
              <div>NO OPEN POSITIONS</div>
              <div style={s.emptySub}>Place orders to build your portfolio</div>
            </div>
          )
          : (
            <table style={s.table}>
              <thead>
                <tr>
                  {["SYMBOL", "QTY", "AVG COST", "CMP", "INVESTED", "CURRENT", "UNRLZD P&L", "RETURN %"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pnl.positions.map(p => {
                  const up = p.unrealized_pnl >= 0;
                  const invested = p.avg_buy_price * p.quantity;
                  return (
                    <tr key={p.symbol} style={s.tr}>
                      <td style={s.tdSym}>{p.symbol}</td>
                      <td style={s.td}>{p.quantity.toLocaleString()}</td>
                      <td style={s.td}>₹ {parseFloat(p.avg_buy_price).toFixed(2)}</td>
                      <td style={s.td}>₹ {parseFloat(p.current_price).toFixed(2)}</td>
                      <td style={s.td}>₹ {invested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td style={s.td}>₹ {(p.current_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...s.td, color: up ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                        {up ? "+" : "−"}₹ {Math.abs(p.unrealized_pnl ?? 0).toFixed(2)}
                      </td>
                      <td style={s.td}>
                        <span style={{
                          background: up ? "var(--green-dim)" : "var(--red-dim)",
                          color: up ? "var(--green)" : "var(--red)",
                          border: `1px solid ${up ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "1px",
                        }}>
                          {up ? "▲" : "▼"} {Math.abs(p.pnl_percent ?? 0).toFixed(2)}%
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

const s = {
  page: { display: "flex", flexDirection: "column", gap: "12px" },

  loadWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "60px",
    color: "var(--text-4)",
    fontSize: "10px",
    letterSpacing: "3px",
  },
  spinner: {
    width: "12px",
    height: "12px",
    border: "2px solid rgba(255,255,255,0.1)",
    borderTopColor: "var(--amber)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
    flexShrink: 0,
  },
  loadText: {},

  cards: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "12px 14px",
    transition: "border-color 0.2s",
  },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  cardLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px" },
  cardSub: { fontSize: "7px", color: "var(--text-5)", letterSpacing: "2px" },
  cardVal: {
    fontFamily: "var(--font-display)",
    fontSize: "17px",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.5px",
  },

  alloc: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "12px 16px",
    flexShrink: 0,
  },
  allocHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  allocTitle: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "3px" },
  allocLegend: { display: "flex", gap: "14px" },
  allocLegItem: { fontSize: "9px", color: "var(--text-3)", display: "flex", gap: "5px", alignItems: "center" },
  allocDot: { width: "7px", height: "7px", borderRadius: "50%", display: "inline-block" },
  allocTrack: {
    height: "5px",
    background: "var(--bg-2)",
    borderRadius: "3px",
    overflow: "hidden",
    display: "flex",
  },
  allocFill: { height: "100%", transition: "width 0.6s ease" },

  section: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    flex: 1,
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
  },
  sectionTitle: { fontSize: "9px", color: "var(--amber)", letterSpacing: "4px", fontWeight: 700 },
  posCount: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "2px" },

  empty: {
    padding: "60px",
    color: "var(--text-5)",
    fontSize: "9px",
    letterSpacing: "3px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  emptyIcon: { fontSize: "28px", opacity: 0.2, marginBottom: "4px" },
  emptySub: { fontSize: "9px", color: "var(--text-5)", letterSpacing: "2px" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: "11px" },
  th: {
    textAlign: "left",
    padding: "9px 14px",
    fontSize: "8px",
    letterSpacing: "2px",
    color: "var(--text-4)",
    borderBottom: "1px solid var(--border-dim)",
    fontWeight: 500,
    background: "var(--bg-card)",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid var(--border-dim)", transition: "background 0.1s" },
  tdSym: {
    padding: "11px 14px",
    color: "var(--amber)",
    fontWeight: 700,
    letterSpacing: "2px",
    fontSize: "12px",
  },
  td: {
    padding: "11px 14px",
    color: "var(--text-2)",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
};