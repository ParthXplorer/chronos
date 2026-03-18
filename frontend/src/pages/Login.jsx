import { useState } from "react";
import { authApi } from "../api";

export default function Login({ onLogin, onSwitch }) {
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await authApi.post("/auth/login", form);
      onLogin(res.data.access_token, { email: form.email });
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.bg}>
      {/* Noise texture overlay */}
      <div style={s.noise} />

      {/* Grid */}
      <div style={s.grid} />

      {/* Horizontal scan line */}
      <div style={s.scanline} />

      <div style={s.wrapper}>
        {/* Left — branding panel */}
        <div style={s.brandPanel}>
          <div style={s.brandInner}>
            <div style={s.logoMark}>◈</div>
            <div style={s.brandName}>CHRONOS</div>
            <div style={s.brandTagline}>EXCHANGE TERMINAL</div>
            <div style={s.divider} />
            <div style={s.stats}>
              {[
                ["INSTRUMENTS", "12"],
                ["MARKETS",     "LIVE"],
                ["LATENCY",     "&lt;1ms"],
              ].map(([k, v]) => (
                <div key={k} style={s.statRow}>
                  <span style={s.statKey}>{k}</span>
                  <span style={s.statVal} dangerouslySetInnerHTML={{ __html: v }} />
                </div>
              ))}
            </div>
            <div style={s.versionTag}>v1.0.0 — CHRONOS EXCHANGE</div>
          </div>
        </div>

        {/* Right — login form */}
        <div style={s.formPanel}>
          <div style={s.formInner}>
            <div style={s.formTitle}>
              <span style={s.formTitleAccent}>SIGN IN</span>
              <span style={s.formTitleSub}> / AUTHENTICATE</span>
            </div>

            <form onSubmit={submit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>EMAIL ADDRESS</label>
                <input
                  style={s.input}
                  type="email"
                  placeholder="trader@example.com"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>PASSWORD</label>
                <input
                  style={s.input}
                  type="password"
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
              </div>

              {error && (
                <div style={s.error}>
                  <span style={s.errorIcon}>✗</span> {error}
                </div>
              )}

              <button style={loading ? s.btnLoading : s.btn} disabled={loading}>
                {loading ? "AUTHENTICATING..." : "ACCESS TERMINAL →"}
              </button>
            </form>

            <div style={s.footer}>
              New trader?{" "}
              <span style={s.link} onClick={onSwitch}>Create account</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={s.statusBar}>
        <span style={s.statusDot}>●</span>
        <span style={s.statusText}>MARKET OPEN — NSE / BSE / NYSE</span>
        <span style={s.statusRight}>CHRONOS EXCHANGE SYSTEM © 2025</span>
      </div>
    </div>
  );
}

const s = {
  bg: { minHeight: "100vh", background: "#07090f", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", fontFamily: "'IBM Plex Mono', monospace" },
  noise: { position: "fixed", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")", opacity: 0.4, pointerEvents: "none", zIndex: 0 },
  grid: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(240,180,41,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(240,180,41,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  scanline: { position: "absolute", left: 0, right: 0, height: "1px", background: "rgba(240,180,41,0.06)", top: "50%", pointerEvents: "none" },
  wrapper: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, padding: "40px 20px" },
  brandPanel: { width: "320px", borderRight: "1px solid rgba(240,180,41,0.12)", padding: "0 48px 0 0", marginRight: "48px" },
  brandInner: { display: "flex", flexDirection: "column", gap: "0" },
  logoMark: { fontSize: "48px", color: "#f0b429", lineHeight: 1, marginBottom: "12px", textShadow: "0 0 40px rgba(240,180,41,0.4)" },
  brandName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "42px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "8px", lineHeight: 1 },
  brandTagline: { fontSize: "10px", color: "#475569", letterSpacing: "4px", marginTop: "6px", marginBottom: "28px" },
  divider: { height: "1px", background: "linear-gradient(90deg, rgba(240,180,41,0.3), transparent)", marginBottom: "24px" },
  stats: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  statKey: { fontSize: "10px", color: "#475569", letterSpacing: "2px" },
  statVal: { fontSize: "12px", color: "#f0b429", fontWeight: 600 },
  versionTag: { fontSize: "9px", color: "#1e293b", letterSpacing: "2px" },
  formPanel: { width: "380px" },
  formInner: {},
  formTitle: { marginBottom: "32px" },
  formTitleAccent: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: "#f0b429", letterSpacing: "4px" },
  formTitleSub: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 400, color: "#334155", letterSpacing: "2px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "9px", color: "#475569", letterSpacing: "3px" },
  input: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", color: "#e2e8f0", padding: "12px 14px", fontSize: "13px", transition: "border-color 0.15s", width: "100%" },
  error: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "2px", padding: "10px 14px", color: "#ef4444", fontSize: "11px", letterSpacing: "1px" },
  errorIcon: { marginRight: "6px" },
  btn: { marginTop: "8px", background: "#f0b429", color: "#07090f", border: "none", borderRadius: "2px", padding: "14px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", transition: "opacity 0.15s", fontFamily: "'IBM Plex Mono', monospace" },
  btnLoading: { marginTop: "8px", background: "#1e2a1a", color: "#475569", border: "1px solid rgba(240,180,41,0.1)", borderRadius: "2px", padding: "14px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "3px", cursor: "not-allowed", fontFamily: "'IBM Plex Mono', monospace" },
  footer: { marginTop: "24px", fontSize: "11px", color: "#334155", textAlign: "center" },
  link: { color: "#f0b429", cursor: "pointer", textDecoration: "underline" },
  statusBar: { height: "26px", background: "#08101a", borderTop: "1px solid rgba(240,180,41,0.08)", display: "flex", alignItems: "center", padding: "0 20px", gap: "8px", zIndex: 1 },
  statusDot: { color: "#10b981", fontSize: "8px", animation: "pulse-dot 2s infinite" },
  statusText: { fontSize: "10px", color: "#334155", letterSpacing: "2px", flex: 1 },
  statusRight: { fontSize: "9px", color: "#1e293b", letterSpacing: "1px" },
};