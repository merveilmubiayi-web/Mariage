import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabase.js";

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState("loading"); // loading | allowed | login | denied

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState("login");
      const { data } = await supabase.from("admins").select("event_id").limit(1).maybeSingle();
      setState(data ? "allowed" : "denied");
    })();
  }, []);

  if (state === "loading") return <main className="page"><p className="status">Chargement…</p></main>;
  if (state === "login") return <Navigate to="/admin/login" replace />;
  if (state === "denied") {
    return (
      <main className="page">
        <p className="status">
          Ce compte n’a pas accès à l’administration.{" "}
          <button type="button" className="link-light"
            onClick={() => supabase.auth.signOut().then(() => setState("login"))}>
            Se déconnecter
          </button>
        </p>
      </main>
    );
  }
  return children;
}
