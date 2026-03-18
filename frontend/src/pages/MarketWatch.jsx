import { useEffect, useState } from "react";
import { api } from "../api";

const SECTOR_COLORS = {
  Technology: "#3b82f6", Banking: "#8b5cf6", Automotive: "#f59e0b",
  Healthcare: "#10b981", Energy: "#ef4444",
};

export default function MarketWatch({ token, stocks: propStocks, onSelectSymbol }) {
  const [stocks, setStocks]   = useState(propStocks || []);
  const [filter, setFilter]   = useState("");
  const [prevPrices, setPrev] = useState({});
  const [flashing, setFlashing] = useState({});

  useEffect(() => {
    if (propStocks?.length) { setStocks(propStocks); return; }
    const fetch = () => api(token).get("/stocks/").then(r => setStocks(r.data)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 5000);
    return () => clearInterval(t);
  }, [token, propStocks]);

  // Flash cells when price changes
  useEffect(() => {
    const newFlash = {};
    stocks.forEach(s => {
      const prev = prevPrices[s.Symbol];
      const curr = parseFloat(s.LTP);
      if (prev !== undefined && prev !== curr) {
        newFlash[s.Symbol] = curr > prev ? "green" : "red";
      }
    });
    if (Object.keys(newFlash).length) {
      setFlashing(newFlash);
      setTimeout(() => setFlashing({}), 600);
    }
    const map = {};
    stocks.forEach(s => { map[s.Symbol] = parseFloat(s.LTP); });
    setPrev(map);
  }, [stocks]);

  const filtered = stocks.filter(s =>
    s.Symbol.toLowerCase().includes(filter.toLowerCase()) ||
    s.Sector?.toLowerCase().includes(filter.toLowerCase())
  );

  const active  = stocks.filter(s => s.Status === "Active").length;
  const halted  = stocks.filter(s => s.Status === "Halted").length;
  const sectors = [...new Set(stocks.map(s => s.Sector).filter(Boolean))];

  return (
    <div style={s.page}>
      {/* Summary bar — like the reference screenshot's top cards */}
      <div style={s.summaryBar}>
        <div style={s.summCard}>
          <div style={s.summLabel}>TOTAL INSTRUMENTS</div>
          <div style={s.summVal}>{stocks.length}</div>
        </div>
        <div style={{ ...s.summCard, borderColor: "rgba(16,185,129,0.3)" }}>
          <div style={s.summLabel}>ACTIVE</div>
          <div style={{ ...s.summVal, color: "#10b981" }}>{active}</div>
        </div>
        <div style={{ ...s.summCard, borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={s.summLabel}>HALTED</div>
          <div style={{ ...s.summVal, color: "#ef4444" }}>{halted}</div>
        </div>
        <div style={s.summCard}>
          <div style={s.summLabel}>SECTORS</div>
          <div style={s.summVal}>{sectors.length}</div>
        </div>
        <div style={{ ...s.summCard, flex: 2 }}>
          <div style={s.summLabel}>SECTOR BREAKDOWN</div>
          <div style={s.sectorDots}>
            {sectors.map(sec => (
              <span key={sec} style={{ ...s.sectorDot, background: SECTOR_COLORS[sec] || "#94a3b8" }}>
                {sec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Table header row */}
      <div style={s.tableHeader}>
        <div style={s.tableTitle}>LIVE MARKET FEED</div>
        <input
          style={s.search}
          placeholder="Search symbol or sector..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "SYMBOL", "SECTOR", "LTP (₹)", "STATUS", "ACTION"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock, i) => {
              const flash = flashing[stock.Symbol];
              return (
                <tr key={stock.Symbol} style={s.tr}>
                  <td style={s.tdNum}>{i + 1}</td>
                  <td style={s.tdSym}>{stock.Symbol}</td>
                  <td style={s.td}>
                    <span style={{ ...s.sectorTag, background: `${SECTOR_COLORS[stock.Sector] || "#475569"}18`, color: SECTOR_COLORS[stock.Sector] || "#94a3b8", borderColor: `${SECTOR_COLORS[stock.Sector] || "#475569"}40` }}>
                      {stock.Sector}
                    </span>
                  </td>
                  <td style={{ ...s.tdPrice, background: flash === "green" ? "rgba(16,185,129,0.15)" : flash === "red" ? "rgba(239,68,68,0.15)" : "transparent", transition: "background 0.3s" }}>
                    ₹ {parseFloat(stock.LTP).toFixed(2)}
                  </td>
                  <td style={s.td}>
                    <span style={stock.Status === "Active" ? s.badgeActive : s.badgeHalted}>
                      {stock.Status === "Active" ? "● ACTIVE" : "■ HALTED"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button style={s.btnView} onClick={() => onSelectSymbol(stock.Symbol)}>ORDER BOOK</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={s.empty}>NO INSTRUMENTS MATCH YOUR SEARCH</div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "14px", height: "100%" },
  summaryBar: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr", gap: "8px" },
  summCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", padding: "10px 14px" },
  summLabel: { fontSize: "8px", color: "#475569", letterSpacing: "3px", marginBottom: "6px" },
  summVal: { fontSize: "22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#e2e8f0", letterSpacing: "1px" },
  sectorDots: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" },
  sectorDot: { fontSize: "9px", padding: "2px 8px", borderRadius: "2px", color: "#07090f", fontWeight: 700, letterSpacing: "1px" },
  tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  tableTitle: { fontSize: "10px", color: "#f0b429", letterSpacing: "4px", fontWeight: 700 },
  search: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", color: "#e2e8f0", padding: "7px 12px", fontSize: "11px", width: "220px" },
  tableWrap: { flex: 1, overflow: "auto", background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "10px 14px", fontSize: "9px", letterSpacing: "2px", color: "#334155", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 500, position: "sticky", top: 0, background: "#0c1018", zIndex: 1 },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s", cursor: "default" },
  tdNum: { padding: "11px 14px", color: "#334155", fontSize: "11px" },
  tdSym: { padding: "11px 14px", color: "#f0b429", fontWeight: 600, letterSpacing: "2px", fontSize: "13px" },
  td: { padding: "11px 14px", color: "#94a3b8" },
  tdPrice: { padding: "11px 14px", color: "#e2e8f0", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: "13px", borderRadius: "2px" },
  sectorTag: { padding: "2px 8px", borderRadius: "2px", fontSize: "9px", letterSpacing: "1px", fontWeight: 500, border: "1px solid" },
  badgeActive: { color: "#10b981", fontSize: "9px", letterSpacing: "2px", fontWeight: 700 },
  badgeHalted: { color: "#ef4444", fontSize: "9px", letterSpacing: "2px", fontWeight: 700 },
  actions: { display: "flex", gap: "6px" },
  btnView: { background: "none", border: "1px solid rgba(240,180,41,0.2)", color: "#f0b429", padding: "4px 10px", fontSize: "9px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px", transition: "background 0.15s" },
  empty: { padding: "40px", textAlign: "center", color: "#334155", fontSize: "11px", letterSpacing: "3px" },
};