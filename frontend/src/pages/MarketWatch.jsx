import { useEffect, useState } from "react";
import { api } from "../api";

const SECTOR_COLORS = {
  Technology: { bg: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "rgba(56,189,248,0.2)" },
  Banking:    { bg: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "rgba(167,139,250,0.2)" },
  Automotive: { bg: "rgba(245,158,11,0.08)",  color: "#f59e0b", border: "rgba(245,158,11,0.2)"  },
  Healthcare: { bg: "rgba(52,211,153,0.08)",  color: "#34d399", border: "rgba(52,211,153,0.2)"  },
  Energy:     { bg: "rgba(251,146,60,0.08)",   color: "#fb923c", border: "rgba(251,146,60,0.2)"   },
};

export default function MarketWatch({ token, stocks: propStocks = [], onSelectSymbol }) {
  const [stocks,   setStocks]   = useState(propStocks);
  const [filter,   setFilter]   = useState("");
  const [flashing, setFlashing] = useState({});
  const [prevPrices, setPrev]   = useState({});
  const [sortKey,  setSortKey]  = useState("Symbol");
  const [sortDir,  setSortDir]  = useState(1);

  useEffect(() => {
    if (propStocks?.length) { setStocks(propStocks); return; }
    const fetch = () => api(token).get("/stocks/").then(r => setStocks(r.data)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 5000);
    return () => clearInterval(t);
  }, [token, propStocks]);

  useEffect(() => {
    const newFlash = {};
    stocks.forEach(s => {
      const prev = prevPrices[s.Symbol];
      const curr = parseFloat(s.LTP);
      if (prev !== undefined && prev !== curr)
        newFlash[s.Symbol] = curr > prev ? "green" : "red";
    });
    if (Object.keys(newFlash).length) {
      setFlashing(newFlash);
      setTimeout(() => setFlashing({}), 700);
    }
    const map = {};
    stocks.forEach(s => { map[s.Symbol] = parseFloat(s.LTP); });
    setPrev(map);
  }, [stocks]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const filtered = stocks
    .filter(s =>
      s.Symbol.toLowerCase().includes(filter.toLowerCase()) ||
      (s.Sector ?? "").toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      let av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
      if (sortKey === "LTP") { av = parseFloat(av); bv = parseFloat(bv); }
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

  const active  = stocks.filter(s => s.Status === "Active").length;
  const halted  = stocks.filter(s => s.Status !== "Active").length;
  const sectors = [...new Set(stocks.map(s => s.Sector).filter(Boolean))];

  const SortIcon = ({ col }) => (
    <span style={{ marginLeft: "3px", color: sortKey === col ? "var(--amber)" : "var(--text-5)", fontSize: "8px" }}>
      {sortKey === col ? (sortDir === 1 ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div style={s.page}>
      <div style={s.summaryBar}>
        <div style={s.summCard}>
          <div style={s.summLabel}>TOTAL INSTRUMENTS</div>
          <div style={s.summVal}>{stocks.length}</div>
        </div>
        <div style={{ ...s.summCard, borderColor: "rgba(16,185,129,0.18)" }}>
          <div style={s.summLabel}>ACTIVE</div>
          <div style={{ ...s.summVal, color: "var(--green)" }}>{active}</div>
        </div>
        <div style={{ ...s.summCard, borderColor: "rgba(244,63,94,0.18)" }}>
          <div style={s.summLabel}>HALTED</div>
          <div style={{ ...s.summVal, color: "var(--red)" }}>{halted}</div>
        </div>
        <div style={s.summCard}>
          <div style={s.summLabel}>SECTORS</div>
          <div style={s.summVal}>{sectors.length}</div>
        </div>
        <div style={{ ...s.summCard, flex: 2 }}>
          <div style={s.summLabel}>SECTOR BREAKDOWN</div>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "4px" }}>
            {sectors.map(sec => {
              const c = SECTOR_COLORS[sec] ?? { bg: "rgba(148,163,184,0.08)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" };
              return (
                <span key={sec} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "8px", letterSpacing: "1px", fontWeight: 600 }}>
                  {sec}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div style={s.tableHeader}>
        <div style={s.tableTitle}>LIVE MARKET FEED</div>
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input
            style={s.search}
            placeholder="Search symbol or sector..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              {[
                { key: "Symbol", label: "SYMBOL"  },
                { key: "Sector", label: "SECTOR"  },
                { key: "LTP",    label: "LTP (₹)" },
                { key: "Status", label: "STATUS"  },
              ].map(({ key, label }) => (
                <th key={key} style={{ ...s.th, cursor: "pointer" }} onClick={() => toggleSort(key)}>
                  {label} <SortIcon col={key} />
                </th>
              ))}
              <th style={s.th}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock, i) => {
              const flash = flashing[stock.Symbol];
              const sec = SECTOR_COLORS[stock.Sector] ?? { bg: "rgba(148,163,184,0.08)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" };
              return (
                <tr key={stock.Symbol} style={s.tr}>
                  <td style={s.tdNum}>{i + 1}</td>
                  <td style={s.tdSym}>{stock.Symbol}</td>
                  <td style={s.td}>
                    <span style={{ background: sec.bg, color: sec.color, border: `1px solid ${sec.border}`, padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "8px", letterSpacing: "1px", fontWeight: 600 }}>
                      {stock.Sector}
                    </span>
                  </td>
                  <td style={{
                    ...s.tdPrice,
                    background: flash === "green" ? "rgba(16,185,129,0.12)"
                              : flash === "red"   ? "rgba(244,63,94,0.12)"
                              : "transparent",
                    transition: "background 0.3s",
                  }}>
                    ₹ {parseFloat(stock.LTP).toFixed(2)}
                    {flash && (
                      <span style={{ marginLeft: "5px", fontSize: "9px", color: flash === "green" ? "var(--green)" : "var(--red)" }}>
                        {flash === "green" ? "▲" : "▼"}
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={stock.Status === "Active" ? s.badgeActive : s.badgeHalted}>
                      {stock.Status === "Active" ? "● ACTIVE" : "■ HALTED"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button style={s.btnView} onClick={() => onSelectSymbol(stock.Symbol)}>
                        ORDER BOOK
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>⌕</div>
            NO INSTRUMENTS MATCH YOUR SEARCH
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "12px", height: "100%" },

  summaryBar: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr", gap: "8px", flexShrink: 0 },
  summCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
  },
  summLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px", marginBottom: "5px" },
  summVal: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 800,
    color: "var(--text-0)",
    letterSpacing: "1px",
  },

  tableHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  tableTitle: { fontSize: "9px", color: "var(--amber)", letterSpacing: "4px", fontWeight: 700 },
  searchWrap: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: { position: "absolute", left: "10px", color: "var(--text-4)", fontSize: "13px", pointerEvents: "none" },
  search: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-0)",
    padding: "7px 12px 7px 28px",
    fontSize: "11px",
    width: "240px",
    transition: "border-color 0.15s",
  },

  tableWrap: {
    flex: 1,
    overflow: "auto",
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: "8px",
    letterSpacing: "2px",
    color: "var(--text-4)",
    borderBottom: "1px solid var(--border-dim)",
    fontWeight: 500,
    position: "sticky",
    top: 0,
    background: "var(--bg-card)",
    zIndex: 1,
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid var(--border-dim)", transition: "background 0.12s" },
  tdNum: { padding: "10px 14px", color: "var(--text-5)", fontSize: "10px" },
  tdSym: { padding: "10px 14px", color: "var(--amber)", fontWeight: 700, letterSpacing: "2px", fontSize: "12px" },
  td: { padding: "10px 14px", color: "var(--text-2)" },
  tdPrice: {
    padding: "10px 14px",
    color: "var(--text-0)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    fontSize: "12px",
    borderRadius: "var(--radius-sm)",
  },
  badgeActive: { color: "var(--green)", fontSize: "9px", letterSpacing: "2px", fontWeight: 700 },
  badgeHalted: { color: "var(--red)",   fontSize: "9px", letterSpacing: "2px", fontWeight: 700 },
  btnView: {
    background: "none",
    border: "1px solid var(--border-amber)",
    color: "var(--amber)",
    padding: "4px 10px",
    fontSize: "8px",
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    transition: "background 0.15s",
  },
  empty: {
    padding: "60px",
    textAlign: "center",
    color: "var(--text-5)",
    fontSize: "9px",
    letterSpacing: "3px",
  },
};