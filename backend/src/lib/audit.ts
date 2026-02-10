import { supabaseAdmin } from "./supabaseAdmin";

type AuditEvent = {
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_display: string;
  actor_id: string;
  action: string;
  details: Record<string, unknown> | null;
};

export async function logAuditEvent(event: AuditEvent) {
  const { error } = await supabaseAdmin.from("audit_events").insert({
    ...event,
    details: event.details ?? null
  });

  if (error) {
    console.error("Failed to log audit event", error);
  }
}
