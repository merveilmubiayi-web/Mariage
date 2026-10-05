import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import InvitationCard from "../components/InvitationCard.jsx";
import { generateInvitation, getEvent } from "../services/invitationService.js";
import { formatDate } from "../utils/formatDate.js";

const STORAGE_KEY = "mariage-qr:invitation";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export default function GenerateInvitation() {
  const [params] = useSearchParams();
  const [event, setEvent] = useState(null);
  const [name, setName] = useState("");
  const [invitation, setInvitation] = useState(loadSaved);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getEvent().then(setEvent).catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const created = await generateInvitation(name, params.get("code"));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(created)); } catch {}
      setInvitation(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setInvitation(null);
    setName("");
  }

  if (!event) {
    return (
      <main className="page">
        <p className="status">{error || "Chargement…"}</p>
      </main>
    );
  }

  if (invitation) {
    return (
      <main className="page">
        <article className="pass view">
          <InvitationCard event={event} guestName={invitation.guestName} token={invitation.token} onReset={reset} />
        </article>
      </main>
    );
  }

  return (
    <main className="page">
      <article className="pass">
        <p className="invite">Vous êtes invités au mariage de</p>
        <h1>{event.groom_name} &amp; {event.bride_name}</h1>
        <p className="when">{formatDate(event.event_date)}</p>
        <p className="where">{event.location}</p>

        <div className="tear" aria-hidden="true" />

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Votre nom complet</label>
          <input
            id="name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex. : Couple Malumba" maxLength={80} required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Génération en cours…" : "Générer mon invitation"}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      </article>
    </main>
  );
}
