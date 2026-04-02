import { useState } from "react";
import { authApi } from "../api";

export default function Register({ onSwitch, onLogin }) {
  const [form, setForm]       = useState({ name: "", email: "", phone: "", password: "", role: "Retail" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await authApi.post("/auth/register", form);
      const res = await authApi.post("/auth/login", { email: form.email, password: form.password });
      onLogin(res.data.access_token, { email: form.email, name: form.name });
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.root}>
      <div style={s.gridLines} />

      <div style={s.topBar}>
        <div style={s.logo}>◈ CHRONOS</div>
        <span style={s.topMuted}>NEW ACCOUNT REGISTRATION</span>
      </div>

      <div style={s.center}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>CREATE ACCOUNT</div>
            <div style={s.cardSub}>Join the exchange — takes 30 seconds</div>
          </div>

          <form onSubmit={submit} style={s.form}>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>FULL NAME</label>
                <input style={s.input} placeholder="John Doe" value={form.name} onChange={f("name")} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>PHONE (OPTIONAL)</label>
                <input style={s.input} placeholder="+91 98765 43210" value={form.phone} onChange={f("phone")} />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>EMAIL ADDRESS</label>
              <input style={s.input} type="email" placeholder="trader@chronos.com" value={form.email} onChange={f("email")} required />
            </div>

            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>PASSWORD</label>
                <input style={s.input} type="password" placeholder="Min. 8 characters" value={form.password} onChange={f("password")} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>ACCOUNT TYPE</label>
                <select style={s.input} value={form.role} onChange={f("role")}>
                  <option value="Retail">Retail Trader</option>
                  <option value="MarketMaker">Market Maker</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={s.errorBox}>
                <span>✗</span> {error}
              </div>
            )}

            <button style={loading ? s.btnOff : s.btn} disabled={loading}>
              {loading
                ? <><span style={s.spinner} /> CREATING ACCOUNT...</>
                : "CREATE ACCOUNT →"}
            </button>
          </form>

          <div style={s.footer}>
            Already a member?&nbsp;
            <span style={s.link} onClick={onSwitch}>Sign in instead</span>
          </div>
        </div>

        <div style={s.sideNote}>
          <div style={s.noteTitle}>WHAT YOU GET</div>
          {[
            ["Real-time orderbook", "WebSocket feed, sub-100ms latency"],
            ["Price-time matching", "C++ engine, zero compromise"],
            ["Portfolio tracking",  "Holdings, P&L, trade history"],
            ["Global market map",   "Geographic view of all instruments"],
          ].map(([title, desc]) => (
            <div key={title} style={s.noteItem}>
              <span style={s.noteDot}>◆</span>
              <div>
                <div style={s.noteItemTitle}>{title}</div>
                <div style={s.noteItemDesc}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
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
    fontFamily: "var(--font-mono)",
    position: "relative",
    overflow: "hidden",
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
  topBar: {
    height: "48px",
    background: "var(--bg-1)",
    borderBottom: "1px solid var(--border-dim)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    flexShrink: 0,
    zIndex: 2,
  },
  logo: { fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, color: "var(--amber)", letterSpacing: "4px" },
  topMuted: { fontSize: "9px", color: "var(--text-4)", letterSpacing: "3px" },

  center: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "40px",
    padding: "40px 32px",
    zIndex: 2,
  },

  card: {
    width: "520px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
  },
  cardHeader: {
    padding: "22px 28px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
  },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 800,
    color: "var(--text-0)",
    letterSpacing: "5px",
  },
  cardSub: { fontSize: "9px", color: "var(--text-4)", letterSpacing: "2px", marginTop: "3px" },

  form: { padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "8px", color: "var(--text-3)", letterSpacing: "3px" },
  input: {
    background: "var(--bg-1)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-0)",
    padding: "10px 13px",
    fontSize: "12px",
    width: "100%",
    transition: "border-color 0.15s",
  },
  errorBox: {
    background: "var(--red-dim)",
    border: "1px solid rgba(244,63,94,0.25)",
    borderRadius: "var(--radius-sm)",
    padding: "9px 13px",
    color: "var(--red)",
    fontSize: "11px",
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  btn: {
    marginTop: "4px",
    background: "var(--amber)",
    color: "#05080f",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px 20px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "3px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
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
    padding: "12px 20px",
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
    borderTopColor: "var(--text-4)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },
  footer: {
    padding: "14px 28px",
    borderTop: "1px solid var(--border-dim)",
    background: "var(--bg-2)",
    fontSize: "11px",
    color: "var(--text-4)",
  },
  link: { color: "var(--amber)", cursor: "pointer", textDecoration: "underline" },

  sideNote: {
    width: "240px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  noteTitle: {
    fontSize: "8px",
    color: "var(--amber)",
    letterSpacing: "4px",
    fontWeight: 700,
    marginBottom: "16px",
  },
  noteItem: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    padding: "10px 0",
    borderBottom: "1px solid var(--border-dim)",
  },
  noteDot: { fontSize: "6px", color: "var(--amber)", marginTop: "4px", flexShrink: 0 },
  noteItemTitle: { fontSize: "10px", color: "var(--text-1)", fontWeight: 600, letterSpacing: "0.5px" },
  noteItemDesc: { fontSize: "9px", color: "var(--text-4)", letterSpacing: "0.5px", marginTop: "2px", lineHeight: 1.5 },
};