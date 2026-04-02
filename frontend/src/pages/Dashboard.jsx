import { useState, useEffect } from "react";
import TickerBar   from "../components/TickerBar";
import MarketWatch from "./MarketWatch";
import OrderBook   from "./OrderBook";
import PlaceOrder  from "./PlaceOrder";
import Portfolio   from "./Portfolio";
import ActiveOrders from "./ActiveOrders";
import GlobalMap   from "./GlobalMap";
import { api } from "../api";

const NAV = [
  { id: "map",       icon: "◉", label: "GLOBAL MAP"   },
  { id: "market",    icon: "▦", label: "MARKET WATCH" },
  { id: "orderbook", icon: "≋", label: "ORDER BOOK"   },
  { id: "trade",     icon: "⇄", label: "PLACE ORDER"  },
  { id: "portfolio", icon: "◎", label: "PORTFOLIO"    },
  { id: "orders",    icon: "≡", label: "MY ORDERS"    },
];

export default function Dashboard({ token, user, onLogout }) {
  const [active, setActive]           = useState("map");
  const [selectedSymbol, setSymbol]   = useState("AAPL");
  const [stocks, setStocks]           = useState([]);
  const [time, setTime]               = useState(new Date());
  const [collapsed, setCollapsed]     = useState(false);

  useEffect(() => {
    api(token).get("/stocks/").then(r => setStocks(r.data)).catch(() => {});
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [token]);

  const handleSymbolSelect = sym => { setSymbol(sym); setActive("orderbook"); };

  const renderPage = () => {
    switch (active) {
      case "map":       return <GlobalMap   token={token} stocks={stocks} onSelectSymbol={handleSymbolSelect} />;
      case "market":    return <MarketWatch token={token} stocks={stocks} onSelectSymbol={handleSymbolSelect} />;
      case "orderbook": return <OrderBook   symbol={selectedSymbol} onSymbolChange={setSymbol} />;
      case "trade":     return <PlaceOrder  token={token} defaultSymbol={selectedSymbol} />;
      case "portfolio": return <Portfolio   token={token} />;
      case "orders":    return <ActiveOrders token={token} />;
      default:          return null;
    }
  };

  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const username = user?.email?.split("@")[0].toUpperCase() ?? "TRADER";

  return (
    <div style={s.shell}>
      <TickerBar stocks={stocks} />

      <div style={s.body}>
        <aside style={{ ...s.sidebar, width: collapsed ? "52px" : "200px" }}>
          <div style={s.logoBlock}>
            {!collapsed && (
              <>
                <span style={s.logoGlyph}>◈</span>
                <div>
                  <div style={s.logoText}>CHRONOS</div>
                  <div style={s.logoSub}>EXCHANGE</div>
                </div>
              </>
            )}
            {collapsed && <span style={{ ...s.logoGlyph, margin: "0 auto" }}>◈</span>}
          </div>

          <button style={s.collapseBtn} onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
            {collapsed ? "▷" : "◁"}
          </button>

          <nav style={s.nav}>
            {NAV.map(n => (
              <button
                key={n.id}
                style={active === n.id ? s.navActive : s.navItem}
                onClick={() => setActive(n.id)}
                title={collapsed ? n.label : undefined}
              >
                <span style={s.navIcon}>{n.icon}</span>
                {!collapsed && <span style={s.navLabel}>{n.label}</span>}
                {active === n.id && <div style={s.navBar} />}
              </button>
            ))}
          </nav>

          {!collapsed && (
            <div style={s.miniCards}>
              <div style={s.miniHeader}>QUICK WATCH</div>
              {stocks.slice(0, 4).map(s2 => (
                <div key={s2.Symbol} style={s.miniCard} onClick={() => handleSymbolSelect(s2.Symbol)}>
                  <span style={s.miniSym}>{s2.Symbol}</span>
                  <span style={s.miniPrice}>
                    {parseFloat(s2.LTP) >= 100 ? Math.round(s2.LTP) : parseFloat(s2.LTP).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={s.sideBottom}>
            {!collapsed && (
              <div style={s.userCard}>
                <div style={s.userAvatar}>{username.slice(0, 2)}</div>
                <div>
                  <div style={s.userName}>{username}</div>
                  <div style={s.userRole}>RETAIL TRADER</div>
                </div>
              </div>
            )}
            <button style={s.logoutBtn} onClick={onLogout} title="Logout">
              {collapsed ? "⎋" : "⎋ LOGOUT"}
            </button>
          </div>
        </aside>

        <main style={s.main}>
          <div style={s.topbar}>
            <div style={s.breadcrumb}>
              <span style={s.breadDim}>CHRONOS /</span>
              <span style={s.breadActive}>
                {NAV.find(n => n.id === active)?.label ?? ""}
              </span>
              {active === "orderbook" && (
                <span style={s.symbolPill}>{selectedSymbol}</span>
              )}
            </div>

            <div style={s.topRight}>
              <div style={s.clockBlock}>
                <span style={s.clockTime}>{timeStr}</span>
                <span style={s.clockDate}>{dateStr}</span>
              </div>
              <div style={s.livePill}>
                <span style={s.liveDot} />
                LIVE
              </div>
            </div>
          </div>

          <div style={s.content}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

const s = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg-0)",
    fontFamily: "var(--font-mono)",
    overflow: "hidden",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },

  sidebar: {
    background: "var(--bg-1)",
    borderRight: "1px solid var(--border-dim)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    transition: "width 0.2s ease",
    overflow: "hidden",
  },
  logoBlock: {
    padding: "14px 14px 12px",
    borderBottom: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "52px",
  },
  logoGlyph: { fontSize: "20px", color: "var(--amber)", flexShrink: 0 },
  logoText: {
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 900,
    color: "var(--text-0)",
    letterSpacing: "5px",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  logoSub: { fontSize: "7px", color: "var(--text-5)", letterSpacing: "4px", marginTop: "2px", whiteSpace: "nowrap" },

  collapseBtn: {
    background: "none",
    border: "none",
    color: "var(--text-4)",
    fontSize: "10px",
    cursor: "pointer",
    padding: "5px",
    textAlign: "center",
    borderBottom: "1px solid var(--border-dim)",
    fontFamily: "var(--font-mono)",
    letterSpacing: "1px",
    flexShrink: 0,
  },

  nav: { padding: "6px 0", flexShrink: 0 },
  navItem: {
    width: "100%",
    background: "none",
    border: "none",
    color: "var(--text-4)",
    padding: "9px 14px",
    fontSize: "9px",
    letterSpacing: "1.5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    textAlign: "left",
    position: "relative",
    transition: "color 0.15s, background 0.15s",
    fontFamily: "var(--font-mono)",
    whiteSpace: "nowrap",
  },
  navActive: {
    width: "100%",
    background: "var(--amber-dim)",
    border: "none",
    color: "var(--amber)",
    padding: "9px 14px",
    fontSize: "9px",
    letterSpacing: "1.5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    textAlign: "left",
    position: "relative",
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    whiteSpace: "nowrap",
  },
  navIcon: { fontSize: "12px", width: "14px", flexShrink: 0, textAlign: "center" },
  navLabel: { fontSize: "9px", letterSpacing: "1.5px", overflow: "hidden" },
  navBar: {
    position: "absolute",
    right: 0,
    top: "20%",
    height: "60%",
    width: "2px",
    background: "var(--amber)",
    borderRadius: "1px",
  },

  miniCards: {
    padding: "10px 10px 6px",
    borderTop: "1px solid var(--border-dim)",
    flex: 1,
    overflow: "hidden",
  },
  miniHeader: {
    fontSize: "7px",
    color: "var(--text-5)",
    letterSpacing: "3px",
    marginBottom: "7px",
    paddingLeft: "2px",
  },
  miniCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    marginBottom: "3px",
    transition: "background 0.12s",
    background: "rgba(255,255,255,0.015)",
    border: "1px solid var(--border-dim)",
  },
  miniSym: { fontSize: "9px", color: "var(--text-2)", letterSpacing: "1px" },
  miniPrice: { fontSize: "9px", color: "var(--amber)", fontVariantNumeric: "tabular-nums" },

  sideBottom: {
    borderTop: "1px solid var(--border-dim)",
    padding: "10px",
    flexShrink: 0,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    overflow: "hidden",
  },
  userAvatar: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "var(--amber-dim)",
    border: "1px solid var(--border-amber)",
    color: "var(--amber)",
    fontSize: "9px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    letterSpacing: "0.5px",
  },
  userName: { fontSize: "10px", color: "var(--text-2)", fontWeight: 600, letterSpacing: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "7px", color: "var(--text-5)", letterSpacing: "2px", marginTop: "1px" },
  logoutBtn: {
    width: "100%",
    background: "none",
    border: "1px solid var(--border-dim)",
    color: "var(--text-4)",
    padding: "6px",
    fontSize: "9px",
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    transition: "color 0.15s, border-color 0.15s",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },

  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  topbar: {
    height: "42px",
    background: "var(--bg-1)",
    borderBottom: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    flexShrink: 0,
    gap: "12px",
  },
  breadcrumb: { display: "flex", gap: "7px", alignItems: "center", fontSize: "11px", overflow: "hidden" },
  breadDim: { color: "var(--text-5)", letterSpacing: "1px", whiteSpace: "nowrap" },
  breadActive: { color: "var(--amber)", fontWeight: 600, letterSpacing: "2px", whiteSpace: "nowrap" },
  symbolPill: {
    background: "var(--amber-dim)",
    border: "1px solid var(--border-amber)",
    color: "var(--amber)",
    padding: "2px 9px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "2px",
    borderRadius: "var(--radius-sm)",
    whiteSpace: "nowrap",
  },
  topRight: { display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 },
  clockBlock: { display: "flex", gap: "8px", alignItems: "baseline" },
  clockTime: { fontSize: "12px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums", letterSpacing: "1px" },
  clockDate: { fontSize: "9px", color: "var(--text-5)", letterSpacing: "1px" },
  livePill: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "8px",
    color: "var(--green)",
    letterSpacing: "2px",
    fontWeight: 700,
  },
  liveDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "var(--green)",
    animation: "pulse-dot 2s ease-in-out infinite",
    display: "inline-block",
  },
  content: { flex: 1, overflow: "auto", padding: "16px 20px" },
};