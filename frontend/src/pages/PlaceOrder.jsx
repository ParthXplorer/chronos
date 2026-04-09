import { useState } from "react";
import { api } from "../api";

export default function PlaceOrder({ token, defaultSymbol }) {
  const [form, setForm] = useState({
    symbol: defaultSymbol || "XTEST",
    side: "Buy",
    type: "Limit",
    limit_price: "100.00",
    quantity: "90",
  });
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chaosLogs, setChaosLogs] = useState(null);

  const f = k => e => setForm({ ...form, [k]: e.target.value });

  const pushLog = (type, msg) => {
    setChaosLogs(prev => [...(prev || []), { type, msg }]);
  };

// --- THE COMPREHENSIVE STRESS TEST ---
  const handleChaosTest = async () => {
    setChaosLogs([]); 
    pushLog("header", "🚀 INITIATING CHRONOS API STRESS TEST SUITE");

    const orderPayload = {
      symbol: "AAPL", // FIX 2: Changed from XTEST to AAPL (make sure AAPL is in your STOCKS table!)
      side: "Buy",
      type: "Limit",
      limit_price: 100.00,
      quantity: 90 
    };

    try {
      pushLog("info", "Fetching baseline portfolio state...");
      let initialWallet = 0;
      try {
        // FIX 1: Point to /portfolio/summary instead of /portfolio/
        const portRes = await api(token).get("/portfolio/summary");
        initialWallet = portRes.data.cash_balance; // The API returns cash_balance, not wallet_balance
        pushLog("info", `Baseline Wallet: ₹${initialWallet} | Reserved: ₹${portRes.data.reserved_balance}`);
      } catch (e) {
        pushLog("error", "Could not fetch portfolio summary. Make sure backend is running.");
        return; // Stop the test if we can't get the wallet
      }

      // =================================================================
      // TEST A: THE DOUBLE-SPEND ATTACK
      // =================================================================
      pushLog("header", "\n▶ TEST A: CONCURRENT DOUBLE-SPEND ATTACK");
      pushLog("info", "Firing 5 simultaneous $9,000 buy orders...");
      
      const buyRequests = Array.from({ length: 5 }).map(async (_, index) => {
        try {
          const res = await fetch("http://localhost:8000/orders/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(orderPayload)
          });
          return { index: index + 1, status: res.status, data: await res.json() };
        } catch (err) {
          return { index: index + 1, status: 500, data: { detail: "Network Error" } };
        }
      });

      const buyResponses = await Promise.all(buyRequests);
      let buySuccess = 0;
      
      buyResponses.forEach(r => {
        if (r.status === 201) {
          buySuccess++;
          const createdId = r.data?.order?.order_id || r.data?.order_id || r.data?.Order_ID || "UNKNOWN";
          pushLog("success", `[Req #${r.index}] 201: Order #${createdId} created successfully.`);
        } else {
          pushLog("error", `[Req #${r.index}] ${r.status}: Blocked - ${r.data.detail || "Error"}`);
        }
      });

      pushLog("summary", `TEST A RESULT: ${buySuccess} Succeeded | ${5 - buySuccess} Blocked by Row Locks`);

      // =================================================================
      // TEST B: THE CONCURRENT CANCEL RACE
      // =================================================================
      if (buySuccess > 0) {
        pushLog("header", "\n▶ TEST B: CONCURRENT CANCEL RACE CONDITION");
        
        const successfulData = buyResponses.find(r => r.status === 201).data;
        const targetId = successfulData?.order?.order_id || successfulData?.order_id || successfulData?.Order_ID;
        
        if (!targetId) {
            pushLog("error", "❌ Could not extract Order ID from backend response. Skipping Test B.");
        } else {
            pushLog("info", `Targeting Order #${targetId}. Firing 5 simultaneous DELETE requests...`);
            
            const cancelRequests = Array.from({ length: 5 }).map(async (_, index) => {
              try {
                const res = await fetch(`http://localhost:8000/orders/${targetId}`, {
                  method: "DELETE",
                  headers: { "Authorization": `Bearer ${token}` }
                });
                return { index: index + 1, status: res.status, data: await res.json() };
              } catch (err) {
                return { index: index + 1, status: 500, data: { detail: "Network Error" } };
              }
            });

            const cancelResponses = await Promise.all(cancelRequests);
            let cancelSuccess = 0;

            cancelResponses.forEach(r => {
              if (r.status === 200) {
                cancelSuccess++;
                pushLog("success", `[Cancel #${r.index}] 200: Order cancelled safely.`);
              } else {
                pushLog("error", `[Cancel #${r.index}] ${r.status}: Blocked - ${r.data.detail || "Error"}`);
              }
            });

            pushLog("summary", `TEST B RESULT: ${cancelSuccess} Succeeded | ${5 - cancelSuccess} Blocked by Row Locks`);
        }
      } else {
         pushLog("error", "\n▶ TEST B SKIPPED: No successful order was created in Test A. (Make sure you have at least ₹9,000 in your wallet!)");
      }

      // =================================================================
      // FINAL ANALYSIS
      // =================================================================
      pushLog("header", "\n🏁 SYSTEM ANALYSIS & VERIFICATION");
      try {
        // FIX 3: Also point final check to /portfolio/summary
        const finalPortRes = await api(token).get("/portfolio/summary");
        const finalWallet = finalPortRes.data.cash_balance;
        const finalReserved = finalPortRes.data.reserved_balance;
        
        pushLog("info", `Final Wallet: ₹${finalWallet} | Final Reserved: ₹${finalReserved}`);
        
        if (finalWallet === initialWallet && finalReserved === 0) {
           pushLog("success", "✅ SYSTEM SECURE: Wallet math perfectly reconciled. No leaked reservations.");
        } else {
           pushLog("error", "❌ VULNERABILITY DETECTED: Wallet math is corrupted!");
        }
      } catch (e) {
         pushLog("error", "Could not fetch final state.");
      }

    } catch (error) {
      pushLog("error", `Fatal Test Error: ${error.message}`);
    }
  };

  const closeChaosModal = () => {
    setChaosLogs(null);
    window.location.reload();
  };

  const submit = async (e) => {
    e.preventDefault(); setError(""); setResult(null); setLoading(true);
    try {
      const payload = {
        symbol:      form.symbol.toUpperCase(),
        side:        form.side,
        type:        form.type,
        quantity:    parseInt(form.quantity),
        limit_price: form.type === "Limit" ? parseFloat(form.limit_price) : null,
      };
      const res = await api(token).post("/orders/", payload);
      setResult(res.data.order || res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Order rejected");
    } finally { setLoading(false); }
  };

  const notional = form.limit_price && form.quantity
    ? parseFloat(form.limit_price) * parseInt(form.quantity)
    : null;
  const fee = notional ? notional * 0.0001 : null;
  const isBuy = form.side === "Buy";

  return (
    <>
      {/* CHAOS MODAL OVERLAY */}
      {chaosLogs && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <div style={s.modalHeader}>
              <span>⚠️ CONCURRENCY TEST SUITE</span>
              <button onClick={closeChaosModal} style={s.closeIcon}>✕</button>
            </div>
            <div style={s.modalBody}>
              {chaosLogs.map((log, i) => (
                <div key={i} style={
                  log.type === "success" ? s.logSuccess : 
                  log.type === "error" ? s.logError : 
                  log.type === "header" ? s.logHeader :
                  log.type === "summary" ? s.logSummary : s.logInfo
                }>
                  {log.msg}
                </div>
              ))}
            </div>
            <button onClick={closeChaosModal} style={s.modalCloseBtn}>
              VERIFY & CLOSE
            </button>
          </div>
        </div>
      )}

      {/* STANDARD PAGE CONTENT */}
      <div style={s.page}>
        <div style={s.ticket}>
          <div style={s.ticketHeader}>
            <div>
              <div style={s.ticketTitle}>ORDER TICKET</div>
              <div style={s.ticketSub}>Chronos Matching Engine</div>
            </div>
            <div style={s.engineTag}>C++ ENGINE</div>
          </div>

          <div style={s.sideToggle}>
            <button type="button" style={isBuy ? s.toggleBuy : s.toggleOff} onClick={() => setForm({ ...form, side: "Buy" })}>▲ BUY</button>
            <button type="button" style={!isBuy ? s.toggleSell : s.toggleOff} onClick={() => setForm({ ...form, side: "Sell" })}>▼ SELL</button>
          </div>

          <div style={s.sideBorder(isBuy)} />

          <form onSubmit={submit} style={s.form}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>INSTRUMENT</label>
                <input style={{ ...s.input, color: "var(--amber)", fontWeight: 700, letterSpacing: "3px", fontSize: "14px" }} value={form.symbol} onChange={f("symbol")} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>ORDER TYPE</label>
                <select style={s.input} value={form.type} onChange={f("type")}>
                  <option value="Limit">LIMIT</option>
                  <option value="Market">MARKET</option>
                </select>
              </div>
            </div>

            <div style={s.formRow}>
              {form.type === "Limit" && (
                <div style={s.field}>
                  <label style={s.label}>LIMIT PRICE (₹)</label>
                  <input style={s.input} type="number" step="0.01" min="0.01" value={form.limit_price} onChange={f("limit_price")} required />
                </div>
              )}
              <div style={s.field}>
                <label style={s.label}>QUANTITY (SHARES)</label>
                <input style={s.input} type="number" min="1" value={form.quantity} onChange={f("quantity")} required />
              </div>
            </div>

            {notional && (
              <div style={s.notionalBox}>
                <div style={s.notionalRow}>
                  <span style={s.notionalLabel}>ESTIMATED VALUE</span>
                  <span style={s.notionalVal}>₹ {notional.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={s.notionalRow}>
                  <span style={s.notionalLabel}>BROKERAGE FEE (0.01%)</span>
                  <span style={s.notionalFee}>₹ {fee.toFixed(4)}</span>
                </div>
                <div style={s.notionalBar}>
                  <div style={{ ...s.notionalFill, background: isBuy ? "var(--green)" : "var(--red)" }} />
                </div>
              </div>
            )}

            {error && <div style={s.errorBox}><span style={{ fontWeight: 700 }}>✗</span> {error}</div>}

            <button type="submit" style={loading ? s.btnOff : isBuy ? s.btnBuy : s.btnSell} disabled={loading}>
              {loading ? <><span style={s.spinner} /> PLACING ORDER...</> : `PLACE ${form.side.toUpperCase()} ORDER →`}
            </button>
          </form>
        </div>

        {result && (
          <div style={s.confirm}>
            <div style={s.confirmHeader}>
              <span style={s.confirmCheck}>✓</span>
              <div>
                <div style={s.confirmTitle}>ORDER CONFIRMED</div>
                <div style={s.confirmSub}>Sent to matching engine</div>
              </div>
            </div>
            <div style={s.confirmGrid}>
              {[
                ["ORDER ID",  `#${result.order_id ?? result.Order_ID}`],
                ["SYMBOL",    result.symbol ?? result.Symbol],
                ["SIDE",      result.side   ?? result.Side],
                ["TYPE",      result.type   ?? result.Type],
                ["PRICE",     `₹ ${result.limit_price ?? result.Limit_Price ?? "MARKET"}`],
                ["QTY",       result.total_qty ?? result.Total_Qty],
                ["STATUS",    result.status ?? result.Status],
              ].map(([k, v]) => (
                <div key={k} style={s.confirmRow}>
                  <span style={s.confirmKey}>{k}</span>
                  <span style={s.confirmVal}>{v}</span>
                </div>
              ))}
            </div>
            <button style={s.newOrderBtn} onClick={() => setResult(null)}>+ NEW ORDER</button>
          </div>
        )}

        <div style={s.guide}>
          <div style={s.guideTitle}>HOW IT WORKS</div>
          {[
            ["LIMIT ORDER",  "Executes at your specified price or better. Rests on orderbook if not immediately matched."],
            ["MARKET ORDER", "Executes immediately at best available price. Cancelled if no liquidity."],
            ["BUY",          "Reserves funds from wallet balance. Released if order is cancelled."],
            ["SELL",         "Requires existing holdings. Check portfolio before placing."],
            ["FEE",          "0.01% of notional value per fill. Deducted from seller proceeds."],
          ].map(([k, v]) => (
            <div key={k} style={s.guideRow}>
              <div style={s.guideKey}>{k}</div>
              <div style={s.guideVal}>{v}</div>
            </div>
          ))}
          
          <button type="button" onClick={handleChaosTest} style={s.chaosBtn}>
            ⚠️ RUN FULL STRESS TEST SUITE
          </button>
        </div>
      </div>
    </>
  );
}

// STYLES ----------------------------------------------------------------------
const s = {
  page: { display: "grid", gridTemplateColumns: "360px 1fr 1fr", gap: "14px", alignItems: "start" },
  
  /* --- FIX: UPDATED MODAL STYLES FOR FORCED SCROLLING --- */
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  modalContent: { background: "var(--bg-card)", border: "1px solid var(--border-dim)", borderRadius: "var(--radius-lg)", width: "700px", maxWidth: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" },
  modalHeader: { background: "var(--bg-2)", color: "var(--text-1)", padding: "16px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "3px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", flexShrink: 0 },
  closeIcon: { background: "none", border: "none", color: "var(--text-5)", cursor: "pointer", fontSize: "16px" },
  modalBody: { padding: "20px", display: "flex", flexDirection: "column", gap: "6px", background: "#05080f", overflowY: "scroll", flex: "1 1 auto", fontFamily: "var(--font-mono)" },
  /* ------------------------------------------------------ */
  
  logHeader: { color: "var(--blue)", fontSize: "13px", fontWeight: 700, marginTop: "10px", paddingBottom: "4px", borderBottom: "1px solid rgba(56,189,248,0.2)" },
  logInfo: { color: "var(--text-4)", fontSize: "12px" },
  logSuccess: { color: "var(--green)", fontSize: "12px" },
  logError: { color: "var(--red)", fontSize: "12px" },
  logSummary: { color: "var(--amber)", fontSize: "12px", fontWeight: 700, background: "rgba(245,158,11,0.1)", padding: "8px", borderRadius: "4px", marginTop: "4px" },
  
  modalCloseBtn: { padding: "16px", background: "var(--green)", color: "#000", border: "none", fontSize: "12px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", flexShrink: 0 },
  chaosBtn: { background: "var(--red)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "14px", fontSize: "11px", fontWeight: 700, letterSpacing: "2.5px", cursor: "pointer", fontFamily: "var(--font-mono)", width: "100%", marginTop: "15px", boxShadow: "0 0 15px rgba(244,63,94,0.4)" },

  ticket: { background: "var(--bg-card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", overflow: "hidden" },
  ticketHeader: { padding: "14px 18px", borderBottom: "1px solid var(--border-dim)", background: "var(--bg-2)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  ticketTitle: { fontSize: "10px", color: "var(--amber)", letterSpacing: "4px", fontWeight: 700 },
  ticketSub: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "2px", marginTop: "2px" },
  engineTag: { fontSize: "8px", color: "var(--blue)", letterSpacing: "2px", background: "var(--blue-dim)", border: "1px solid rgba(56,189,248,0.2)", padding: "3px 8px", borderRadius: "var(--radius-sm)", fontWeight: 600 },
  sideToggle: { display: "flex", margin: "14px 18px 0" },
  toggleBuy: { flex: 1, background: "var(--green-dim)", border: "1px solid var(--green)", color: "var(--green)", padding: "10px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)" },
  toggleSell: { flex: 1, background: "var(--red-dim)", border: "1px solid var(--red)", color: "var(--red)", padding: "10px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0" },
  toggleOff: { flex: 1, background: "none", border: "1px solid var(--border-dim)", color: "var(--text-5)", padding: "10px", fontSize: "11px", letterSpacing: "3px", cursor: "pointer", fontFamily: "var(--font-mono)" },
  sideBorder: isBuy => ({ height: "2px", background: isBuy ? "var(--green)" : "var(--red)", margin: "0 18px", borderRadius: "1px", opacity: 0.5, transition: "background 0.2s" }),
  form: { padding: "14px 18px", display: "flex", flexDirection: "column", gap: "12px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "3px" },
  input: { background: "var(--bg-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", padding: "9px 12px", fontSize: "12px", fontFamily: "var(--font-mono)", width: "100%", transition: "border-color 0.15s" },
  notionalBox: { background: "var(--bg-2)", border: "1px solid var(--border-dim)", borderRadius: "var(--radius-sm)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "5px" },
  notionalRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  notionalLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2px" },
  notionalVal: { fontSize: "14px", color: "var(--text-0)", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  notionalFee: { fontSize: "10px", color: "var(--text-4)", fontVariantNumeric: "tabular-nums" },
  notionalBar: { height: "2px", background: "var(--border-dim)", borderRadius: "1px", overflow: "hidden", marginTop: "3px" },
  notionalFill: { height: "100%", width: "100%", borderRadius: "1px" },
  errorBox: { background: "var(--red-dim)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--red)", fontSize: "11px", display: "flex", gap: "6px", alignItems: "center" },
  btnBuy: { background: "var(--green)", color: "#05080f", border: "none", borderRadius: "var(--radius-sm)", padding: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "2.5px", cursor: "pointer", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },
  btnSell: { background: "var(--red)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "12px", fontSize: "10px", fontWeight: 700, letterSpacing: "2.5px", cursor: "pointer", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },
  btnOff: { background: "var(--bg-2)", color: "var(--text-5)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px", fontSize: "10px", letterSpacing: "2.5px", cursor: "not-allowed", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },
  spinner: { width: "10px", height: "10px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "var(--text-4)", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" },
  confirm: { background: "var(--bg-card)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "var(--radius-lg)", overflow: "hidden", animation: "slide-up 0.2s ease both" },
  confirmHeader: { padding: "14px 18px", borderBottom: "1px solid rgba(16,185,129,0.1)", background: "rgba(16,185,129,0.05)", display: "flex", gap: "10px", alignItems: "center" },
  confirmCheck: { fontSize: "18px", color: "var(--green)" },
  confirmTitle: { fontSize: "10px", color: "var(--green)", letterSpacing: "4px", fontWeight: 700 },
  confirmSub: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "2px", marginTop: "2px" },
  confirmGrid: { padding: "12px 18px", display: "flex", flexDirection: "column", gap: "7px" },
  confirmRow: { display: "flex", justifyContent: "space-between", paddingBottom: "6px", borderBottom: "1px solid var(--border-dim)" },
  confirmKey: { fontSize: "8px", color: "var(--text-4)", letterSpacing: "2px" },
  confirmVal: { fontSize: "11px", color: "var(--text-0)", fontWeight: 600 },
  newOrderBtn: { margin: "0 18px 18px", width: "calc(100% - 36px)", background: "none", border: "1px solid var(--border-soft)", color: "var(--text-3)", padding: "8px", fontSize: "9px", letterSpacing: "2px", cursor: "pointer", fontFamily: "var(--font-mono)", borderRadius: "var(--radius-sm)" },
  guide: { background: "var(--bg-card)", border: "1px solid var(--border-dim)", borderRadius: "var(--radius-lg)", padding: "16px 18px" },
  guideTitle: { fontSize: "8px", color: "var(--text-5)", letterSpacing: "4px", marginBottom: "12px" },
  guideRow: { marginBottom: "11px", paddingBottom: "11px", borderBottom: "1px solid var(--border-dim)" },
  guideKey: { fontSize: "9px", color: "var(--amber)", letterSpacing: "2px", fontWeight: 600, marginBottom: "3px" },
  guideVal: { fontSize: "9px", color: "var(--text-4)", lineHeight: 1.6 },
};