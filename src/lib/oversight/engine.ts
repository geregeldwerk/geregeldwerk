import { calculateTotals } from "@/lib/domain/money";
import { QuoteInputError, updateQuote } from "@/lib/domain/quote";
import { createInvoiceFromQuote } from "@/lib/peppol/invoice";
import type {
  ActionPayload,
  Actor,
  AuditEntry,
  AuditOutcome,
  PermissionProposal,
  PermissionRule,
  StoreData,
} from "@/lib/domain/types";
import { evaluatePermission, OWNER } from "@/lib/oversight/permissions";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

const AUDIT_KEYS = [
  "id",
  "at",
  "actor",
  "action",
  "outcome",
  "summary",
  "input",
  "output",
  "before",
  "after",
  "comment",
  "error",
] as const;

export function auditEntryIsComplete(entry: AuditEntry): boolean {
  return AUDIT_KEYS.every((key) => entry[key] !== undefined);
}

export function copyStore(target: StoreData, source: StoreData) {
  (Object.keys(source) as (keyof StoreData)[]).forEach((key) => {
    (target as unknown as Record<string, unknown>)[key] = source[key];
  });
}

export function withAudit(
  store: StoreData,
  fields: {
    at: string;
    actor: Actor;
    action: string;
    outcome: AuditOutcome;
    summary: string;
    input: unknown;
    output: unknown;
    before: unknown;
    after: unknown;
    comment?: string | null;
    error?: string | null;
    id?: string;
  },
): StoreData {
  const next = structuredClone(store);
  const entry: AuditEntry = {
    id: fields.id ?? `audit-${crypto.randomUUID()}`,
    at: fields.at,
    actor: fields.actor,
    action: fields.action,
    outcome: fields.outcome,
    summary: fields.summary,
    input: fields.input,
    output: fields.output,
    before: fields.before,
    after: fields.after,
    comment: fields.comment ?? null,
    error: fields.error ?? null,
  };
  next.audit.push(entry);
  return next;
}

export interface ActionResult {
  store: StoreData;
  effect: "uitvoeren" | "wachtrij" | "weigeren" | "fout";
  reason: string;
  approvalId: string | null;
  invoiceId?: string | null;
}

export function requestAction(
  store: StoreData,
  input: { actor: Actor; summary?: string; payload: ActionPayload },
  now: Date,
): ActionResult {
  const at = now.toISOString();
  const draft = structuredClone(store);
  const payload = input.payload;
  const context = deriveContext(draft, payload, now);
  if (!context.ok) {
    const logged = withAudit(store, {
      at,
      actor: input.actor,
      action: payload.type,
      outcome: "fout",
      summary: input.summary ?? context.error,
      input: payload,
      output: null,
      before: null,
      after: null,
      error: context.error,
    });
    return { store: logged, effect: "fout", reason: context.error, approvalId: null };
  }

  const rule = draft.permissions.rules.find((item) => item.actionType === payload.type);
  const decision = evaluatePermission({
    emergencyStop: draft.permissions.emergencyStop,
    rule,
    amountCents: context.amountCents,
    existingCustomer: context.existingCustomer,
    at: now,
  });
  const summary = input.summary ?? context.summary;

  if (decision.effect === "uitvoeren") {
    const before = snapshot(draft, payload);
    const applied = applyPayload(draft, payload, now);
    if (!applied.ok) {
      const logged = withAudit(store, {
        at,
        actor: input.actor,
        action: payload.type,
        outcome: "fout",
        summary,
        input: payload,
        output: null,
        before,
        after: before,
        error: applied.error,
      });
      return { store: logged, effect: "fout", reason: applied.error, approvalId: null };
    }
    const after = snapshot(draft, payload);
    const logged = withAudit(draft, {
      at,
      actor: input.actor,
      action: payload.type,
      outcome: "uitgevoerd",
      summary,
      input: payload,
      output: { reason: decision.reason },
      before,
      after,
    });
    return {
      store: logged,
      effect: "uitvoeren",
      reason: decision.reason,
      approvalId: null,
      invoiceId: invoiceIdFrom(logged, payload),
    };
  }

  if (decision.effect === "weigeren") {
    const logged = withAudit(store, {
      at,
      actor: input.actor,
      action: payload.type,
      outcome: "geweigerd",
      summary,
      input: payload,
      output: null,
      before: snapshot(store, payload),
      after: snapshot(store, payload),
      error: decision.reason,
    });
    return { store: logged, effect: "weigeren", reason: decision.reason, approvalId: null };
  }

  const approvalId = `approval-${crypto.randomUUID()}`;
  draft.approvals.unshift({
    id: approvalId,
    status: "wacht_op_goedkeuring",
    actionType: payload.type,
    actor: input.actor,
    summary,
    reason: decision.reason,
    payload,
    amountCents: context.amountCents,
    customerName: context.customerName,
    createdAt: at,
    decidedAt: null,
    decidedBy: null,
    comment: null,
    lastError: null,
    example: false,
  });
  const logged = withAudit(draft, {
    at,
    actor: input.actor,
    action: payload.type,
    outcome: "wachtrij",
    summary,
    input: payload,
    output: { approvalId, reason: decision.reason },
    before: snapshot(store, payload),
    after: snapshot(store, payload),
  });
  return { store: logged, effect: "wachtrij", reason: decision.reason, approvalId };
}

export function decideApproval(
  store: StoreData,
  approvalId: string,
  decision: "goedgekeurd" | "afgewezen",
  comment: string | null,
  actor: Actor = OWNER,
  now = new Date(),
): ActionResult {
  const at = now.toISOString();
  const current = store.approvals.find((item) => item.id === approvalId);
  if (!current || current.status !== "wacht_op_goedkeuring") {
    const reason = "Dit voorstel staat niet meer open.";
    return {
      store: withAudit(store, {
        at,
        actor,
        action: current?.actionType ?? "onbekend",
        outcome: "fout",
        summary: reason,
        input: { approvalId, decision, comment },
        output: null,
        before: current ?? null,
        after: current ?? null,
        error: reason,
        comment,
      }),
      effect: "fout",
      reason,
      approvalId,
    };
  }

  if (decision === "afgewezen") {
    const draft = structuredClone(store);
    const approval = draft.approvals.find((item) => item.id === approvalId);
    if (!approval) return { store, effect: "fout", reason: "Voorstel ontbreekt.", approvalId };
    approval.status = "afgewezen";
    approval.decidedAt = at;
    approval.decidedBy = actor;
    approval.comment = comment;
    const logged = withAudit(draft, {
      at,
      actor,
      action: approval.actionType,
      outcome: "afgewezen",
      summary: approval.summary,
      input: approval.payload,
      output: null,
      before: snapshot(store, approval.payload),
      after: snapshot(store, approval.payload),
      comment,
    });
    return { store: logged, effect: "weigeren", reason: "Afgewezen.", approvalId };
  }

  const draft = structuredClone(store);
  const approval = draft.approvals.find((item) => item.id === approvalId);
  if (!approval) return { store, effect: "fout", reason: "Voorstel ontbreekt.", approvalId };
  const before = snapshot(draft, approval.payload);
  const applied = applyPayload(draft, approval.payload, now);
  if (!applied.ok) {
    approval.lastError = applied.error;
    const logged = withAudit(draft, {
      at,
      actor,
      action: approval.actionType,
      outcome: "fout",
      summary: approval.summary,
      input: approval.payload,
      output: null,
      before,
      after: before,
      error: applied.error,
      comment,
    });
    return { store: logged, effect: "fout", reason: applied.error, approvalId };
  }
  approval.status = "goedgekeurd";
  approval.decidedAt = at;
  approval.decidedBy = actor;
  approval.comment = comment;
  approval.lastError = null;
  const logged = withAudit(draft, {
    at,
    actor,
    action: approval.actionType,
    outcome: "goedgekeurd",
    summary: approval.summary,
    input: approval.payload,
    output: { approvalId },
    before,
    after: snapshot(draft, approval.payload),
    comment,
  });
  return {
    store: logged,
    effect: "uitvoeren",
    reason: "Goedgekeurd door de eigenaar.",
    approvalId,
    invoiceId: invoiceIdFrom(logged, approval.payload),
  };
}

function invoiceIdFrom(store: StoreData, payload: ActionPayload): string | null {
  if (payload.type !== "factuur_maken") return null;
  return store.invoices.find((item) => item.quoteId === payload.quoteId)?.id ?? null;
}

export function setEmergencyStop(store: StoreData, paused: boolean, actor: Actor = OWNER, now = new Date()): StoreData {
  const before = store.permissions.emergencyStop;
  const next = structuredClone(store);
  next.permissions.emergencyStop = paused;
  return withAudit(next, {
    at: now.toISOString(),
    actor,
    action: "noodstop",
    outcome: "uitgevoerd",
    summary: paused
      ? "Noodstop aan: automatische permissies zijn gepauzeerd."
      : "Noodstop uit: automatische permissies gelden weer.",
    input: { paused },
    output: { emergencyStop: paused },
    before: { emergencyStop: before },
    after: { emergencyStop: paused },
  });
}

export function proposePermissionChange(
  store: StoreData,
  rules: PermissionRule[],
  actor: Actor = OWNER,
  now = new Date(),
): { ok: true; store: StoreData; proposalId: string } | { ok: false; store: StoreData; error: string } {
  const error = validateRules(rules);
  if (error) {
    return {
      ok: false,
      error,
      store: withAudit(store, {
        at: now.toISOString(),
        actor,
        action: "permissie_wijzigen",
        outcome: "geweigerd",
        summary: error,
        input: rules,
        output: null,
        before: store.permissions.rules,
        after: store.permissions.rules,
        error,
      }),
    };
  }
  const proposalId = `perm-${crypto.randomUUID()}`;
  const proposal: PermissionProposal = {
    id: proposalId,
    status: "wacht_op_goedkeuring",
    before: structuredClone(store.permissions.rules),
    after: structuredClone(rules),
    createdAt: now.toISOString(),
    decidedAt: null,
    decidedBy: null,
    comment: null,
    requestedBy: actor,
    example: false,
  };
  const draft = structuredClone(store);
  draft.permissionProposals.unshift(proposal);
  return {
    ok: true,
    proposalId,
    store: withAudit(draft, {
      at: now.toISOString(),
      actor,
      action: "permissie_wijzigen",
      outcome: "wachtrij",
      summary: "Permissiewijziging wacht op goedkeuring van de eigenaar.",
      input: rules,
      output: { proposalId },
      before: store.permissions.rules,
      after: store.permissions.rules,
    }),
  };
}

/** Refuses to change rules unless the proposal was explicitly approved. */
export function installPermissionRules(
  store: StoreData,
  proposalId: string,
  actor: Actor = OWNER,
  now = new Date(),
): { ok: true; store: StoreData } | { ok: false; store: StoreData; error: string } {
  const proposal = store.permissionProposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "goedgekeurd") {
    const error = "Permissiewijziging zonder goedkeuring is geweigerd.";
    return {
      ok: false,
      error,
      store: withAudit(store, {
        at: now.toISOString(),
        actor,
        action: "permissie_wijzigen",
        outcome: "geweigerd",
        summary: error,
        input: { proposalId },
        output: null,
        before: store.permissions.rules,
        after: store.permissions.rules,
        error,
      }),
    };
  }
  const next = structuredClone(store);
  next.permissions.rules = structuredClone(proposal.after);
  return {
    ok: true,
    store: withAudit(next, {
      at: now.toISOString(),
      actor,
      action: "permissie_wijzigen",
      outcome: "uitgevoerd",
      summary: "Goedgekeurde permissies zijn actief.",
      input: { proposalId },
      output: proposal.after,
      before: proposal.before,
      after: proposal.after,
    }),
  };
}

export function decidePermissionProposal(
  store: StoreData,
  proposalId: string,
  decision: "goedgekeurd" | "afgewezen",
  comment: string | null,
  actor: Actor = OWNER,
  now = new Date(),
): { ok: true; store: StoreData } | { ok: false; store: StoreData; error: string } {
  const current = store.permissionProposals.find((item) => item.id === proposalId);
  if (!current || current.status !== "wacht_op_goedkeuring") {
    const error = "Dit permissievoorstel staat niet meer open.";
    return {
      ok: false,
      error,
      store: withAudit(store, {
        at: now.toISOString(),
        actor,
        action: "permissie_wijzigen",
        outcome: "fout",
        summary: error,
        input: { proposalId, decision, comment },
        output: null,
        before: current ?? null,
        after: current ?? null,
        error,
        comment,
      }),
    };
  }

  const draft = structuredClone(store);
  const proposal = draft.permissionProposals.find((item) => item.id === proposalId);
  if (!proposal) return { ok: false, store, error: "Voorstel ontbreekt." };
  proposal.comment = comment;
  proposal.decidedAt = now.toISOString();
  proposal.decidedBy = actor;

  if (decision === "afgewezen") {
    proposal.status = "afgewezen";
    return {
      ok: true,
      store: withAudit(draft, {
        at: now.toISOString(),
        actor,
        action: "permissie_wijzigen",
        outcome: "afgewezen",
        summary: "Permissiewijziging afgewezen. De oude regels blijven gelden.",
        input: proposal.after,
        output: null,
        before: proposal.before,
        after: draft.permissions.rules,
        comment,
      }),
    };
  }

  proposal.status = "goedgekeurd";
  const before = structuredClone(draft.permissions.rules);
  draft.permissions.rules = structuredClone(proposal.after);
  return {
    ok: true,
    store: withAudit(draft, {
      at: now.toISOString(),
      actor,
      action: "permissie_wijzigen",
      outcome: "goedgekeurd",
      summary: "Permissiewijziging goedgekeurd en actief.",
      input: proposal.after,
      output: proposal.after,
      before,
      after: draft.permissions.rules,
      comment,
    }),
  };
}

export function assertDirectStatusChange(status: string | undefined) {
  if (status === "verstuurd") {
    throw new PermissionError("Offerte versturen kan niet buiten de permissie om.");
  }
}

export function schedulePost(store: StoreData, postId: string, scheduledFor: string, actor: Actor, now: Date): StoreData {
  const draft = structuredClone(store);
  const post = draft.posts.find((item) => item.id === postId);
  if (!post) {
    return withAudit(store, {
      at: now.toISOString(),
      actor,
      action: "social_inplannen",
      outcome: "fout",
      summary: "Post niet gevonden.",
      input: { postId, scheduledFor },
      output: null,
      before: null,
      after: null,
      error: "Post niet gevonden.",
    });
  }
  const before = structuredClone(post);
  post.status = "ingepland";
  post.scheduledFor = scheduledFor;
  return withAudit(draft, {
    at: now.toISOString(),
    actor,
    action: "social_inplannen",
    outcome: "uitgevoerd",
    summary: "Post ingepland. Nog niet gepubliceerd.",
    input: { postId, scheduledFor },
    output: post,
    before,
    after: post,
  });
}

export function addLead(
  store: StoreData,
  lead: { source: string; name: string; note: string },
  actor: Actor,
  now: Date,
): StoreData {
  const draft = structuredClone(store);
  const entry = {
    id: `lead-${crypto.randomUUID()}`,
    at: now.toISOString(),
    source: lead.source.trim(),
    name: lead.name.trim(),
    note: lead.note.trim(),
    example: false,
  };
  draft.leads.unshift(entry);
  return withAudit(draft, {
    at: now.toISOString(),
    actor,
    action: "lead_noteren",
    outcome: "uitgevoerd",
    summary: `Lead genoteerd: ${entry.name || "zonder naam"} (${entry.source || "onbekende bron"}).`,
    input: lead,
    output: entry,
    before: null,
    after: entry,
  });
}

export function createPost(
  store: StoreData,
  post: { channel: "instagram" | "facebook" | "linkedin"; body: string },
  actor: Actor,
  now: Date,
): StoreData {
  const draft = structuredClone(store);
  const entry = {
    id: `post-${crypto.randomUUID()}`,
    status: "concept" as const,
    channel: post.channel,
    body: post.body.trim(),
    scheduledFor: null,
    publishedAt: null,
    example: false,
    simulated: true as const,
  };
  draft.posts.unshift(entry);
  return withAudit(draft, {
    at: now.toISOString(),
    actor,
    action: "social_concept",
    outcome: "uitgevoerd",
    summary: "Conceptpost opgeslagen. Publiceren gaat via de permissie.",
    input: post,
    output: entry,
    before: null,
    after: entry,
  });
}

export function buildOversightExport(store: StoreData, now = new Date()) {
  const pendingApprovals = store.approvals.filter((item) => item.status === "wacht_op_goedkeuring");
  const pendingPermissionChanges = store.permissionProposals.filter(
    (item) => item.status === "wacht_op_goedkeuring",
  );
  const errors = store.audit.filter((entry) => entry.outcome === "fout" || entry.error);
  return {
    exportedAt: now.toISOString(),
    note: "Lokaal leesbaar export voor een toezichthoudende assistent. Geen externe verbinding.",
    emergencyStop: store.permissions.emergencyStop,
    permissions: store.permissions.rules,
    pendingApprovals,
    pendingPermissionChanges,
    audit: store.audit,
    errors,
    counts: {
      pendingApprovals: pendingApprovals.length,
      pendingPermissionChanges: pendingPermissionChanges.length,
      audit: store.audit.length,
      errors: errors.length,
      recentAi: store.audit.filter((entry) => entry.actor.kind === "ai").length,
    },
  };
}

function validateRules(rules: PermissionRule[]): string | null {
  if (!Array.isArray(rules) || rules.length === 0) return "Permissies ontbreken.";
  for (const rule of rules) {
    if (!rule.actionType || !rule.mode) return "Een permissieregel is onvolledig.";
    if (rule.maxAmountCents != null && (!Number.isInteger(rule.maxAmountCents) || rule.maxAmountCents < 0)) {
      return "Maximumbedrag moet leeg zijn of een bedrag in centen.";
    }
  }
  return null;
}

function customerKey(name: string): string {
  return name.trim().toLocaleLowerCase("nl-NL");
}

function isExistingCustomer(store: StoreData, name: string, exceptQuoteId?: string): boolean {
  const key = customerKey(name);
  if (!key) return false;
  const knownQuote = store.quotes.some(
    (quote) =>
      quote.id !== exceptQuoteId &&
      customerKey(quote.customerName) === key &&
      quote.status !== "concept",
  );
  const knownInvoice = store.invoices.some((invoice) => customerKey(invoice.customerName) === key);
  return knownQuote || knownInvoice;
}

function deriveContext(
  store: StoreData,
  payload: ActionPayload,
  now: Date,
):
  | { ok: true; amountCents: number | null; existingCustomer: boolean; customerName: string | null; summary: string }
  | { ok: false; error: string } {
  if (payload.type === "bon_boeken") {
    if (!payload.description.trim()) return { ok: false, error: "Een bon heeft een omschrijving nodig." };
    if (!Number.isInteger(payload.amountCents) || payload.amountCents < 0) {
      return { ok: false, error: "Bonbedrag is ongeldig." };
    }
    return {
      ok: true,
      amountCents: payload.amountCents,
      existingCustomer: false,
      customerName: null,
      summary: `Bon boeken: ${payload.description}`,
    };
  }
  if (payload.type === "social_publiceren") {
    const post = store.posts.find((item) => item.id === payload.postId);
    if (!post) return { ok: false, error: "Post niet gevonden." };
    return {
      ok: true,
      amountCents: null,
      existingCustomer: false,
      customerName: null,
      summary: `Social post publiceren (${post.channel})`,
    };
  }
  if (payload.type === "afspraak_inplannen") {
    if (!payload.title.trim() || !payload.customerName.trim() || !payload.when.trim()) {
      return { ok: false, error: "Afspraak mist titel, klant of moment." };
    }
    return {
      ok: true,
      amountCents: null,
      existingCustomer: isExistingCustomer(store, payload.customerName),
      customerName: payload.customerName,
      summary: `Afspraak: ${payload.title}`,
    };
  }
  const quote = store.quotes.find((item) => item.id === payload.quoteId);
  if (!quote) return { ok: false, error: "Offerte niet gevonden." };
  if (payload.type === "factuur_maken") {
    const created = createInvoiceFromQuote({
      quote,
      settings: store.settings,
      existingNumbers: store.invoices.map((item) => item.number),
      existingForQuote: store.invoices.some((item) => item.quoteId === quote.id),
      now,
    });
    if (!created.ok) return { ok: false, error: created.error };
    return {
      ok: true,
      amountCents: created.invoice.totalCents,
      existingCustomer: isExistingCustomer(store, quote.customerName, quote.id),
      customerName: quote.customerName,
      summary: `Factuur maken voor ${quote.number}`,
    };
  }
  const totals = calculateTotals(quote.lines, quote.vatRate);
  return {
    ok: true,
    amountCents: totals.complete ? totals.totalCents : null,
    existingCustomer: isExistingCustomer(store, quote.customerName, quote.id),
    customerName: quote.customerName,
    summary: `Offerte versturen ${quote.number}`,
  };
}

function applyPayload(store: StoreData, payload: ActionPayload, now: Date): { ok: true } | { ok: false; error: string } {
  if (payload.type === "bon_boeken") {
    store.expenses.unshift({
      id: `expense-${crypto.randomUUID()}`,
      description: payload.description.trim(),
      amountCents: payload.amountCents,
      bookedAt: now.toISOString(),
      example: false,
      simulated: true,
    });
    return { ok: true };
  }
  if (payload.type === "social_publiceren") {
    const post = store.posts.find((item) => item.id === payload.postId);
    if (!post) return { ok: false, error: "Post niet gevonden." };
    if (post.status === "gepubliceerd") return { ok: false, error: "Deze post is al gepubliceerd." };
    post.status = "gepubliceerd";
    post.publishedAt = now.toISOString();
    return { ok: true };
  }
  if (payload.type === "afspraak_inplannen") {
    store.appointments.unshift({
      id: `appointment-${crypto.randomUUID()}`,
      title: payload.title.trim(),
      customerName: payload.customerName.trim(),
      when: payload.when.trim(),
      quoteId: payload.quoteId,
      createdAt: now.toISOString(),
      example: false,
      simulated: true,
    });
    return { ok: true };
  }
  const index = store.quotes.findIndex((item) => item.id === payload.quoteId);
  if (index < 0) return { ok: false, error: "Offerte niet gevonden." };
  const quote = store.quotes[index];
  if (payload.type === "offerte_versturen") {
    try {
      store.quotes[index] = updateQuote(quote, { status: "verstuurd" }, now);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof QuoteInputError ? error.message : "Versturen mislukt." };
    }
  }
  const created = createInvoiceFromQuote({
    quote,
    settings: store.settings,
    existingNumbers: store.invoices.map((item) => item.number),
    existingForQuote: store.invoices.some((item) => item.quoteId === quote.id),
    now,
  });
  if (!created.ok) return { ok: false, error: created.error };
  store.invoices.unshift(created.invoice);
  return { ok: true };
}

function snapshot(store: StoreData, payload: ActionPayload): unknown {
  if (payload.type === "bon_boeken") return { expenses: store.expenses.length };
  if (payload.type === "social_publiceren") {
    return store.posts.find((item) => item.id === payload.postId) ?? null;
  }
  if (payload.type === "afspraak_inplannen") return { appointments: store.appointments.length };
  if (payload.type === "offerte_versturen") {
    const quote = store.quotes.find((item) => item.id === payload.quoteId);
    return quote ? { id: quote.id, status: quote.status } : null;
  }
  return {
    invoices: store.invoices.length,
    quote: store.quotes.find((item) => item.id === payload.quoteId)?.status ?? null,
  };
}
