import { useState } from "react";
import { authApi } from "../api";

export default function Register({ onSwitch, onLogin }) {
  const [form, setForm]     = useState({ name: "", email: "", phone: "", password: "", role: "Retail" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm({...form, [k]: e.target.value});

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
    <div style={s.bg}>
      <div style={s.grid} />
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.logo}>◈ CHRONOS</span>
          <div>
            <div style={s.title}>CREATE ACCOUNT</div>
            <div style={s.sub}>JOIN THE EXCHANGE</div>
          </div>
        </div>

        <form onSubmit={submit} style={s.form}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>FULL NAME</label>
              <input style={s.input} placeholder="John Doe" value={form.name} onChange={f("name")} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>PHONE</label>
              <input style={s.input} placeholder="+91 98765 43210" value={form.phone} onChange={f("phone")} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>EMAIL ADDRESS</label>
            <input style={s.input} type="email" placeholder="trader@example.com" value={form.email} onChange={f("email")} required />
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>PASSWORD</label>
              <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={f("password")} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>ROLE</label>
              <select style={s.input} value={form.role} onChange={f("role")}>
                <option value="Retail">Retail Trader</option>
                <option value="MarketMaker">Market Maker</option>
              </select>
            </div>
          </div>

          {error && <div style={s.error}>✗ {error}</div>}
          <button style={loading ? s.btnOff : s.btn} disabled={loading}>
            {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT →"}
          </button>
        </form>

        <div style={s.footer}>
          Already a member?{" "}
          <span style={s.link} onClick={onSwitch}>Sign in</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  bg: { minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", position: "relative" },
  grid: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(240,180,41,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(240,180,41,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  panel: { background: "#0c1018", border: "1px solid rgba(240,180,41,0.15)", borderRadius: "3px", padding: "36px 40px", width: "560px", zIndex: 1 },
  header: { display: "flex", alignItems: "center", gap: "20px", marginBottom: "28px", paddingBottom: "20px", borderBottom: "1px solid rgba(240,180,41,0.08)" },
  logo: { fontSize: "22px", color: "#f0b429", fontWeight: 700, letterSpacing: "4px", whiteSpace: "nowrap" },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: "#e2e8f0", letterSpacing: "4px" },
  sub: { fontSize: "9px", color: "#475569", letterSpacing: "3px", marginTop: "2px" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "9px", color: "#475569", letterSpacing: "3px" },
  input: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", color: "#e2e8f0", padding: "10px 12px", fontSize: "12px", width: "100%" },
  error: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "2px", padding: "10px 14px", color: "#ef4444", fontSize: "11px" },
  btn: { marginTop: "4px", background: "#f0b429", color: "#07090f", border: "none", borderRadius: "2px", padding: "13px", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" },
  btnOff: { marginTop: "4px", background: "#111827", color: "#334155", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "2px", padding: "13px", fontSize: "11px", letterSpacing: "3px", cursor: "not-allowed", fontFamily: "'IBM Plex Mono', monospace" },
  footer: { marginTop: "20px", fontSize: "11px", color: "#334155", textAlign: "center" },
  link: { color: "#f0b429", cursor: "pointer", textDecoration: "underline" },
};