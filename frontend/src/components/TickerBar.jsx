import { useEffect, useRef } from "react";

export default function TickerBar({ stocks = [] }) {
  const items = stocks.length
    ? stocks.map(s => ({
        sym: s.Symbol,
        price: parseFloat(s.LTP).toFixed(2),
        chg: "–",
        pct: "–",
        up: null,
      }))
    : MOCK;

  const doubled = [...items, ...items];

  return (
    <div style={s.bar}>
      <div style={s.label}>
        <span style={s.liveDot} />
        LIVE
      </div>
      <div style={s.track}>
        <div style={s.scroll}>
          {doubled.map((t, i) => {
            const up = t.up ?? (!t.chg.startsWith("-") && t.chg !== "–");
            return (
              <span key={i} style={s.item}>
                <span style={s.sym}>{t.sym}</span>
                <span style={s.price}>{t.price}</span>
                {t.pct !== "–" && (
                  <span style={{ ...s.chg, color: up ? "var(--green)" : "var(--red)" }}>
                    {up ? "▲" : "▼"} {t.pct}
                  </span>
                )}
                <span style={s.sep} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MOCK = [
  { sym: "AAPL",      price: "150.00", chg: "+1.24",  pct: "+0.83%",  up: true  },
  { sym: "TSLA",      price: "700.00", chg: "-8.50",  pct: "-1.20%",  up: false },
  { sym: "GOOGL",     price: "2800.00",chg: "+12.30", pct: "+0.44%",  up: true  },
  { sym: "INFY",      price: "1450.00",chg: "+5.00",  pct: "+0.35%",  up: true  },
  { sym: "HDFCBANK",  price: "1600.00",chg: "-18.00", pct: "-1.11%",  up: false },
  { sym: "TCS",       price: "3600.00",chg: "+22.00", pct: "+0.61%",  up: true  },
  { sym: "RELIANCE",  price: "2500.00",chg: "-14.50", pct: "-0.58%",  up: false },
  { sym: "WIPRO",     price: "420.00", chg: "+3.20",  pct: "+0.77%",  up: true  },
  { sym: "ICICIBANK", price: "950.00", chg: "+6.75",  pct: "+0.72%",  up: true  },
  { sym: "SUNPHARMA", price: "1120.00",chg: "-9.00",  pct: "-0.80%",  up: false },
  { sym: "MSFT",      price: "300.00", chg: "-0.66",  pct: "-0.22%",  up: false },
];

const s = {
  bar: {
    height: "26px",
    background: "var(--bg-1)",
    borderBottom: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  label: {
    padding: "0 12px",
    fontSize: "8px",
    fontWeight: 700,
    letterSpacing: "3px",
    color: "var(--amber)",
    borderRight: "1px solid var(--border-amber)",
    height: "100%",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--amber-glow)",
    flexShrink: 0,
  },
  liveDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "var(--amber)",
    display: "inline-block",
    animation: "pulse-dot 2s ease-in-out infinite",
  },
  track: { flex: 1, overflow: "hidden" },
  scroll: {
    display: "flex",
    animation: "ticker-scroll 45s linear infinite",
    width: "max-content",
  },
  item: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 10px",
    fontSize: "10px",
    whiteSpace: "nowrap",
  },
  sym: {
    color: "var(--amber)",
    fontWeight: 600,
    letterSpacing: "1.5px",
    fontSize: "9px",
  },
  price: {
    color: "var(--text-1)",
    fontVariantNumeric: "tabular-nums",
  },
  chg: {
    fontSize: "9px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  },
  sep: {
    width: "1px",
    height: "10px",
    background: "var(--border-soft)",
    marginLeft: "4px",
  },
};