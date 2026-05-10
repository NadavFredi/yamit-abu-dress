import type { OrderLine } from "@/types/domain";

const inFlightRequests = new Map<string, Promise<OrderLine[]>>();

export async function fetchDressReservations(
  webhookUrl: string,
  dressId: string,
  dressName: string
): Promise<OrderLine[]> {
  if (!webhookUrl) {
    throw new Error("Reservations webhook URL is not configured.");
  }

  const cacheKey = `${webhookUrl}::${dressId}`;
  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchDressReservationsUncached(
    webhookUrl,
    dressId,
    dressName
  ).finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, request);
  return request;
}

async function fetchDressReservationsUncached(
  webhookUrl: string,
  dressId: string,
  dressName: string
): Promise<OrderLine[]> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dress_id: dressId, dress_name: dressName }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load dress reservations (status ${response.status}).`
    );
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
  if (!Array.isArray(root.orders)) {
    throw new Error("Invalid response shape: orders is not an array.");
  }

  const lines: OrderLine[] = [];
  for (const raw of root.orders) {
    if (typeof raw !== "object" || raw === null) continue;
    const order = raw as Record<string, unknown>;
    const id = order.id;
    const data =
      typeof order.data === "object" && order.data !== null
        ? (order.data as Record<string, unknown>)
        : undefined;
    if (!data) continue;
    const dressIdValue = data.dress;
    const startDate = data.start_rent_date;
    const endDate = data.end_rent_date;
    if (
      typeof id !== "string" ||
      typeof dressIdValue !== "string" ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      continue;
    }
    lines.push({
      id,
      dressId: dressIdValue,
      startDate,
      endDate,
    });
  }

  return lines;
}
