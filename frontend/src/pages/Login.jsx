import { useState, useEffect } from "react";
import { authApi } from "../api";

export default function Login({ onLogin, onSwitch }) {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime]       = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await authApi.post("/auth/login", form);
      onLogin(res.data.access_token, { email: form.email });
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally { setLoading(false); }
  };

  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;

  return (
    <div style={s.root}>
      <div style={s.gridLines} />
      <div style={s.scanBar} />

      <div style={s.topBar}>
        <div style={s.topLeft}>
          <span style={s.liveDot} />
          <span style={s.liveText}>MARKET OPEN</span>
          <span style={s.topSep} />
          <span style={s.topMuted}>NSE · BSE · NYSE · NASDAQ</span>
        </div>
        <div style={s.topClock}>{timeStr}</div>
      </div>

      <div style={s.center}>
        <div style={s.left}>
          <div style={s.logoRow}>
            <div style={s.logoGlyph}>◈</div>
            <div>
              <div style={s.logoWordmark}>CHRONOS</div>
              <div style={s.logoSub}>EXCHANGE TERMINAL v1.0</div>
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.statGrid}>
            {[
              { label: "INSTRUMENTS", val: "11" },
              { label: "ENGINE",      val: "C++" },
              { label: "LATENCY",     val: "<1ms" },
              { label: "PROTOCOL",    val: "WS + REST" },
            ].map(({ label, val }) => (
              <div key={label} style={s.stat}>
                <div style={s.statLabel}>{label}</div>
                <div style={s.statVal}>{val}</div>
              </div>
            ))}
          </div>

          <div style={s.divider} />

          <div style={s.featureList}>
            {[
              "Price-time priority matching",
              "Real-time WebSocket orderbook",
              "Self-trade prevention",
              "Multi-level sweep fills",
              "Wallet & holdings tracking",
            ].map(f => (
              <div key={f} style={s.featureRow}>
                <span style={s.featureDot}>◆</span>
                <span style={s.featureText}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.formCard}>
          <div style={s.formHeader}>
            <div style={s.formTitle}>SIGN IN</div>
            <div style={s.formSub}>Access your trading terminal</div>
          </div>

          <form onSubmit={submit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>EMAIL ADDRESS</label>
              <input
                style={s.input}
                type="email"
                placeholder="trader@chronos.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>PASSWORD</label>
              <input
                style={s.input}
                type="password"
                placeholder="••••••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            {error && (
              <div style={s.errorBox}>
                <span style={s.errorIcon}>✗</span>
                {error}
              </div>
            )}

            <button style={loading ? s.btnOff : s.btn} disabled={loading}>
              {loading
                ? <><span style={s.spinner} /> AUTHENTICATING...</>
                : "ACCESS TERMINAL →"}
            </button>
          </form>

          <div style={s.formFooter}>
            New to Chronos?&nbsp;
            <span style={s.link} onClick={onSwitch}>Create account</span>
          </div>
        </div>
      </div>

      <div style={s.bottomBar}>
        <span style={s.bottomLeft}>CHRONOS EXCHANGE SYSTEM © 2025 — DBMS PROJECT</span>
        <span style={s.bottomRight}>
          <span style={{ color: "var(--green)" }}>●</span>&nbsp;ALL SYSTEMS OPERATIONAL
        </span>
      </div>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "var(--bg-0)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    fontFamily: "var(--font-mono)",
  },
  gridLines: {
    position: "fixed",
    inset: 0,
    backgroundImage: [
      "linear-gradient(rgba(240,180,41,0.03) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(240,180,41,0.03) 1px, transparent 1px)",
    ].join(","),
    backgroundSize: "56px 56px",
    pointerEvents: "none",
  },
  scanBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "80px",
    background: "linear-gradient(180deg, transparent, rgba(240,180,41,0.03), transparent)",
    animation: "scan 10s linear infinite",
    pointerEvents: "none",
    zIndex: 1,
  },
  topBar: {
    height: "32px",
    background: "var(--bg-1)",
    borderBottom: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
    zIndex: 2,
  },
  topLeft: { display: "flex", alignItems: "center", gap: "8px" },
  liveDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    background: "var(--green)", display: "inline-block",
    animation: "pulse-dot 2s ease-in-out infinite",
  },
  liveText: { fontSize: "9px", color: "var(--green)", letterSpacing: "2px", fontWeight: 600 },
  topSep: { width: "1px", height: "10px", background: "var(--border-soft)" },
  topMuted: { fontSize: "9px", color: "var(--text-4)", letterSpacing: "1px" },
  topClock: { fontSize: "12px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums", letterSpacing: "2px" },

  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "80px",
    padding: "40px 60px",
    zIndex: 2,
  },

  left: { width: "320px", display: "flex", flexDirection: "column", gap: "0" },
  logoRow: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" },
  logoGlyph: {
    fontSize: "44px",
    color: "var(--amber)",
    lineHeight: 1,
    textShadow: "0 0 30px rgba(240,180,41,0.4)",
  },
  logoWordmark: {
    fontFamily: "var(--font-display)",
    fontSize: "38px",
    fontWeight: 900,
    color: "var(--text-0)",
    letterSpacing: "8px",
    lineHeight: 1,
  },
  logoSub: { fontSize: "8px", color: "var(--text-4)", letterSpacing: "3px", marginTop: "4px" },

  divider: {
    height: "1px",
    background: "linear-gradient(90deg, rgba(240,180,41,0.25), transparent)",
    margin: "20px 0",
  },

  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "0" },
  stat: {
    background: "var(--bg-2)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
  },
  statLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px", marginBottom: "4px" },
  statVal: { fontSize: "14px", color: "var(--amber)", fontWeight: 600, fontFamily: "var(--font-display)", letterSpacing: "1px" },

  featureList: { display: "flex", flexDirection: "column", gap: "7px" },
  featureRow: { display: "flex", alignItems: "center", gap: "8px" },
  featureDot: { fontSize: "6px", color: "var(--amber)", flexShrink: 0 },
  featureText: { fontSize: "10px", color: "var(--text-3)", letterSpacing: "0.5px" },

  formCard: {
    width: "400px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(240,180,41,0.05), 0 24px 60px rgba(0,0,0,0.5)",
  },
  formHeader: {
    padding: "24px 28px 20px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
  },
  formTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "26px",
    fontWeight: 800,
    color: "var(--text-0)",
    letterSpacing: "5px",
  },
  formSub: { fontSize: "9px", color: "var(--text-4)", letterSpacing: "2px", marginTop: "3px" },

  form: { padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "8px", color: "var(--text-3)", letterSpacing: "3px" },
  input: {
    background: "var(--bg-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-0)",
    padding: "11px 14px",
    fontSize: "12px",
    width: "100%",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },

  errorBox: {
    background: "var(--red-dim)",
    border: "1px solid rgba(244,63,94,0.25)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 14px",
    color: "var(--red)",
    fontSize: "11px",
    letterSpacing: "0.5px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  errorIcon: { fontWeight: 700 },

  btn: {
    marginTop: "4px",
    background: "var(--amber)",
    color: "#05080f",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "13px 20px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "3px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    transition: "opacity 0.15s, transform 0.1s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  btnOff: {
    marginTop: "4px",
    background: "var(--bg-2)",
    color: "var(--text-4)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-sm)",
    padding: "13px 20px",
    fontSize: "11px",
    letterSpacing: "3px",
    cursor: "not-allowed",
    fontFamily: "var(--font-mono)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  spinner: {
    width: "10px",
    height: "10px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "var(--text-3)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },

  formFooter: {
    padding: "16px 28px",
    borderTop: "1px solid var(--border-dim)",
    fontSize: "11px",
    color: "var(--text-4)",
    background: "var(--bg-2)",
  },
  link: { color: "var(--amber)", cursor: "pointer", textDecoration: "underline" },

  bottomBar: {
    height: "28px",
    background: "var(--bg-1)",
    borderTop: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
    zIndex: 2,
  },
  bottomLeft: { fontSize: "9px", color: "var(--text-5)", letterSpacing: "1px" },
  bottomRight: { fontSize: "9px", color: "var(--text-3)", letterSpacing: "1.5px" },
};