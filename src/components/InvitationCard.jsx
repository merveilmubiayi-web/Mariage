import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { composeInvitation } from "../utils/composeInvitation.js";

export default function InvitationCard({ event, guestName, token, notice, onReset, bare = false }) {
  const qrRef = useRef(null);
  const [image, setImage] = useState("");

  useEffect(() => {
    let cancelled = false;
    composeInvitation({ event, guestName, qrCanvas: qrRef.current })
      .then((url) => { if (!cancelled) setImage(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [event, guestName, token]);

  function save() {
    const a = document.createElement("a");
    a.download = image ? "invitation.png" : "invitation-qr.png";
    a.href = image || qrRef.current.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="stub">
      {image
        ? <img className="composed" src={image} alt={`Invitation de ${guestName}`} />
        : <p className="guest">{guestName}</p>}
      <QRCodeCanvas
        ref={qrRef} size={640} marginSize={2}
        value={`${window.location.origin}/i/${token}`}
        style={image ? { display: "none" } : { width: 220, height: 220 }}
      />
      {!bare && (
        <>
          <p className={notice ? "error" : "hint"}>{notice || "Présentez ce QR code à l’entrée."}</p>
          <button type="button" onClick={save}>Enregistrer mon invitation</button>
          {onReset && (
            <button type="button" className="link" onClick={onReset}>Générer une autre invitation</button>
          )}
        </>
      )}
    </div>
  );
}
