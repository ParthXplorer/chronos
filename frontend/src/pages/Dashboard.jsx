import { useState, useEffect } from "react";
import TickerBar from "../components/TickerBar";
import MarketWatch from "./MarketWatch";
import OrderBook   from "./OrderBook";
import PlaceOrder  from "./PlaceOrder";
import Portfolio   from "./Portfolio";
import ActiveOrders from "./ActiveOrders";
import { api } from "../api";

const NAV = [
  { id: "market",    icon: "▦", label: "MARKET WATCH" },
  { id: "orderbook", icon: "≋", label: "ORDER BOOK"   },
  { id: "trade",     icon: "⇄", label: "PLACE ORDER"  },
  { id: "portfolio", icon: "◎", label: "PORTFOLIO"    },
  { id: "orders",    icon: "≡", label: "MY ORDERS"    },
];

export default function Dashboard({ token, user, onLogout }) {
  const [active, setActive] = useState("market");
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [stocks, setStocks]   = useState([]);
  const [time, setTime]       = useState(new Date());

  useEffect(() => {
    api(token).get("/stocks/").then(r => setStocks(r.data)).catch(() => {});
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [token]);

  const handleSymbolSelect = (sym) => { setSelectedSymbol(sym); setActive("orderbook"); };

  const renderPage = () => {
    switch (active) {
      case "market":    return <MarketWatch token={token} stocks={stocks} onSelectSymbol={handleSymbolSelect} />;
      case "orderbook": return <OrderBook symbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />;
      case "trade":     return <PlaceOrder token={token} defaultSymbol={selectedSymbol} />;
      case "portfolio": return <Portfolio token={token} />;
      case "orders":    return <ActiveOrders token={token} />;
    }
  };

  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  return (
    <div style={s.shell}>
      {/* Ticker strip */}
      <TickerBar stocks={stocks} />

      <div style={s.body}>
        {/* Sidebar */}
        <aside style={s.sidebar}>
          {/* Logo */}
          <div style={s.sidebarLogo}>
            <span style={s.logoIcon}>◈</span>
            <div>
              <div style={s.logoText}>CHRONOS</div>
              <div style={s.logoSub}>EXCHANGE</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={s.nav}>
            {NAV.map(n => (
              <button key={n.id} style={active === n.id ? s.navActive : s.navItem} onClick={() => setActive(n.id)}>
                <span style={s.navIcon}>{n.icon}</span>
                <span style={s.navLabel}>{n.label}</span>
                {active === n.id && <div style={s.navBar} />}
              </button>
            ))}
          </nav>

          {/* Market summary mini cards */}
          <div style={s.miniCards}>
            {stocks.slice(0, 3).map(s2 => (
              <div key={s2.Symbol} style={s.miniCard} onClick={() => handleSymbolSelect(s2.Symbol)}>
                <span style={s.miniSym}>{s2.Symbol}</span>
                <span style={s.miniPrice}>₹{parseFloat(s2.LTP).toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div style={s.sidebarBottom}>
            <div style={s.userCard}>
              <div style={s.userDot} />
              <div>
                <div style={s.userName}>{user?.email?.split("@")[0].toUpperCase()}</div>
                <div style={s.userRole}>RETAIL TRADER</div>
              </div>
            </div>
            <button style={s.logoutBtn} onClick={onLogout}>⎋ LOGOUT</button>
          </div>
        </aside>

        {/* Main */}
        <main style={s.main}>
          {/* Topbar */}
          <div style={s.topbar}>
            <div style={s.topbarLeft}>
              <div style={s.breadcrumb}>
                <span style={s.breadcrumbDim}>CHRONOS /</span>
                <span style={s.breadcrumbActive}>{NAV.find(n => n.id === active)?.label}</span>
              </div>
            </div>
            <div style={s.topbarRight}>
              {selectedSymbol && active === "orderbook" && (
                <div style={s.symbolPill}>{selectedSymbol}</div>
              )}
              <div style={s.clockBlock}>
                <div style={s.clockTime}>{timeStr}</div>
                <div style={s.clockDate}>{dateStr}</div>
              </div>
              <div style={s.livePill}>
                <span style={s.liveDot} />
                LIVE
              </div>
            </div>
          </div>

          {/* Page content */}
          <div style={s.content}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

const s = {
  shell: { display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-primary)", fontFamily: "var(--font-mono)", overflow: "hidden" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: "200px", minWidth: "200px", background: "#08101a", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" },
  sidebarLogo: { padding: "16px 16px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" },
  logoIcon: { fontSize: "22px", color: "#f0b429" },
  logoText: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "5px", lineHeight: 1 },
  logoSub: { fontSize: "8px", color: "#334155", letterSpacing: "4px", marginTop: "1px" },
  nav: { padding: "8px 0" },
  navItem: { width: "100%", background: "none", border: "none", color: "#475569", padding: "10px 16px", fontSize: "10px", letterSpacing: "1.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "9px", textAlign: "left", position: "relative", transition: "color 0.15s, background 0.15s" },
  navActive: { width: "100%", background: "rgba(240,180,41,0.06)", border: "none", color: "#f0b429", padding: "10px 16px", fontSize: "10px", letterSpacing: "1.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "9px", textAlign: "left", position: "relative", fontWeight: 600 },
  navIcon: { fontSize: "13px", width: "14px" },
  navLabel: { fontFamily: "var(--font-mono)" },
  navBar: { position: "absolute", right: 0, top: "20%", height: "60%", width: "2px", background: "#f0b429", borderRadius: "1px" },
  miniCards: { padding: "8px", display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid var(--border)", marginTop: "4px" },
  miniCard: { display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "2px", cursor: "pointer", border: "1px solid transparent", transition: "border-color 0.15s" },
  miniSym: { fontSize: "10px", color: "#94a3b8", letterSpacing: "1px" },
  miniPrice: { fontSize: "10px", color: "#f0b429", fontVariantNumeric: "tabular-nums" },
  sidebarBottom: { marginTop: "auto", borderTop: "1px solid var(--border)", padding: "12px" },
  userCard: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  userDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", flexShrink: 0 },
  userName: { fontSize: "11px", color: "#94a3b8", fontWeight: 600, letterSpacing: "1px" },
  userRole: { fontSize: "8px", color: "#334155", letterSpacing: "2px", marginTop: "1px" },
  logoutBtn: { width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.06)", color: "#334155", padding: "7px", fontSize: "9px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "2px", transition: "color 0.15s, border-color 0.15s" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topbar: { height: "44px", background: "#08101a", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 },
  topbarLeft: {},
  breadcrumb: { display: "flex", gap: "6px", alignItems: "center", fontSize: "11px" },
  breadcrumbDim: { color: "#334155", letterSpacing: "1px" },
  breadcrumbActive: { color: "#f0b429", fontWeight: 600, letterSpacing: "2px" },
  topbarRight: { display: "flex", alignItems: "center", gap: "12px" },
  symbolPill: { background: "rgba(240,180,41,0.1)", border: "1px solid rgba(240,180,41,0.2)", color: "#f0b429", padding: "3px 10px", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", borderRadius: "2px" },
  clockBlock: { textAlign: "right" },
  clockTime: { fontSize: "13px", color: "#94a3b8", fontVariantNumeric: "tabular-nums", letterSpacing: "1px", fontWeight: 500 },
  clockDate: { fontSize: "9px", color: "#334155", letterSpacing: "1px" },
  livePill: { display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: "#10b981", letterSpacing: "2px", fontWeight: 700 },
  liveDot: { width: "5px", height: "5px", borderRadius: "50%", background: "#10b981", animation: "pulse-dot 2s infinite" },
  content: { flex: 1, overflow: "auto", padding: "16px 20px" },
};