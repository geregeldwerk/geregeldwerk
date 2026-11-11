export const QUOTE_STATUSES = ["concept", "verstuurd", "geaccepteerd", "afgewezen"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  concept: "Concept",
  verstuurd: "Verstuurd",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

export const CUSTOMER_TYPES = ["particulier", "zakelijk"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
};

export const PIPELINE_STATUSES = ["lead", "offerte_verstuurd", "gewonnen", "verloren"] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  lead: "Lead",
  offerte_verstuurd: "Offerte verstuurd",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};

export const PAYMENT_STATUSES = ["open", "betaald", "herinnering", "oninbaar"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  open: "Open",
  betaald: "Betaald",
  herinnering: "Herinnering",
  oninbaar: "Oninbaar",
};

export const UNITS = ["stuk", "uur", "meter", "m²", "set", "post"] as const;

export type Unit = (typeof UNITS)[number];

export const COUNTRIES = ["NL", "BE"] as const;

export type CountryCode = (typeof COUNTRIES)[number];

export const VAT_SCENARIOS = ["standaard", "verlegd", "intracommunautair"] as const;

export type VatScenario = (typeof VAT_SCENARIOS)[number];

export const PEPPOL_SEND_STATUSES = ["niet_verstuurd", "verstuurd_mock", "mislukt"] as const;

export type PeppolSendStatus = (typeof PEPPOL_SEND_STATUSES)[number];

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
  /** Land van de koper. Ontbreekt bij oudere offertes en telt dan als NL. */
  customerCountry?: CountryCode;
  customerStreet?: string;
  customerPostalCode?: string;
  customerCity?: string;
  customerVat?: string;
  /** Leeg: afgeleid uit KvK, ondernemingsnummer of btw-nummer. */
  customerEndpointScheme?: string;
  customerEndpointId?: string;
  /** KvK (NL) of ondernemingsnummer (BE) van de koper. */
  customerLegalId?: string;
  buyerReference?: string;
  vatScenario?: VatScenario;
  /** Koppeling naar de klantkaart. Null als de kaart bewust is losgemaakt. */
  customerId?: string | null;
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
  customerId?: string | null;
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
  /** Land van het eigen bedrijf. Ontbreekt bij oudere gegevens en telt dan als NL. */
  country?: CountryCode;
  /** Belgisch ondernemingsnummer, alleen nodig als country BE is. */
  enterpriseNumber?: string;
  /** Betaaltermijn van een factuur, in dagen. */
  paymentTermDays?: number;
  /**
   * Bewaartermijn in dagen voor een lead die op verloren staat.
   * Null: de eigenaar heeft nog geen termijn gekozen.
   */
  lostLeadRetentionDays?: number | null;
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

export interface InvoiceLineSnapshot {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  lineCents: number;
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
  issueDate?: string;
  dueDate?: string;
  vatScenario?: VatScenario;
  vatRate?: number;
  sellerCountry?: CountryCode;
  buyerCountry?: CountryCode;
  sellerName?: string;
  buyerReference?: string;
  sellerEndpointScheme?: string;
  sellerEndpointId?: string;
  buyerEndpointScheme?: string;
  buyerEndpointId?: string;
  lines?: InvoiceLineSnapshot[];
  ublXml?: string;
  sendStatus?: PeppolSendStatus;
  sendProvider?: string | null;
  transmissionId?: string | null;
  sentAt?: string | null;
  sendMessage?: string | null;
  customerId?: string | null;
  paymentStatus?: PaymentStatus;
  paymentUpdatedAt?: string | null;
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
  customerId?: string | null;
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

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  phone: string;
  email: string;
  address: string;
  country: CountryCode;
  /** Btw-nummer of ondernemingsnummer. */
  vatOrEnterpriseNumber: string;
  source: string;
  pipelineStatus: PipelineStatus;
  lossReason: string;
  tags: string[];
  /** Datum jjjj-mm-dd, of null als er geen einddatum is. */
  retainUntil: string | null;
  example: boolean;
  /** Lead waaruit deze kaart is gemaakt, zodat migratie niet dubbel telt. */
  sourceLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  text: string;
  at: string;
  quoteId: string | null;
  invoiceId: string | null;
  example: boolean;
}

/** Bijgehouden zodat een verwijderde leadkaart niet opnieuw uit het logboek komt. */
export interface CustomerMigrationState {
  convertedLeadIds: string[];
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
  customers: Customer[];
  customerNotes: CustomerNote[];
  customerMigration: CustomerMigrationState;
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
