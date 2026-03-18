import { useState } from "react";
import Login    from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser]   = useState(null);
  const [page, setPage]   = useState("login");

  const handleLogin  = (tok, userData) => { setToken(tok); setUser(userData); setPage("dashboard"); };
  const handleLogout = () => { setToken(null); setUser(null); setPage("login"); };

  if (page === "register") return <Register onSwitch={() => setPage("login")} onLogin={handleLogin} />;
  if (!token)              return <Login onLogin={handleLogin} onSwitch={() => setPage("register")} />;
  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
}