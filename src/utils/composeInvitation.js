import { formatDate } from "./formatDate.js";

const SERIF = '"Bodoni Moda", Georgia, serif';
const SANS = '"Figtree", system-ui, sans-serif';

export const DEFAULT_LAYOUT = { nameY: 0.56, qrY: 0.66, qrSize: 0.3, textColor: "#24161b" };

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Écrit une ligne centrée, en réduisant la taille jusqu'à ce qu'elle tienne
function line(ctx, str, y, { size, maxWidth, style = "italic 500", family = SERIF }) {
  let s = size;
  ctx.font = `${style} ${s}px ${family}`;
  while (ctx.measureText(str).width > maxWidth && s > 16) {
    s -= 2;
    ctx.font = `${style} ${s}px ${family}`;
  }
  ctx.fillText(str, ctx.canvas.width / 2, y);
}

// Visuel par défaut (sans image envoyée par les mariés) : même esprit que la page
function drawDefault(ctx, W, H, event, guestName) {
  const m = W * 0.05;
  const maxW = W * 0.78;
  ctx.fillStyle = "#4b1a2a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f4f0f1";
  ctx.fillRect(m, m, W - 2 * m, H - 2 * m);

  ctx.fillStyle = "#24161b";
  line(ctx, "Vous êtes invités au mariage de", H * 0.1, { size: W * 0.034, maxWidth: maxW, style: "italic 400" });
  line(ctx, `${event.groom_name} & ${event.bride_name}`, H * 0.19, { size: W * 0.09, maxWidth: maxW });
  line(ctx, formatDate(event.event_date), H * 0.29, { size: W * 0.036, maxWidth: maxW, style: "500", family: SANS });
  line(ctx, event.location, H * 0.33, { size: W * 0.036, maxWidth: maxW, style: "400", family: SANS });

  const ty = H * 0.4;
  ctx.strokeStyle = "#d9a5b3";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(m, ty);
  ctx.lineTo(W - m, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#4b1a2a";
  [m, W - m].forEach((x) => { ctx.beginPath(); ctx.arc(x, ty, 26, 0, Math.PI * 2); ctx.fill(); });

  ctx.fillStyle = "#24161b";
  line(ctx, guestName, H * 0.47, { size: W * 0.07, maxWidth: maxW });
  line(ctx, "Présentez ce QR code à l’entrée.", H * 0.88, { size: W * 0.03, maxWidth: maxW, style: "400", family: SANS });
  return { qrTop: H * 0.53, qrSide: W * 0.42 };
}

// Renvoie une image PNG (data URL) : visuel des mariés (ou visuel par défaut) + nom + QR code
export async function composeInvitation({ event, guestName, qrCanvas }) {
  const layout = { ...DEFAULT_LAYOUT, ...(event.invitation_layout ?? {}) };
  await Promise.all([
    document.fonts?.load(`italic 500 40px ${SERIF}`),
    document.fonts?.load(`500 20px ${SANS}`),
  ]).catch(() => {});

  const template = event.invitation_image
    ? await loadImage(event.invitation_image).catch(() => null)
    : null;
  const scale = template ? Math.min(1, 1600 / template.naturalWidth) : 1;
  const W = template ? Math.round(template.naturalWidth * scale) : 1080;
  const H = template ? Math.round(template.naturalHeight * scale) : 1620;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let qrTop, qrSide;
  if (template) {
    ctx.drawImage(template, 0, 0, W, H);
    ctx.fillStyle = layout.textColor;
    line(ctx, guestName, H * layout.nameY, { size: W * 0.06, maxWidth: W * 0.8 });
    qrSide = W * layout.qrSize;
    qrTop = H * layout.qrY;
    const pad = qrSide * 0.06;
    ctx.fillStyle = "#fff";
    ctx.fillRect((W - qrSide) / 2 - pad, qrTop - pad, qrSide + 2 * pad, qrSide + 2 * pad);
  } else {
    ({ qrTop, qrSide } = drawDefault(ctx, W, H, event, guestName));
  }
  ctx.drawImage(qrCanvas, (W - qrSide) / 2, qrTop, qrSide, qrSide);
  return canvas.toDataURL("image/png");
}
