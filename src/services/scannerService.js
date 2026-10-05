import { supabase, EVENT_ID } from "./supabase.js";

// Résultat : { result: "accepted" | "used" | "revoked" | "invalid", guest_name, used_at }
export async function validateInvitation(code, scanned) {
  const { data, error } = await supabase.functions.invoke("validate-invitation", {
    body: { code, token: scanned, eventId: EVENT_ID },
  });
  if (error) {
    let message = "Vérification impossible. Contrôlez la connexion et réessayez.";
    try { message = (await error.context.json()).error ?? message; } catch {}
    throw Object.assign(new Error(message), { status: error.context?.status });
  }
  return data;
}
