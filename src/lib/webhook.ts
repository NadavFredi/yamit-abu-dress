import type {
  Dress,
  DressSelection,
  WebhookDressPayload,
  WebhookPayload,
} from "@/types/domain";

interface BuildPayloadInput {
  recordId: string;
  selections: DressSelection[];
  dresses: Dress[];
  now: Date;
}

export function buildWebhookPayload({
  recordId,
  selections,
  dresses,
  now,
}: BuildPayloadInput): WebhookPayload {
  const dressNameById = new Map(dresses.map((d) => [d.id, d.name]));

  const selected_dresses: WebhookDressPayload[] = selections.map((sel) => {
    const trimmedNotes = (sel.notes ?? "").trim();
    return {
      dress_id: sel.dressId,
      dress_name: dressNameById.get(sel.dressId) ?? null,
      start_date: sel.startDate,
      end_date: sel.endDate,
      quantity: sel.quantity,
      notes: trimmedNotes === "" ? null : trimmedNotes,
    };
  });

  return {
    customer_record_id: recordId,
    selected_dresses,
    submission_timestamp: now.toISOString(),
    source: "yamit-abu-dress-website",
  };
}

export async function submitToWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<void> {
  if (!webhookUrl) {
    throw new Error("Webhook URL is not configured.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook submission failed with status ${response.status}.`
    );
  }
}
