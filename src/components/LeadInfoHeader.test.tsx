import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadInfoHeader } from "./LeadInfoHeader";
import type { LeadUser } from "@/types/domain";

const baseUser: LeadUser = {
  id: "lead-1",
  entity_id: "entity-1",
  tenant_id: "tenant-1",
  display_name: "בדיקה",
  data: { full_name: "שם מלא", phone: "+972526861485" },
  computed: {},
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

describe("LeadInfoHeader", () => {
  it("renders display_name and formats +972 phone numbers for local display", () => {
    render(<LeadInfoHeader user={baseUser} />);

    expect(screen.getByText("שלום,")).toBeInTheDocument();
    expect(screen.getByText("בדיקה")).toBeInTheDocument();
    expect(screen.getByText("טלפון:")).toBeInTheDocument();
    expect(screen.getByText("0526861485")).toBeInTheDocument();
  });

  it("falls back to data.full_name when display_name is empty", () => {
    render(
      <LeadInfoHeader
        user={{ ...baseUser, display_name: "", data: { full_name: "יעל" } }}
      />
    );

    expect(screen.getByText("יעל")).toBeInTheDocument();
  });

  it("renders only the phone field when no name exists", () => {
    render(
      <LeadInfoHeader
        user={{ ...baseUser, display_name: null, data: { phone: "0521112222" } }}
      />
    );

    expect(screen.queryByText("שלום,")).not.toBeInTheDocument();
    expect(screen.getByText("0521112222")).toBeInTheDocument();
  });

  it("renders nothing when both name and phone are missing", () => {
    const { container } = render(
      <LeadInfoHeader user={{ ...baseUser, display_name: null, data: {} }} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("ignores non-string API values instead of rendering them", () => {
    const { container } = render(
      <LeadInfoHeader
        user={{
          ...baseUser,
          display_name: null,
          data: { full_name: 123, phone: ["052"] },
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
