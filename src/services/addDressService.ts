import type { LeadUser } from "@/types/domain";

export interface NewDressPayload {
  dress_name: string;
  submission_timestamp: string;
  submission_timestamp_local: string;
  timezone: string;
  source: "yamit-abu-dress-website";
  customer_record_id: string | null;
  customer: LeadUser | null;
  submitted_by: string | null;
  page_url: string | null;
  user_agent: string | null;
  language: string | null;
}

export async function submitNewDress(
  webhookUrl: string,
  payload: NewDressPayload
): Promise<void> {
  if (!webhookUrl) {
    throw new Error("Add-dress webhook URL is not configured.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Add-dress webhook submission failed with status ${response.status}.`
    );
  }
}
