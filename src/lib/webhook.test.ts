import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildWebhookPayload, submitToWebhook } from "./webhook";
import type { Dress, DressSelection } from "@/types/domain";

const dresses: Dress[] = [
  { id: "d1", name: "שמלת ערב כחולה", inventory: null },
  { id: "d2", name: "שמלת חתונה לבנה", inventory: null },
];

describe("buildWebhookPayload", () => {
  it("includes the customer record id and timestamp", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date("2026-05-07T10:00:00.000Z"),
    });

    expect(payload.customer_record_id).toBe("rec_123");
    expect(payload.submission_timestamp).toBe("2026-05-07T10:00:00.000Z");
    expect(payload.source).toBe("yamit-abu-dress-website");
  });

  it("maps each selection into the dress payload with name resolved", () => {
    const selections: DressSelection[] = [
      { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      { dressId: "d2", startDate: "2026-08-01", endDate: "2026-08-03", quantity: 1 },
    ];
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections,
      dresses,
      now: new Date(),
    });

    expect(payload.selected_dresses).toEqual([
      {
        dress_id: "d1",
        dress_name: "שמלת ערב כחולה",
        start_date: "2026-07-01",
        end_date: "2026-07-05",
        quantity: 1,
        notes: null,
      },
      {
        dress_id: "d2",
        dress_name: "שמלת חתונה לבנה",
        start_date: "2026-08-01",
        end_date: "2026-08-03",
        quantity: 1,
        notes: null,
      },
    ]);
  });

  it("sets dress_name to null when the dress is unknown", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "unknown", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });
    expect(payload.selected_dresses[0].dress_name).toBeNull();
  });

  it("supports an empty selection list", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [],
      dresses,
      now: new Date("2026-05-07T10:00:00.000Z"),
    });

    expect(payload.selected_dresses).toEqual([]);
  });

  it("sets notes to null when notes is missing", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });
    expect(payload.selected_dresses[0].notes).toBeNull();
  });

  it("sets notes to null when notes is empty or whitespace", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1, notes: "   " },
      ],
      dresses,
      now: new Date(),
    });
    expect(payload.selected_dresses[0].notes).toBeNull();
  });

  it("trims and forwards non-empty notes", () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1, notes: "  needs hemming  " },
      ],
      dresses,
      now: new Date(),
    });
    expect(payload.selected_dresses[0].notes).toBe("needs hemming");
  });
});

describe("submitToWebhook", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs JSON to the configured webhook url", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });

    await submitToWebhook("https://hook.example.com/abc", payload);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://hook.example.com/abc");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it("throws when webhook url is empty", async () => {
    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });
    await expect(submitToWebhook("", payload)).rejects.toThrow(
      /webhook/i
    );
  });

  it("throws when the webhook responds with non-2xx", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });

    await expect(
      submitToWebhook("https://hook.example.com/abc", payload)
    ).rejects.toThrow();
  });

  it("rejects when fetch itself fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Network failed")
    );

    const payload = buildWebhookPayload({
      recordId: "rec_123",
      selections: [
        { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
      ],
      dresses,
      now: new Date(),
    });

    await expect(
      submitToWebhook("https://hook.example.com/abc", payload)
    ).rejects.toThrow(/network failed/i);
  });
});
