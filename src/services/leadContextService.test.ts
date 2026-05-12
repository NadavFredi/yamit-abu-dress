import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLeadContext } from "./leadContextService";

const URL = "https://hook.example.com/dresses";

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
  user: {
    id: "7bfde42c-5d00-49bd-9de3-9094e5d0f0ea",
    entity_id: "8457cd25",
    tenant_id: "9722e0f4",
    display_name: "בדיקה",
    data: { phone: "+972526861485" },
    computed: {},
    created_at: "2026-05-07T06:36:21.393903+00:00",
    updated_at: "2026-05-09T19:05:11.707053+00:00",
  },
  items: [
    {
      id: "dfffa27b-6df8-4a31-a0ee-94a1a499143b",
      data: {
        name: "שמלה כתומה",
        status: "0",
        picture: null,
      },
      name: null,
      email: null,
      __IMTINDEX__: 1,
      __IMTLENGTH__: 3,
    },
    {
      id: "d956e6d3-2757-4003-a2d3-9904b01d485c",
      data: {
        name: "שמלה ורודה",
        status: "0",
        picture: "https://cdn.example.com/pink.jpg",
      },
      __IMTINDEX__: 2,
      __IMTLENGTH__: 3,
    },
    {
      id: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
      data: {
        name: "שמלה אדומה",
        status: "0",
        picture: null,
      },
      __IMTINDEX__: 3,
      __IMTLENGTH__: 3,
    },
  ],
};

describe("fetchLeadContext", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs JSON {record_id} to the configured URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: [] })
    );

    await fetchLeadContext(URL, "rec_abc");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(calledUrl).toBe(URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ record_id: "rec_abc" });
  });

  it("deduplicates simultaneous requests for the same record", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    const [first, second] = await Promise.all([
      fetchLeadContext(URL, "rec_abc"),
      fetchLeadContext(URL, "rec_abc"),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("does not deduplicate requests for different webhook URLs", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    await Promise.all([
      fetchLeadContext("https://hook.example.com/dresses-a", "rec_abc"),
      fetchLeadContext("https://hook.example.com/dresses-b", "rec_abc"),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("maps a real-shape response to user + dresses", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    const ctx = await fetchLeadContext(URL, "rec_abc");

    expect(ctx.user?.id).toBe("7bfde42c-5d00-49bd-9de3-9094e5d0f0ea");
    expect(ctx.dresses).toHaveLength(3);
    expect(ctx.dresses[0]).toEqual({
      id: "dfffa27b-6df8-4a31-a0ee-94a1a499143b",
      name: "שמלה כתומה",
      imageUrl: undefined,
      inventory: null,
    });
    expect(ctx.dresses[1]).toEqual({
      id: "d956e6d3-2757-4003-a2d3-9904b01d485c",
      name: "שמלה ורודה",
      imageUrl: "https://cdn.example.com/pink.jpg",
      inventory: null,
    });
  });

  it("returns user: null and dresses: [] when the lead is unknown", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: [] })
    );

    const ctx = await fetchLeadContext(URL, "rec_unknown");

    expect(ctx.user).toBeNull();
    expect(ctx.dresses).toEqual([]);
  });

  it("throws when the URL is empty", async () => {
    await expect(fetchLeadContext("", "rec_abc")).rejects.toThrow(/webhook/i);
  });

  it("throws when HTTP status is not OK", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/500/);
  });

  it("throws when items is not an array", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: { foo: "bar" } })
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/items/i);
  });

  it("throws when the response root is not an object", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(null)
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/shape/i);
  });

  it("throws when the body is not valid JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okText("not json")
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/json/i);
  });

  it("rejects when fetch itself fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Network failed")
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(
      /network failed/i
    );
  });

  it("skips items missing id or data.name; keeps the rest", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({
        user: null,
        items: [
          { id: "good-1", data: { name: "שמלה טובה", picture: null } },
          { id: "bad-no-name", data: { picture: null } },
          { data: { name: "שמלה ללא מזהה", picture: null } },
          { id: "good-2", data: { name: "שמלה נוספת", picture: null } },
        ],
      })
    );

    const ctx = await fetchLeadContext(URL, "rec_abc");

    expect(ctx.dresses.map((d) => d.id)).toEqual(["good-1", "good-2"]);
  });

  it("parses data.inventory as number, numeric string, or null", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({
        user: null,
        items: [
          { id: "a", data: { name: "A", inventory: 5 } },
          { id: "b", data: { name: "B", inventory: "3" } },
          { id: "c", data: { name: "C", inventory: null } },
          { id: "d", data: { name: "D" } },
          { id: "e", data: { name: "E", inventory: "not-a-number" } },
          { id: "f", data: { name: "F", inventory: 2.7 } },
        ],
      })
    );

    const ctx = await fetchLeadContext(URL, "rec_abc");
    const byId = Object.fromEntries(ctx.dresses.map((d) => [d.id, d.inventory]));

    expect(byId).toEqual({
      a: 5,
      b: 3,
      c: null,
      d: null,
      e: null,
      f: 2,
    });
  });
});
