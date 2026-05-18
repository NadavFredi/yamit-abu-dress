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

export interface NewDressResult {
  id: string;
  name?: string;
  inventory?: number | null;
  imageUrl?: string;
}

export async function submitNewDress(
  webhookUrl: string,
  payload: NewDressPayload
): Promise<NewDressResult> {
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

  const text = await response.text();
  if (!text) {
    throw new Error(
      "השרת לא החזיר מזהה לשמלה החדשה. עדכנו את ה-Webhook להחזיר { id: \"rec...\" }."
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("תגובת השרת אינה JSON תקין.");
  }

  const id = extractDressId(body);
  if (!id) {
    throw new Error(
      "השרת לא החזיר מזהה לשמלה החדשה. עדכנו את ה-Webhook להחזיר { id: \"rec...\" }."
    );
  }

  return {
    id,
    name: extractString(body, ["name", "dress_name"]) ??
      extractNested(body, ["data", "name"]) ??
      undefined,
    inventory: extractInventory(body),
    imageUrl:
      extractString(body, ["picture", "image_url", "imageUrl"]) ??
      extractNested(body, ["data", "picture"]) ??
      undefined,
  };
}

function extractDressId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const root = body as Record<string, unknown>;
  const candidates = [
    root.id,
    root.record_id,
    root.recordId,
    root.dress_id,
    root.dressId,
    (root.data as Record<string, unknown> | undefined)?.id,
    (root.dress as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return null;
}

function extractString(body: unknown, keys: string[]): string | null {
  if (typeof body !== "object" || body === null) return null;
  const root = body as Record<string, unknown>;
  for (const k of keys) {
    const v = root[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

function extractNested(body: unknown, path: string[]): string | null {
  let cur: unknown = body;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" && cur.trim() !== "" ? cur : null;
}

function extractInventory(body: unknown): number | null | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const root = body as Record<string, unknown>;
  const candidates: unknown[] = [
    root.inventory,
    (root.data as Record<string, unknown> | undefined)?.inventory,
  ];
  for (const raw of candidates) {
    if (raw === undefined) continue;
    if (raw === null) return null;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      return Math.floor(raw);
    }
    if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
  }
  return undefined;
}
