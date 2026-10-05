const fr = "fr-FR";

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(fr, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString(fr, { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(fr, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
