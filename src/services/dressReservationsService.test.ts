import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchDressReservations } from "./dressReservationsService";

const URL = "https://hook.example.com/reservations";

const okJson = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

const okText = (text: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
    text: async () => text,
  }) as unknown as Response;

const realResponseSample = {
  orders: [
    {
      id: "e8931ffc-3e2e-4bcf-ae9a-31cb1ca1a0b5",
      data: {
        dress: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        order: "7bfde42c-5d00-49bd-9de3-9094e5d0f0ea",
        end_rent_date: "2026-05-31",
        __display_name: "",
        start_rent_date: "2026-05-26",
        order_status: null,
        order_no: null,
        order_status_label: null,
      },
      name: null,
      email: null,
      __IMTINDEX__: 1,
      __IMTLENGTH__: 2,
    },
    {
      id: "358b9d3e-74d4-4b89-8739-60b4776f7f45",
      data: {
        dress: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        order: "7bfde42c-5d00-49bd-9de3-9094e5d0f0ea",
        order_no: "1",
        order_status: "1",
        end_rent_date: "2026-05-15",
        start_rent_date: "2026-05-10",
        order_status_label: "אושר",
      },
      __IMTINDEX__: 2,
      __IMTLENGTH__: 2,
    },
  ],
};

describe("fetchDressReservations", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs JSON {dress_id, dress_name} to the configured URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ orders: [] })
    );

    await fetchDressReservations(URL, "dress-001", "שמלה כתומה");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(calledUrl).toBe(URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({
      dress_id: "dress-001",
      dress_name: "שמלה כתומה",
    });
  });

  it("deduplicates simultaneous requests for the same dress", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    const [first, second] = await Promise.all([
      fetchDressReservations(URL, "dress-001", "שמלה כתומה"),
      fetchDressReservations(URL, "dress-001", "שמלה כתומה"),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("does not deduplicate requests for different webhook URLs", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    await Promise.all([
      fetchDressReservations("https://hook.example.com/a", "dress-001", "שמלה"),
      fetchDressReservations("https://hook.example.com/b", "dress-001", "שמלה"),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("maps a real-shape response to OrderLine[]", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    const lines = await fetchDressReservations(
      URL,
      "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
      "שמלה אדומה"
    );

    expect(lines).toEqual([
      {
        id: "e8931ffc-3e2e-4bcf-ae9a-31cb1ca1a0b5",
        dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        startDate: "2026-05-26",
        endDate: "2026-05-31",
      },
      {
        id: "358b9d3e-74d4-4b89-8739-60b4776f7f45",
        dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        startDate: "2026-05-10",
        endDate: "2026-05-15",
      },
    ]);
  });

  it("returns [] when orders is empty", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ orders: [] })
    );
    const lines = await fetchDressReservations(URL, "d1", "name");
    expect(lines).toEqual([]);
  });

  it("throws when URL is empty", async () => {
    await expect(fetchDressReservations("", "d1", "name")).rejects.toThrow(
      /webhook/i
    );
  });

  it("throws when HTTP status is not OK", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
    } as Response);
    await expect(fetchDressReservations(URL, "d1", "name")).rejects.toThrow(
      /502/
    );
  });

  it("throws when orders is not an array", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ orders: { foo: "bar" } })
    );
    await expect(fetchDressReservations(URL, "d1", "name")).rejects.toThrow(
      /orders/i
    );
  });

  it("throws when the response root is not an object", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(null)
    );

    await expect(fetchDressReservations(URL, "d1", "name")).rejects.toThrow(
      /shape/i
    );
  });

  it("throws when body is not valid JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okText("not json")
    );
    await expect(fetchDressReservations(URL, "d1", "name")).rejects.toThrow(
      /json/i
    );
  });

  it("rejects when fetch itself fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Network failed")
    );

    await expect(fetchDressReservations(URL, "d1", "name")).rejects.toThrow(
      /network failed/i
    );
  });

  it("skips orders missing required fields", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({
        orders: [
          {
            id: "good-1",
            data: {
              dress: "d1",
              start_rent_date: "2026-05-01",
              end_rent_date: "2026-05-05",
            },
          },
          {
            id: "missing-dress",
            data: {
              start_rent_date: "2026-05-10",
              end_rent_date: "2026-05-12",
            },
          },
          {
            id: "missing-start",
            data: { dress: "d1", end_rent_date: "2026-05-15" },
          },
          {
            id: "missing-end",
            data: { dress: "d1", start_rent_date: "2026-05-20" },
          },
          {
            data: {
              dress: "d1",
              start_rent_date: "2026-05-22",
              end_rent_date: "2026-05-25",
            },
          },
          {
            id: "good-2",
            data: {
              dress: "d1",
              start_rent_date: "2026-06-01",
              end_rent_date: "2026-06-05",
            },
          },
        ],
      })
    );

    const lines = await fetchDressReservations(URL, "d1", "name");
    expect(lines.map((l) => l.id)).toEqual(["good-1", "good-2"]);
  });
});
