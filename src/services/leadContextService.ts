import type { Dress, LeadContext, LeadUser } from "@/types/domain";

const inFlightRequests = new Map<string, Promise<LeadContext>>();

export async function fetchLeadContext(
  webhookUrl: string,
  recordId: string
): Promise<LeadContext> {
  if (!webhookUrl) {
    throw new Error("Dresses webhook URL is not configured.");
  }

  const cacheKey = `${webhookUrl}::${recordId}`;
  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchLeadContextUncached(webhookUrl, recordId).finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, request);
  return request;
}

async function fetchLeadContextUncached(
  webhookUrl: string,
  recordId: string
): Promise<LeadContext> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record_id: recordId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load dresses (status ${response.status}).`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Invalid JSON from server.");
  }

  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid response shape.");
  }

  const root = body as Record<string, unknown>;
  if (!Array.isArray(root.items)) {
    throw new Error("Invalid response shape: items is not an array.");
  }

  const dresses: Dress[] = [];
  for (const raw of root.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const id = item.id;
    const data =
      typeof item.data === "object" && item.data !== null
        ? (item.data as Record<string, unknown>)
        : undefined;
    const name = data?.name;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const picture = data?.picture;
    const imageUrl =
      typeof picture === "string" && picture.length > 0 ? picture : undefined;
    const inventory = parseInventory(data?.inventory);
    dresses.push({ id, name, imageUrl, inventory });
  }

  const user = (root.user ?? null) as LeadUser | null;
  return { user, dresses };
}

function parseInventory(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}
