import { supabase, EVENT_ID } from "./supabase.js";

export async function getEvent() {
  const { data, error } = await supabase
    .from("events")
    .select("id, groom_name, bride_name, event_date, location, invitation_image, invitation_layout")
    .eq("id", EVENT_ID)
    .maybeSingle();
  if (error || !data) throw new Error("Impossible de charger les informations du mariage.");
  return data;
}

export async function generateInvitation(name, code) {
  const { data, error } = await supabase.functions.invoke("generate-invitation", {
    body: { name, code, eventId: EVENT_ID },
  });
  if (error) {
    let message = "La génération a échoué. Réessayez.";
    try { message = (await error.context.json()).error ?? message; } catch {}
    throw new Error(message);
  }
  return data; // { guestName, token }
}

export async function getInvitation(token) {
  const { data, error } = await supabase.functions.invoke("get-invitation", { body: { token } });
  if (error || !data) throw new Error("Invitation introuvable.");
  return data; // { guestName, status }
}
