import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, EVENT_ID } from "../services/supabase.js";
import { formatDateTime } from "../utils/formatDate.js";
import InvitationCard from "../components/InvitationCard.jsx";
import { DEFAULT_LAYOUT } from "../utils/composeInvitation.js";

const LABELS = { valid: "Disponible", used: "Utilisée", revoked: "Désactivée" };
const FIELDS = [
  ["groom_name", "Marié", "text"],
  ["bride_name", "Mariée", "text"],
  ["event_date", "Date et heure", "datetime-local"],
  ["location", "Lieu", "text"],
  ["max_invitations", "Nombre maximal d’invitations", "number"],
  ["access_code", "Code d’accès du lien invités (vide = aucun)", "text"],
  ["scanner_code", "Code agent (scan à l’entrée)", "text"],
];

const toLocalInput = (iso) => {
  const d = new Date(iso);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function EventForm({ event, onSaved }) {
  const [f, setF] = useState({
    groom_name: event.groom_name, bride_name: event.bride_name, location: event.location,
    event_date: toLocalInput(event.event_date), max_invitations: event.max_invitations,
    access_code: event.access_code ?? "", scanner_code: event.scanner_code,
  });
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.from("events").update({
      ...f,
      event_date: new Date(f.event_date).toISOString(),
      max_invitations: Number(f.max_invitations),
      access_code: f.access_code.trim() || null,
    }).eq("id", event.id);
    setMsg(error ? "Enregistrement impossible : codes de 6 (invités) et 8 (agents) caractères minimum." : "Enregistré.");
    if (!error) onSaved();
  }

  return (
    <form onSubmit={save}>
      <div className="fields">
        {FIELDS.map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input type={type} value={f[key]} required={key !== "access_code"}
              onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <p><button type="submit">Enregistrer</button> <span role="status">{msg}</span></p>
    </form>
  );
}

function ImageEditor({ event, onSaved }) {
  const [image, setImage] = useState(event.invitation_image);
  const [layout, setLayout] = useState({ ...DEFAULT_LAYOUT, ...event.invitation_layout });
  const [msg, setMsg] = useState("");
  const preview = useMemo(
    () => ({ ...event, invitation_image: image, invitation_layout: layout }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, layout, event.groom_name, event.bride_name, event.event_date, event.location]
  );

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${event.id}/${Date.now()}.${ext}`;
    const bucket = supabase.storage.from("invitation-images");
    const { error } = await bucket.upload(path, file, { contentType: file.type });
    if (error) return setMsg("Envoi impossible (PNG, JPEG ou WebP, 5 Mo maximum).");
    setImage(bucket.getPublicUrl(path).data.publicUrl);
    setMsg("");
  }

  async function save() {
    const { error } = await supabase.from("events")
      .update({ invitation_image: image, invitation_layout: layout }).eq("id", event.id);
    setMsg(error ? "Enregistrement impossible." : "Enregistré.");
    if (!error) onSaved();
  }

  const slider = (key, label, min, max) => (
    <label>
      {label} : {Math.round(layout[key] * 100)} %
      <input type="range" min={min} max={max} value={Math.round(layout[key] * 100)}
        onChange={(e) => setLayout({ ...layout, [key]: e.target.value / 100 })} />
    </label>
  );

  return (
    <div className="image-editor">
      <div className="fields">
        <label>Image d’invitation (PNG, JPEG ou WebP, 5 Mo max)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
        </label>
        {slider("nameY", "Position du nom", 0, 100)}
        {slider("qrY", "Position du QR code", 0, 100)}
        {slider("qrSize", "Taille du QR code", 10, 60)}
        <label>Couleur du nom
          <input type="color" value={layout.textColor}
            onChange={(e) => setLayout({ ...layout, textColor: e.target.value })} />
        </label>
      </div>
      <p>
        <button type="button" onClick={save}>Enregistrer</button>{" "}
        {image && <button type="button" onClick={() => setImage(null)}>Retirer l’image</button>}{" "}
        <span role="status">{msg}</span>
      </p>
      <p>Aperçu avec un nom d’exemple (sans image, le visuel par défaut est utilisé) :</p>
      <div className="preview">
        <InvitationCard event={preview} guestName="Couple Exemple" token="apercu-apercu-apercu" bare />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [e, s, r] = await Promise.all([
      supabase.from("events").select("*").eq("id", EVENT_ID).maybeSingle(),
      supabase.from("invitation_stats").select("*").eq("event_id", EVENT_ID).maybeSingle(),
      supabase.from("invitations").select("id, guest_name, status, created_at, used_at")
        .eq("event_id", EVENT_ID).order("created_at", { ascending: false }),
    ]);
    if (e.error || r.error || !e.data) return setError("Chargement impossible. Actualisez la page.");
    setError("");
    setEvent(e.data);
    setStats(s.data);
    setRows(r.data);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function setStatus(row, status) {
    if (status === "revoked" && !window.confirm(`Désactiver l’invitation de ${row.guest_name} ?`)) return;
    const { error: err } = await supabase.from("invitations")
      .update({ status, used_at: status === "valid" ? null : undefined }).eq("id", row.id);
    if (err) return setError("Action impossible.");
    load();
  }

  const shown = useMemo(() => rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    r.guest_name.toLowerCase().includes(query.trim().toLowerCase())), [rows, filter, query]);

  if (!event) return <main className="page"><p className="status">{error || "Chargement…"}</p></main>;

  const guestLink = `${window.location.origin}/invitation${event.access_code ? `?code=${event.access_code}` : ""}`;
  const cards = [["Générées", stats?.total], ["Disponibles", stats?.available],
                 ["Utilisées", stats?.used], ["Désactivées", stats?.revoked]];

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-head">
          <h1>{event.groom_name} &amp; {event.bride_name}</h1>
          <button type="button" onClick={() => supabase.auth.signOut().then(() => navigate("/admin/login"))}>
            Déconnexion
          </button>
        </header>
        {error && <p className="error" role="alert">{error}</p>}

        <section aria-label="Statistiques" className="stats">
          {cards.map(([label, n]) => (
            <div className="stat" key={label}><strong>{n ?? 0}</strong>{label}</div>
          ))}
        </section>

        <section>
          <h2>Liens</h2>
          <label>Lien à envoyer aux invités
            <input readOnly value={guestLink} onFocus={(e) => e.target.select()} />
          </label>
          <p>Page des agents : <code>{window.location.origin}/scan</code></p>
        </section>

        <section>
          <h2>Invitations</h2>
          <div className="toolbar">
            <input type="search" placeholder="Rechercher un nom" aria-label="Rechercher un nom"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <select aria-label="Filtrer par statut" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Toutes</option>
              <option value="valid">Disponibles</option>
              <option value="used">Utilisées</option>
              <option value="revoked">Désactivées</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Statut</th><th>Générée</th><th>Entrée</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>{r.guest_name}</td>
                    <td><span className={`badge ${r.status}`}>{LABELS[r.status]}</span></td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.used_at ? formatDateTime(r.used_at) : "—"}</td>
                    <td>
                      {r.status === "revoked"
                        ? <button type="button" onClick={() => setStatus(r, "valid")}>Réactiver</button>
                        : <button type="button" onClick={() => setStatus(r, "revoked")}>Désactiver</button>}
                    </td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan="5">Aucune invitation.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Informations du mariage</h2>
          <EventForm event={event} onSaved={load} />
        </section>

        <section>
          <h2>Image d’invitation</h2>
          <ImageEditor event={event} onSaved={load} />
        </section>
      </div>
    </main>
  );
}
