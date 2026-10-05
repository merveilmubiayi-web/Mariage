import { useState } from "react";
import QRScanner from "../components/QRScanner.jsx";
import { validateInvitation } from "../services/scannerService.js";
import { formatTime } from "../utils/formatDate.js";

const KEY = "mariage-qr:scanner-code";

const OUTCOMES = {
  accepted: { tone: "ok", icon: "✓", title: "Entrée autorisée" },
  used: { tone: "warn", icon: "!", title: "Déjà utilisée" },
  revoked: { tone: "bad", icon: "✕", title: "Invitation désactivée" },
  invalid: { tone: "bad", icon: "✕", title: "QR code non reconnu" },
};

export default function ScannerPage() {
  const [code, setCode] = useState(() => sessionStorage.getItem(KEY) ?? "");
  const [draft, setDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function saveCode(e) {
    e.preventDefault();
    const value = draft.trim();
    sessionStorage.setItem(KEY, value);
    setCode(value);
    setError("");
  }

  async function handleScan(text) {
    setScanning(false);
    setBusy(true);
    try {
      setResult(await validateInvitation(code, text));
    } catch (err) {
      if (err.status === 401) { sessionStorage.removeItem(KEY); setCode(""); }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setResult(null);
    setError("");
    setScanning(true);
  }

  if (!code) {
    return (
      <main className="scan">
        <h1>Contrôle des entrées</h1>
        <form onSubmit={saveCode}>
          <label htmlFor="code">Code agent</label>
          <input id="code" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" required />
          <button type="submit">Continuer</button>
          {error && <p className="scan-error" role="alert">{error}</p>}
        </form>
      </main>
    );
  }

  const outcome = result && OUTCOMES[result.result];

  return (
    <main className="scan">
      <h1>Contrôle des entrées</h1>
      {error && <p className="scan-error" role="alert">{error}</p>}
      {scanning && (
        <QRScanner onScan={handleScan} onError={(m) => { setScanning(false); setError(m); }} />
      )}
      {busy && <p>Vérification…</p>}
      {outcome && (
        <section className={`result ${outcome.tone}`} role="status">
          <span className="icon" aria-hidden="true">{outcome.icon}</span>
          <h2>{outcome.title}</h2>
          {result.guest_name && <p className="name">{result.guest_name}</p>}
          {result.result === "used" && <p>Entrée enregistrée à {formatTime(result.used_at)}</p>}
        </section>
      )}
      {!scanning && !busy && (
        <button type="button" onClick={start}>{result ? "Scanner le suivant" : "Scanner un QR code"}</button>
      )}
    </main>
  );
}
