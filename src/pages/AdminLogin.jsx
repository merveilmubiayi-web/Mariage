import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase.js";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) return setError("E-mail ou mot de passe incorrect.");
    navigate("/admin", { replace: true });
  }

  return (
    <main className="page">
      <article className="pass">
        <h1>Espace des mariés</h1>
        <div className="tear" aria-hidden="true" />
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required />
          <label htmlFor="password">Mot de passe</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
          <button type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      </article>
    </main>
  );
}
