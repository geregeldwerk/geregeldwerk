import type {
  Approval,
  AuditEntry,
  CompanySettings,
  Expense,
  Invoice,
  LeadEntry,
  PermissionProposal,
  Quote,
  SocialPost,
  StoreData,
  Task,
} from "@/lib/domain/types";
import { defaultPermissions } from "@/lib/oversight/permissions";

/** Clearly fake demo data. Do not replace this with real customers. */
export function createSeedSettings(): CompanySettings {
  return {
    companyName: "Installatiebedrijf Voorbeeld",
    contactName: "Sam Voorbeeld",
    address: "Voorbeeldstraat 12",
    postalCode: "4561 XX",
    city: "Hulst",
    kvk: "00000000",
    btw: "NL000000000B00",
    iban: "NL00 BANK 0000 0000 00",
    email: "offerte@voorbeeld-installatie.test",
    phone: "0114-000000",
    quoteValidityDays: 30,
    defaultVatRate: 0.21,
    country: "NL",
    enterpriseNumber: "",
    paymentTermDays: 14,
    footerNote:
      "Fictieve voorbeeldgegevens. Prijzen op een offerte komen van jou, niet van de assistent.",
  };
}

export function normalizeSettings(input: Partial<CompanySettings> | undefined): CompanySettings {
  const seed = createSeedSettings();
  return {
    ...seed,
    ...input,
    country: input?.country === "BE" ? "BE" : "NL",
    enterpriseNumber: typeof input?.enterpriseNumber === "string" ? input.enterpriseNumber : "",
    paymentTermDays:
      typeof input?.paymentTermDays === "number" && Number.isInteger(input.paymentTermDays)
        ? input.paymentTermDays
        : seed.paymentTermDays,
  };
}

export function settingsLookPlaceholder(settings: CompanySettings): boolean {
  return settings.kvk === "00000000" || settings.btw.includes("000000000");
}

export function createSeedData(now = new Date("2026-03-16T09:00:00.000Z")): StoreData {
  const settings = createSeedSettings();
  const quotes: Quote[] = [
    {
      id: "quote-voorbeeld-concept",
      number: "OFF-2026-001",
      status: "concept",
      example: true,
      customerName: "Mevrouw De Test",
      customerPhone: "",
      customerEmail: "",
      location: "Terneuzen",
      jobDescription: "Stopcontact bijplaatsen",
      requestedDate: "vrijdag 12 juni",
      sourceText:
        "Mevrouw De Test in Terneuzen wil 3 stopcontacten bijplaatsen in de woonkamer, graag prijsopgave voor vrijdag 12 juni.",
      lines: [
        {
          id: "line-seed-1",
          description: "Stopcontact bijplaatsen",
          quantity: 3,
          unit: "stuk",
          unitPriceCents: null,
        },
      ],
      notes: "Voorbeeld. Prijs nog niet ingevuld.",
      vatRate: 0.21,
      createdAt: "2026-03-12T08:00:00.000Z",
      updatedAt: "2026-03-12T08:00:00.000Z",
    },
    {
      id: "quote-voorbeeld-verstuurd",
      number: "OFF-2026-002",
      status: "verstuurd",
      example: true,
      customerName: "Pieter de Vries (fictief)",
      customerPhone: "06-00000000",
      customerEmail: "pieter.devries@example.test",
      location: "Voorbeeldstraat 4, Goes",
      jobDescription: "Keukenkraan repareren, Afvoer ontstoppen",
      requestedDate: "volgende week dinsdag",
      sourceText:
        "Hoi, met Pieter de Vries uit Goes. De keukenkraan lekt en de afvoer is verstopt. Graag offerte.",
      lines: [
        {
          id: "line-seed-2a",
          description: "Keukenkraan repareren",
          quantity: 1,
          unit: "stuk",
          unitPriceCents: 8500,
        },
        {
          id: "line-seed-2b",
          description: "Afvoer ontstoppen",
          quantity: 1,
          unit: "uur",
          unitPriceCents: 6500,
        },
      ],
      notes: "Prijzen in dit voorbeeld zijn met de hand ingevuld.",
      vatRate: 0.21,
      createdAt: "2026-03-10T10:30:00.000Z",
      updatedAt: "2026-03-11T14:00:00.000Z",
    },
    {
      id: "quote-voorbeeld-geaccepteerd",
      number: "OFF-2026-003",
      status: "geaccepteerd",
      example: true,
      customerName: "Familie Vermeer",
      customerPhone: "0118-000000",
      customerEmail: "vermeer@example.test",
      location: "Voorbeeldstraat 8, Middelburg",
      jobDescription: "Radiator vervangen, Oude radiator afvoeren",
      requestedDate: "18 maart 2026",
      sourceText: "Familie Vermeer in Middelburg wil twee radiatoren vervangen en de oude meenemen.",
      lines: [
        {
          id: "line-seed-3a",
          description: "Radiator vervangen",
          quantity: 2,
          unit: "stuk",
          unitPriceCents: 18000,
        },
        {
          id: "line-seed-3b",
          description: "Oude radiator afvoeren",
          quantity: 2,
          unit: "stuk",
          unitPriceCents: 3500,
        },
      ],
      notes: "",
      vatRate: 0.21,
      createdAt: "2026-03-02T09:15:00.000Z",
      updatedAt: "2026-03-04T16:45:00.000Z",
    },
  ];

  const tasks: Task[] = [
    {
      id: "task-voorbeeld-open",
      title: "Offerte afronden voor Mevrouw De Test",
      detail: "Fictief voorbeeld. Vul de prijs van de stopcontacten in voordat je iets verstuurt.",
      dueDate: "2026-06-12",
      done: false,
      quoteId: "quote-voorbeeld-concept",
      example: true,
      createdAt: "2026-03-12T08:05:00.000Z",
    },
    {
      id: "task-voorbeeld-klaar",
      title: "Radiatoren inplannen bij Familie Vermeer",
      detail: "Fictief voorbeeld. Deze herinnering is afgevinkt.",
      dueDate: "2026-03-18",
      done: true,
      quoteId: "quote-voorbeeld-geaccepteerd",
      example: true,
      createdAt: "2026-03-02T09:20:00.000Z",
    },
  ];

  const permissions = defaultPermissions();
  const expenses: Expense[] = [
    {
      id: "expense-voorbeeld-40",
      description: "Fictieve pakkingset",
      amountCents: 4000,
      bookedAt: "2026-03-18T09:10:00.000Z",
      example: true,
      simulated: true,
    },
  ];
  const invoices: Invoice[] = [
    {
      id: "invoice-voorbeeld",
      number: "FAC-2026-001",
      quoteId: "quote-voorbeeld-geaccepteerd",
      customerName: "Familie Vermeer",
      amountCents: 43000,
      vatCents: 9030,
      totalCents: 52030,
      createdAt: "2026-03-05T10:00:00.000Z",
      example: true,
      simulated: true,
    },
  ];
  const posts: SocialPost[] = [
    {
      id: "post-voorbeeld-concept",
      status: "concept",
      channel: "instagram",
      body: "Fictief concept: cv-ketelonderhoud voor de winter. Bel Installatiebedrijf Voorbeeld, niet een echt bedrijf.",
      scheduledFor: null,
      publishedAt: null,
      example: true,
      simulated: true,
    },
    {
      id: "post-voorbeeld-ingepland",
      status: "ingepland",
      channel: "facebook",
      body: "Fictieve tip: ontlucht je radiatoren voordat het vriest. Geen echte publicatie.",
      scheduledFor: "2026-11-02T08:00:00.000Z",
      publishedAt: null,
      example: true,
      simulated: true,
    },
  ];
  const leads: LeadEntry[] = [
    {
      id: "lead-voorbeeld-1",
      at: "2026-03-04T12:00:00.000Z",
      source: "Mond-tot-mond",
      name: "Familie Vermeer (fictief)",
      note: "Voorbeeldlead. Geen echte persoon.",
      example: true,
    },
    {
      id: "lead-voorbeeld-2",
      at: "2026-03-20T15:00:00.000Z",
      source: "Instagram",
      name: "Testklant Hulst",
      note: "Groeilogboek, gesimuleerd. Geen koppeling met Instagram.",
      example: true,
    },
  ];
  const approvals: Approval[] = [
    {
      id: "approval-voorbeeld-bon",
      status: "wacht_op_goedkeuring",
      actionType: "bon_boeken",
      actor: { kind: "ai", label: "Geregeldwerk-assistent (mock)" },
      summary: "Bon boeken: fictieve boormachine",
      reason: "Bedrag € 120,00 ligt boven het maximum van € 75,00.",
      payload: { type: "bon_boeken", description: "Fictieve boormachine", amountCents: 12000 },
      amountCents: 12000,
      customerName: null,
      createdAt: "2026-03-18T09:30:00.000Z",
      decidedAt: null,
      decidedBy: null,
      comment: null,
      lastError: null,
      example: true,
    },
    {
      id: "approval-voorbeeld-post",
      status: "wacht_op_goedkeuring",
      actionType: "social_publiceren",
      actor: { kind: "ai", label: "Geregeldwerk-assistent (mock)" },
      summary: "Social post publiceren (facebook)",
      reason: "Deze actie staat op altijd vragen.",
      payload: { type: "social_publiceren", postId: "post-voorbeeld-ingepland" },
      amountCents: null,
      customerName: null,
      createdAt: "2026-03-19T11:00:00.000Z",
      decidedAt: null,
      decidedBy: null,
      comment: null,
      lastError: null,
      example: true,
    },
  ];
  const permissionProposals: PermissionProposal[] = [
    {
      id: "perm-voorstel-voorbeeld",
      status: "wacht_op_goedkeuring",
      before: permissions.rules,
      after: permissions.rules.map((rule) =>
        rule.actionType === "bon_boeken" ? { ...rule, maxAmountCents: 15000 } : rule,
      ),
      createdAt: "2026-03-18T12:00:00.000Z",
      decidedAt: null,
      decidedBy: null,
      comment: null,
      requestedBy: { kind: "mens", label: "Eigenaar" },
      example: true,
    },
  ];
  const audit: AuditEntry[] = [
    {
      id: "audit-voorbeeld-bon",
      at: "2026-03-18T09:10:00.000Z",
      actor: { kind: "ai", label: "Geregeldwerk-assistent (mock)" },
      action: "bon_boeken",
      outcome: "uitgevoerd",
      summary: "Bon boeken: fictieve pakkingset",
      input: { type: "bon_boeken", description: "Fictieve pakkingset", amountCents: 4000 },
      output: { reason: "Binnen de permissie en de grenzen." },
      before: { expenses: 0 },
      after: { expenses: 1 },
      comment: null,
      error: null,
    },
    {
      id: "audit-voorbeeld-wachtrij",
      at: "2026-03-18T09:30:00.000Z",
      actor: { kind: "ai", label: "Geregeldwerk-assistent (mock)" },
      action: "bon_boeken",
      outcome: "wachtrij",
      summary: "Bon boeken: fictieve boormachine",
      input: { type: "bon_boeken", description: "Fictieve boormachine", amountCents: 12000 },
      output: { approvalId: "approval-voorbeeld-bon" },
      before: { expenses: 1 },
      after: { expenses: 1 },
      comment: null,
      error: null,
    },
    {
      id: "audit-voorbeeld-fout",
      at: "2026-03-12T08:20:00.000Z",
      actor: { kind: "ai", label: "Geregeldwerk-assistent (mock)" },
      action: "factuur_maken",
      outcome: "fout",
      summary: "Factuur maken voor OFF-2026-001",
      input: { type: "factuur_maken", quoteId: "quote-voorbeeld-concept" },
      output: null,
      before: null,
      after: null,
      comment: null,
      error: "Factuur kan niet zonder volledige prijzen.",
    },
  ];

  void now;
  return {
    quotes,
    tasks,
    settings,
    permissions,
    approvals,
    permissionProposals,
    audit,
    invoices,
    expenses,
    appointments: [],
    posts,
    leads,
  };
}
