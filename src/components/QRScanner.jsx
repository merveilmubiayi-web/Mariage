import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan, onError }) {
  const handled = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    let started = false;
    let cancelled = false;
    const stop = () => scanner.stop().then(() => scanner.clear()).catch(() => {});

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (handled.current) return;
          handled.current = true;
          onScan(text);
        },
        () => {}
      )
      .then(() => { started = true; if (cancelled) stop(); })
      .catch(() => onError("Caméra inaccessible. Autorisez-la dans le navigateur (HTTPS requis)."));

    return () => { cancelled = true; if (started) stop(); };
  }, []);

  return <div id="qr-reader" className="reader" />;
}
