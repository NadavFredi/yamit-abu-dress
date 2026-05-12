export interface Dress {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  inventory: number | null;
}

export interface OrderLine {
  id: string;
  dressId: string;
  startDate: string;
  endDate: string;
}

export interface DressSelection {
  dressId: string;
  startDate: string;
  endDate: string;
  quantity: number;
}

export interface SubmissionInput {
  recordId: string | null | undefined;
  selections: DressSelection[];
}

export interface ValidationError {
  code:
    | "missing_record_id"
    | "no_dresses"
    | "missing_dress"
    | "missing_start_date"
    | "missing_end_date"
    | "end_before_start"
    | "date_conflict"
    | "duplicate_dress"
    | "invalid_quantity";
  index?: number;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

export interface WebhookDressPayload {
  dress_id: string;
  dress_name: string | null;
  start_date: string;
  end_date: string;
  quantity: number;
}

export interface WebhookPayload {
  customer_record_id: string;
  selected_dresses: WebhookDressPayload[];
  submission_timestamp: string;
  source: "yamit-abu-dress-website";
}

export interface LeadUser {
  id: string;
  entity_id: string;
  tenant_id: string;
  display_name: string | null;
  data: Record<string, unknown>;
  computed: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadContext {
  user: LeadUser | null;
  dresses: Dress[];
}
