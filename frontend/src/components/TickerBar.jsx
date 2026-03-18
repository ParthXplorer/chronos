const MOCK = [
  { sym: "AAPL",     price: "150.00", chg: "+1.24",  pct: "+0.83%" },
  { sym: "TSLA",     price: "700.00", chg: "-8.50",  pct: "-1.20%" },
  { sym: "GOOGL",    price: "2800.00",chg: "+12.30", pct: "+0.44%" },
  { sym: "INFY",     price: "1450.00",chg: "+5.00",  pct: "+0.35%" },
  { sym: "HDFCBANK", price: "1600.00",chg: "-18.00", pct: "-1.11%" },
  { sym: "TCS",      price: "3600.00",chg: "+22.00", pct: "+0.61%" },
  { sym: "RELIANCE", price: "2500.00",chg: "-14.50", pct: "-0.58%" },
  { sym: "WIPRO",    price: "420.00", chg: "+3.20",  pct: "+0.77%" },
  { sym: "ICICIBANK",price: "950.00", chg: "+6.75",  pct: "+0.72%" },
  { sym: "SUNPHARMA",price: "1120.00",chg: "-9.00",  pct: "-0.80%" },
];

export default function TickerBar({ stocks = [] }) {
  const items = stocks.length
    ? stocks.map(s => ({ sym: s.Symbol, price: parseFloat(s.LTP).toFixed(2), chg: "–", pct: "–" }))
    : MOCK;

  const doubled = [...items, ...items];

  return (
    <div style={s.bar}>
      <div style={s.label}>LIVE</div>
      <div style={s.track}>
        <div style={s.scroll}>
          {doubled.map((t, i) => {
            const up = !t.chg.startsWith("-") && t.chg !== "–";
            return (
              <span key={i} style={s.item}>
                <span style={s.sym}>{t.sym}</span>
                <span style={s.price}>{t.price}</span>
                <span style={{ ...s.chg, color: up ? "#10b981" : t.chg === "–" ? "#475569" : "#ef4444" }}>
                  {up ? "▲" : t.chg === "–" ? "" : "▼"} {t.pct}
                </span>
                <span style={s.sep}>|</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const s = {
  bar: { height: "28px", background: "#08101a", borderBottom: "1px solid rgba(240,180,41,0.15)", display: "flex", alignItems: "center", overflow: "hidden", flexShrink: 0 },
  label: { padding: "0 10px", fontSize: "9px", fontWeight: 700, letterSpacing: "3px", color: "#f0b429", borderRight: "1px solid rgba(240,180,41,0.2)", height: "100%", display: "flex", alignItems: "center", background: "rgba(240,180,41,0.06)", flexShrink: 0 },
  track: { flex: 1, overflow: "hidden", position: "relative" },
  scroll: { display: "flex", animation: "ticker-scroll 40s linear infinite", width: "max-content" },
  item: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 8px", fontSize: "11px", whiteSpace: "nowrap" },
  sym: { color: "#f0b429", fontWeight: 600, letterSpacing: "1px" },
  price: { color: "#e2e8f0", fontVariantNumeric: "tabular-nums" },
  chg: { fontSize: "10px", fontVariantNumeric: "tabular-nums" },
  sep: { color: "rgba(255,255,255,0.08)", margin: "0 4px" },
};