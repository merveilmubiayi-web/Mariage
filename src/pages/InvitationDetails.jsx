import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import InvitationCard from "../components/InvitationCard.jsx";
import { getEvent, getInvitation } from "../services/invitationService.js";

const NOTICE = {
  used: "Cette invitation a déjà été utilisée.",
  revoked: "Cette invitation a été désactivée.",
};

export default function InvitationDetails() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getEvent(), getInvitation(token)])
      .then(([e, i]) => { setEvent(e); setInvitation(i); })
      .catch((err) => setError(err.message));
  }, [token]);

  if (!event || !invitation) {
    return <main className="page"><p className="status">{error || "Chargement…"}</p></main>;
  }

  return (
    <main className="page">
      <article className="pass view">
        <InvitationCard
          event={event} guestName={invitation.guestName} token={token}
          notice={NOTICE[invitation.status]}
        />
      </article>
    </main>
  );
}
