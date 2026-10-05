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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return reply({ error: "Invitation introuvable." }, 404);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await db
    .from("invitations").select("guest_name, status")
    .eq("token", token).maybeSingle();
  if (!data) return reply({ error: "Invitation introuvable." }, 404);

  return reply({ guestName: data.guest_name, status: data.status });
});
