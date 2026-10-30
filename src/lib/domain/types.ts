export const QUOTE_STATUSES = ["concept", "verstuurd", "geaccepteerd"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  concept: "Concept",
  verstuurd: "Verstuurd",
  geaccepteerd: "Geaccepteerd",
};

export const UNITS = ["stuk", "uur", "meter", "m²", "set", "post"] as const;

export type Unit = (typeof UNITS)[number];

export interface ExtractedLine {
  description: string;
  quantity: number | null;
  unit: string | null;
}

export interface FollowUpSuggestion {
  title: string;
  detail: string;
}

/** Structured reading of a customer message. Never contains prices. */
export interface Extraction {
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  location: string | null;
  jobDescription: string;
  requestedDate: string | null;
  lineItems: ExtractedLine[];
  missingInfo: string[];
  followUp: FollowUpSuggestion | null;
}

export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  /** Null until a person types a price. The extractor never fills this. */
  unitPriceCents: number | null;
}

export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  example: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  location: string;
  jobDescription: string;
  requestedDate: string;
  sourceText: string;
  lines: QuoteLine[];
  notes: string;
  vatRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  dueDate: string | null;
  done: boolean;
  quoteId: string | null;
  example: boolean;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  contactName: string;
  address: string;
  postalCode: string;
  city: string;
  kvk: string;
  btw: string;
  iban: string;
  email: string;
  phone: string;
  quoteValidityDays: number;
  defaultVatRate: number;
  footerNote: string;
}

export const ACTION_TYPES = [
  "offerte_versturen",
  "factuur_maken",
  "afspraak_inplannen",
  "bon_boeken",
  "social_publiceren",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const PERMISSION_MODES = ["altijd_vragen", "automatisch", "uit"] as const;

export type PermissionMode = (typeof PERMISSION_MODES)[number];

export interface PermissionRule {
  actionType: ActionType;
  mode: PermissionMode;
  /** Null means no amount cap. */
  maxAmountCents: number | null;
  existingCustomersOnly: boolean;
  businessHoursOnly: boolean;
  /** "HH:mm" in Europe/Amsterdam. */
  businessStart: string;
  businessEnd: string;
  /** 1 = Monday … 7 = Sunday. */
  businessDays: number[];
}

export interface PermissionsState {
  rules: PermissionRule[];
  /** Pauses every automatic rule. Actions then wait in the queue. */
  emergencyStop: boolean;
}

export interface Actor {
  kind: "ai" | "mens";
  label: string;
}

export const AUDIT_OUTCOMES = [
  "uitgevoerd",
  "wachtrij",
  "geweigerd",
  "goedgekeurd",
  "afgewezen",
  "fout",
] as const;

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export interface AuditEntry {
  id: string;
  at: string;
  actor: Actor;
  action: string;
  outcome: AuditOutcome;
  summary: string;
  input: unknown;
  output: unknown;
  before: unknown;
  after: unknown;
  comment: string | null;
  error: string | null;
}

export type ApprovalStatus = "wacht_op_goedkeuring" | "goedgekeurd" | "afgewezen";

export type ActionPayload =
  | { type: "offerte_versturen"; quoteId: string }
  | { type: "factuur_maken"; quoteId: string }
  | {
      type: "afspraak_inplannen";
      title: string;
      customerName: string;
      when: string;
      quoteId: string | null;
    }
  | { type: "bon_boeken"; description: string; amountCents: number }
  | { type: "social_publiceren"; postId: string };

export interface Approval {
  id: string;
  status: ApprovalStatus;
  actionType: ActionType;
  actor: Actor;
  summary: string;
  reason: string;
  payload: ActionPayload;
  amountCents: number | null;
  customerName: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: Actor | null;
  comment: string | null;
  lastError: string | null;
  example: boolean;
}

export interface PermissionProposal {
  id: string;
  status: ApprovalStatus;
  before: PermissionRule[];
  after: PermissionRule[];
  createdAt: string;
  decidedAt: string | null;
  decidedBy: Actor | null;
  comment: string | null;
  requestedBy: Actor;
  example: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  quoteId: string;
  customerName: string;
  amountCents: number;
  vatCents: number;
  totalCents: number;
  createdAt: string;
  example: boolean;
  simulated: true;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  bookedAt: string;
  example: boolean;
  simulated: true;
}

export interface Appointment {
  id: string;
  title: string;
  customerName: string;
  when: string;
  quoteId: string | null;
  createdAt: string;
  example: boolean;
  simulated: true;
}

export const POST_STATUSES = ["concept", "ingepland", "gepubliceerd"] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export type SocialChannel = "instagram" | "facebook" | "linkedin";

export interface SocialPost {
  id: string;
  status: PostStatus;
  channel: SocialChannel;
  body: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  example: boolean;
  simulated: true;
}

export interface LeadEntry {
  id: string;
  at: string;
  source: string;
  name: string;
  note: string;
  example: boolean;
}

export interface StoreData {
  quotes: Quote[];
  tasks: Task[];
  settings: CompanySettings;
  permissions: PermissionsState;
  approvals: Approval[];
  permissionProposals: PermissionProposal[];
  audit: AuditEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  appointments: Appointment[];
  posts: SocialPost[];
  leads: LeadEntry[];
}

export interface Totals {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  pricedLineCount: number;
  missingPriceCount: number;
  complete: boolean;
}

export interface QuoteReview {
  blockers: string[];
  warnings: string[];
}
