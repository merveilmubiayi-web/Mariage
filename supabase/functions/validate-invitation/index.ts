import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Comparaison à durée constante, pour ne pas laisser deviner le code agent octet par octet
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { code, token, eventId } = await req.json().catch(() => ({}));

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: event } = await db
    .from("events").select("id, scanner_code")
    .eq("id", eventId).maybeSingle();
  if (!event || typeof code !== "string" || !safeEqual(code, event.scanner_code)) {
    return reply({ error: "Code agent incorrect." }, 401);
  }

  // Le QR contient https://…/i/<jeton> : on accepte l’URL complète ou le jeton seul
  const parsed = String(token ?? "").split("/i/").pop()!.split(/[?#]/)[0].trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(parsed)) return reply({ result: "invalid" });

  // Résultat : accepted | used | revoked | invalid (mise à jour atomique côté base)
  const { data, error } = await db.rpc("validate_invitation", {
    p_event_id: event.id, p_token: parsed,
  });
  if (error) return reply({ error: "Vérification impossible. Réessayez." }, 500);
  return reply(data);
});
