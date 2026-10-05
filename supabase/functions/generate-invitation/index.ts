import { createClient } from "npm:@supabase/supabase-js@2";

// Large volontairement : plusieurs invités peuvent partager la même IP (réseau mobile, Wi-Fi).
const MAX_PER_IP_PER_HOUR = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { name, code, eventId } = await req.json().catch(() => ({}));
  const guestName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (guestName.length < 2 || guestName.length > 80) {
    return reply({ error: "Saisissez votre nom complet (2 à 80 caractères)." }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: event } = await db
    .from("events").select("id, access_code, max_invitations")
    .eq("id", eventId).maybeSingle();
  if (!event) return reply({ error: "Événement introuvable." }, 404);
  if (event.access_code && code !== event.access_code) {
    return reply({ error: "Ce lien d’invitation n’est pas valide. Utilisez le lien complet reçu des mariés." }, 403);
  }

  const { count: total } = await db
    .from("invitations").select("id", { count: "exact", head: true })
    .eq("event_id", event.id);
  if ((total ?? 0) >= event.max_invitations) {
    return reply({ error: "Le nombre maximal d’invitations est atteint. Contactez les mariés." }, 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "inconnue";
  const clientHash = await sha256(`${ip}:${event.id}`);
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await db
    .from("invitations").select("id", { count: "exact", head: true })
    .eq("client_hash", clientHash).gte("created_at", since);
  if ((recent ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return reply({ error: "Trop de demandes depuis cette connexion. Réessayez dans une heure." }, 429);
  }

  const token = newToken();
  const { error } = await db.from("invitations").insert({
    event_id: event.id, guest_name: guestName, token, client_hash: clientHash,
  });
  if (error) return reply({ error: "Création impossible. Réessayez." }, 500);

  return reply({ guestName, token });
});
