export interface Dress {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
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
    | "duplicate_dress";
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
}

export interface WebhookPayload {
  customer_record_id: string;
  selected_dresses: WebhookDressPayload[];
  submission_timestamp: string;
  source: "yamit-abu-dress-website";
}
