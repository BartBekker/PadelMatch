import { useState, useEffect } from "react";

const SUPABASE_URL = "https://gzrcfmqvtvyomxsfccas.supabase.co";
const SUPABASE_KEY = "sb_publishable_DMRCDtG0oRnuSfA8CNoG7A_XE7irmWo";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEVELS = ["Beginner", "Gevorderd beginner", "Intermediate", "Gevorderd", "Expert"];
const REGIONS = ["Breda", "Tilburg", "Rotterdam", "Amsterdam", "Utrecht", "Eindhoven"];

const levelColor = (level) => ({
  "Beginner": "#22c55e", "Gevorderd beginner": "#84cc16",
  "Intermediate": "#eab308", "Gevorderd": "#f97316", "Expert": "#ef4444"
}[level] || "#6b7280");

const formatDate = (d) => new Date(d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
export default function App() {
  const [screen, setScreen] = useState("home");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [participants, setParticipants] = useState({});
  const [filterRegion, setFilterRegion] = useState("Breda");
  const [filterLevel, setFilterLevel] = useState("Alle niveaus");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "", region: "Breda", level: "Intermediate" });
  const [newSession, setNewSession] = useState({ region: "Breda", level: "Intermediate", date: "", time: "", location: "", spots: "4" });
  const [authLoading, setAuthLoading] = useState(false);

  const showToast = (msg, error = false) => { setToast({ msg, error }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { fetchSessions(); }, []);

  const fetchProfile = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) setProfile(data);
  };

  const fetchSessions = async () => {
    const { data } = await supabase.from("sessions").select("*").order("date", { ascending: true });
    if (data) { setSessions(data); fetchAllParticipants(data.map(s => s.id)); }
  };

  const fetchAllParticipants = async (ids) => {
    if (!ids.length) return;
    const { data } = await supabase.from("participants").select("*").in("session_id", ids);
    if (data) {
      const map = {};
      data.forEach(p => { if (!map[p.session_id]) map[p.session_id] = []; map[p.session_id].push(p); });
      setParticipants(map);
    }
  };

  const handleRegister = async () => {
    if (!authForm.name || !authForm.email || !authForm.password) return showToast("Vul alle velden in", true);
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
    if (error) { showToast(error.message, true); setAuthLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, name: authForm.name, region: authForm.region, level: authForm.level });
      await fetchProfile(data.user.id);
      showToast("Welkom bij PadelMatch! 🎾");
      setScreen("home");
    }
    setAuthLoading(false);
  };

  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) return showToast("Vul alle velden in", true);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
    if (error) { showToast("Onjuist e-mail of wachtwoord", true); setAuthLoading(false); return; }
    showToast("Welkom terug! 🎾"); setScreen("home"); setAuthLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setProfile(null); setScreen("home"); showToast("Tot de volgende keer!"); };

  const handleJoin = async (sessionId) => {
    if (!user) return showToast("Log in om mee te doen", true);
    const { error } = await supabase.from("participants").insert({ session_id: sessionId, user_id: user.id, name: profile?.name || "Speler" });
    if (error) { showToast("Aanmelden mislukt", true); return; }
    await fetchAllParticipants(sessions.map(s => s.id));
    showToast("Je bent aangemeld! 🎾");
  };

  const handleLeave = async (sessionId) => {
    await supabase.from("participants").delete().eq("session_id", sessionId).eq("user_id", user.id);
    await fetchAllParticipants(sessions.map(s => s.id));
    showToast("Je bent afgemeld");
  };

  const handleCreate = async () => {
    if (!user) return showToast("Log in om een sessie aan te maken", true);
    if (!newSession.date || !newSession.time || !newSession.location) return showToast("Vul alle velden in", true);
    const { error } = await supabase.from("sessions").insert({ creator_id: user.id, creator_name: profile?.name || "Speler", ...newSession, spots: parseInt(newSession.spots) });
    if (error) { showToast("Aanmaken mislukt", true); return; }
    await fetchSessions();
    setNewSession({ region: "Breda", level: "Intermediate", date: "", time: "", location: "", spots: "4" });
    setScreen("sessions"); showToast("Sessie aangemaakt! 🎾");
  };

  const filtered = sessions.filter(s => (filterRegion === "Alle regio's" || s.region === filterRegion) && (filterLevel === "Alle niveaus" || s.level === filterLevel));
  const mySessions = sessions.filter(s => (participants[s.id] || []).some(p => p.user_id === user?.id));

  if (loading) return <div style={{ background: "#0f172a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>🎾 Laden...</div>;

  const inp = { width: "100%", background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", fontSize: 15, boxSizing: "border-box", colorScheme: "dark" };
  const btn = (bg = "#2563eb") => ({ width: "100%", background: bg, color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 16, cursor: "pointer", marginTop: 8 });
  const lbl = { fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block" };
  const navItems = [{ id: "home", icon: "⚡", label: "Home" }, { id: "sessions", icon: "🎾", label: "Sessies" }, { id: "create", icon: "＋", label: "Aanmaken" }, { id: "profile", icon: "👤", label: "Profiel" }];
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f172a", minHeight: "100vh", color: "#f1f5f9", maxWidth: 430, margin: "0 auto", paddingBottom: 80 }}>
      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.error ? "#ef4444" : "#22c55e", color: "#fff", borderRadius: 12, padding: "10px 20px", fontWeight: 600, fontSize: 14, zIndex: 999 }}>{toast.msg}</div>}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)", padding: "50px 20px 20px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🎾</span>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>PadelMatch</div><div style={{ fontSize: 12, color: "#64748b" }}>Vind je spelpartners</div></div>
          </div>
          {!user ? <button onClick={() => setScreen("auth")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Inloggen</button> : <div style={{ fontSize: 13, color: "#94a3b8" }}>👋 {profile?.name}</div>}
        </div>
      </div>
      <div style={{ padding: "20px 16px" }}>
        {screen === "auth" && <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{authMode === "login" ? "Inloggen" : "Account aanmaken"}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>{authMode === "login" ? "Welkom terug!" : "Gratis account aanmaken"}</div>
          {authMode === "register" && <><label style={lbl}>Naam</label><input style={{ ...inp, marginBottom: 16 }} placeholder="Jouw naam" value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} /><label style={lbl}>Regio</label><select style={{ ...inp, marginBottom: 16 }} value={authForm.region} onChange={e => setAuthForm(p => ({ ...p, region: e.target.value }))}>{REGIONS.map(r => <option key={r}>{r}</option>)}</select><label style={lbl}>Niveau</label><select style={{ ...inp, marginBottom: 16 }} value={authForm.level} onChange={e => setAuthForm(p => ({ ...p, level: e.target.value }))}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></>}
          <label style={lbl}>E-mail</label><input style={{ ...inp, marginBottom: 16 }} type="email" placeholder="jouw@email.nl" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
          <label style={lbl}>Wachtwoord</label><input style={{ ...inp, marginBottom: 8 }} type="password" placeholder="Minimaal 6 tekens" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
          <button onClick={authMode === "login" ? handleLogin : handleRegister} disabled={authLoading} style={btn()}>{authLoading ? "Even geduld..." : authMode === "login" ? "Inloggen" : "Account aanmaken"}</button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#64748b" }}>{authMode === "login" ? "Nog geen account? " : "Al een account? "}<span onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} style={{ color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>{authMode === "login" ? "Aanmelden" : "Inloggen"}</span></div>
        </div>}
        {screen === "home" && <div>
          <div style={{ background: "linear-gradient(135deg, #1e3a5f, #164e63)", borderRadius: 20, padding: 24, marginBottom: 20, border: "1px solid #1e40af" }}>
            <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 600, marginBottom: 4 }}>{user ? `Welkom terug, ${profile?.name} 👋` : "Welkom bij PadelMatch 👋"}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Klaar voor een potje?</div>
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}><strong style={{ color: "#38bdf8" }}>{sessions.length} sessies</strong> beschikbaar</div>
            <button onClick={() => setScreen("sessions")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Bekijk sessies →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[{ icon: "🔍", title: "Zoek sessie", sub: "Filter op niveau & regio", action: () => setScreen("sessions") }, { icon: "➕", title: "Maak sessie", sub: "Nodig anderen uit", action: () => setScreen("create") }].map((item, i) => (
              <div key={i} onClick={item.action} style={{ background: "#1e293b", borderRadius: 16, padding: 18, cursor: "pointer", border: "1px solid #334155" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
          {sessions.slice(0, 3).map(s => <SessionCard key={s.id} s={s} participants={participants[s.id] || []} userId={user?.id} onJoin={handleJoin} onLeave={handleLeave} compact />)}
        </div>}
        {screen === "sessions" && <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Sessies zoeken</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ ...inp, flex: 1 }}><option>Alle regio's</option>{REGIONS.map(r => <option key={r}>{r}</option>)}</select>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...inp, flex: 1 }}><option>Alle niveaus</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>{filtered.length} sessie{filtered.length !== 1 ? "s" : ""} gevonden</div>
          {filtered.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}><div style={{ fontSize: 40, marginBottom: 12 }}>😔</div><div style={{ fontWeight: 600 }}>Geen sessies gevonden</div><button onClick={() => setScreen("create")} style={{ ...btn(), width: "auto", padding: "10px 20px" }}>Sessie aanmaken</button></div> : filtered.map(s => <SessionCard key={s.id} s={s} participants={participants[s.id] || []} userId={user?.id} onJoin={handleJoin} onLeave={handleLeave} />)}
        </div>}
        {screen === "create" && <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Sessie aanmaken</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Nodig medespelers uit</div>
          {!user ? <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div><div style={{ fontWeight: 600, marginBottom: 8 }}>Log in om een sessie aan te maken</div><button onClick={() => setScreen("auth")} style={{ ...btn(), width: "auto", padding: "12px 24px" }}>Inloggen</button></div> :
          <>{[{ label: "Regio", type: "select", key: "region", options: REGIONS }, { label: "Speelsterkte", type: "select", key: "level", options: LEVELS }, { label: "Datum", type: "date", key: "date" }, { label: "Tijd", type: "time", key: "time" }, { label: "Locatie", type: "text", key: "location", placeholder: "bijv. Padelclub Breda Noord" }, { label: "Aantal plekken", type: "select", key: "spots", options: ["2", "3", "4"] }].map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}><label style={lbl}>{field.label}</label>{field.type === "select" ? <select value={newSession[field.key]} onChange={e => setNewSession(p => ({ ...p, [field.key]: e.target.value }))} style={inp}>{field.options.map(o => <option key={o}>{o}</option>)}</select> : <input type={field.type} value={newSession[field.key]} placeholder={field.placeholder || ""} onChange={e => setNewSession(p => ({ ...p, [field.key]: e.target.value }))} style={inp} />}</div>
          ))}<button onClick={handleCreate} style={btn()}>Sessie aanmaken 🎾</button></>}
        </div>}
        {screen === "profile" && <div>
          {!user ? <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 50, marginBottom: 16 }}>👤</div><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nog niet ingelogd</div><button onClick={() => setScreen("auth")} style={{ ...btn(), width: "auto", padding: "12px 24px" }}>Inloggen</button></div> :
          <><div style={{ textAlign: "center", paddingTop: 20, marginBottom: 28 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 12px" }}>{profile?.name?.[0] || "?"}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{profile?.name}</div><div style={{ fontSize: 13, color: "#64748b" }}>{profile?.region} · {profile?.level}</div>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #334155" }}>
            {[{ label: "Sessies deelgenomen", value: mySessions.length }, { label: "Regio", value: profile?.region }, { label: "Niveau", value: profile?.level }].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? "1px solid #334155" : "none" }}><span style={{ color: "#94a3b8", fontSize: 14 }}>{item.label}</span><span style={{ fontWeight: 700, fontSize: 14 }}>{item.value}</span></div>
            ))}
          </div>
          <div style={{ background: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #334155" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Mijn sessies</div>
            {mySessions.length === 0 ? <div style={{ color: "#64748b", fontSize: 14 }}>Nog geen sessies.</div> : mySessions.map(s => <div key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid #334155" }}><div style={{ fontWeight: 600, fontSize: 14 }}>{s.location}</div><div style={{ fontSize: 12, color: "#64748b" }}>{formatDate(s.date)} · {s.time?.slice(0, 5)} · {s.region}</div></div>)}
          </div>
          <button onClick={handleLogout} style={btn("#ef4444")}>Uitloggen</button></>}
        </div>}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0f172a", borderTop: "1px solid #1e293b", display: "flex", padding: "10px 0 20px" }}>
        {navItems.map(item => <button key={item.id} onClick={() => setScreen(item.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: screen === item.id ? "#2563eb" : "#475569" }}><span style={{ fontSize: 20 }}>{item.icon}</span><span style={{ fontSize: 10, fontWeight: screen === item.id ? 700 : 500 }}>{item.label}</span></button>)}
      </div>
    </div>
  );
}

function SessionCard({ s, participants, userId, onJoin, onLeave, compact }) {
  const joined = participants.some(p => p.user_id === userId);
  const spotsLeft = s.spots - participants.length;
  const full = spotsLeft <= 0;
  return (
    <div style={{ background: "#1e293b", borderRadius: 16, padding: 18, marginBottom: 12, border: `1px solid ${joined ? "#1d4ed8" : "#334155"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div><div style={{ fontWeight: 700, fontSize: 15 }}>{s.location}</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{s.region} · {s.creator_name}</div></div>
        <span style={{ background: levelColor(s.level) + "22", color: levelColor(s.level), borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{s.level}</span>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>📅 {formatDate(s.date)}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>🕐 {s.time?.slice(0, 5)}</div>
      </div>
      {!compact && <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Spelers ({participants.length}/{s.spots})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: s.spots }).map((_, i) => <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: i < participants.length ? "linear-gradient(135deg, #2563eb, #7c3aed)" : "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{i < participants.length ? participants[i].name[0] : ""}</div>)}
        </div>
      </div>}
      <button onClick={() => joined ? onLeave(s.id) : onJoin(s.id)} disabled={full && !joined} style={{ width: "100%", border: "none", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: full && !joined ? "default" : "pointer", background: joined ? "#166534" : full ? "#374151" : "#2563eb", color: joined ? "#86efac" : full ? "#9ca3af" : "#fff" }}>
        {joined ? "✓ Aangemeld — tik om af te melden" : full ? "Sessie vol" : `Aanmelden (${spotsLeft} plek${spotsLeft !== 1 ? "ken" : ""} vrij)`}
      </button>
    </div>
  );
}
