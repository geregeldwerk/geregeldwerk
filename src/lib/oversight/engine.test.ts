import { describe, expect, it } from "vitest";
import type { ActionPayload, Quote, StoreData } from "@/lib/domain/types";
import {
  decideApproval,
  decidePermissionProposal,
  installPermissionRules,
  proposePermissionChange,
  requestAction,
  setEmergencyStop,
  auditEntryIsComplete,
} from "@/lib/oversight/engine";
import { defaultPermissions, defaultRule, isWithinBusinessHours, OWNER } from "@/lib/oversight/permissions";
import { createSeedSettings } from "@/lib/storage/seed";

const DURING_HOURS = new Date("2026-03-18T09:00:00.000Z");
const AFTER_HOURS = new Date("2026-03-18T18:00:00.000Z");
const SATURDAY = new Date("2026-03-21T09:00:00.000Z");

function baseStore(): StoreData {
  return {
    quotes: [],
    tasks: [],
    settings: createSeedSettings(),
    permissions: defaultPermissions(),
    approvals: [],
    permissionProposals: [],
    audit: [],
    invoices: [],
    expenses: [],
    appointments: [],
    posts: [],
    leads: [],
  };
}

function quote(partial: Partial<Quote> & Pick<Quote, "id" | "customerName" | "status">): Quote {
  return {
    number: "OFF-2026-010",
    example: false,
    customerPhone: "",
    customerEmail: "",
    location: "Hulst",
    jobDescription: "Werk",
    requestedDate: "morgen",
    sourceText: "fictief",
    lines: [
      {
        id: "l1",
        description: "Werk",
        quantity: 1,
        unit: "stuk",
        unitPriceCents: partial.lines?.[0]?.unitPriceCents ?? 10000,
      },
    ],
    notes: "",
    vatRate: 0.21,
    createdAt: DURING_HOURS.toISOString(),
    updatedAt: DURING_HOURS.toISOString(),
    ...partial,
  };
}

function bon(amountCents: number): ActionPayload {
  return { type: "bon_boeken", description: "Fictief gereedschap", amountCents };
}

describe("werktijden", () => {
  const rule = defaultRule("offerte_versturen");

  it("herkent kantooruren in Amsterdam", () => {
    expect(isWithinBusinessHours(DURING_HOURS, rule)).toBe(true);
    expect(isWithinBusinessHours(AFTER_HOURS, rule)).toBe(false);
    expect(isWithinBusinessHours(SATURDAY, rule)).toBe(false);
  });
});

describe("staande permissies", () => {
  it("voert een bon binnen de grens direct uit en logt dat", () => {
    const store = baseStore();
    const result = requestAction(store, { actor: OWNER, payload: bon(4000) }, DURING_HOURS);

    expect(result.effect).toBe("uitvoeren");
    expect(result.store.expenses).toHaveLength(1);
    expect(result.store.expenses[0]?.amountCents).toBe(4000);
    expect(result.store.approvals).toHaveLength(0);
    expect(result.store.audit.at(-1)).toMatchObject({
      action: "bon_boeken",
      outcome: "uitgevoerd",
      actor: OWNER,
    });
    expect(store.expenses).toHaveLength(0);
  });

  it("zet een bon boven het maximum in de wachtrij zonder te boeken", () => {
    const store = baseStore();
    const result = requestAction(store, { actor: OWNER, payload: bon(12000) }, DURING_HOURS);

    expect(result.effect).toBe("wachtrij");
    expect(result.reason).toMatch(/boven het maximum/);
    expect(result.store.expenses).toHaveLength(0);
    expect(result.store.approvals[0]?.status).toBe("wacht_op_goedkeuring");
    expect(result.store.audit.at(-1)?.outcome).toBe("wachtrij");
  });

  it("stuurt een offerte van een bestaande klant binnen bedrag en tijd direct", () => {
    const store = baseStore();
    store.quotes.push(
      quote({ id: "bekend", customerName: "Pieter de Vries", status: "verstuurd" }),
      quote({ id: "nieuw", customerName: "Pieter de Vries", status: "concept", number: "OFF-2026-011" }),
    );
    const result = requestAction(
      store,
      { actor: OWNER, payload: { type: "offerte_versturen", quoteId: "nieuw" } },
      DURING_HOURS,
    );

    expect(result.effect).toBe("uitvoeren");
    expect(result.store.quotes.find((item) => item.id === "nieuw")?.status).toBe("verstuurd");
  });

  it("houdt een offerte buiten de grenzen in de wachtrij", () => {
    const store = baseStore();
    store.quotes.push(quote({ id: "duur", customerName: "Pieter de Vries", status: "concept" }));
    store.quotes[0].lines[0].unitPriceCents = 80000;
    store.quotes.push(quote({ id: "bekend", customerName: "Pieter de Vries", status: "verstuurd", number: "OFF-2026-001" }));

    const tooHigh = requestAction(
      store,
      { actor: OWNER, payload: { type: "offerte_versturen", quoteId: "duur" } },
      DURING_HOURS,
    );
    expect(tooHigh.effect).toBe("wachtrij");
    expect(tooHigh.store.quotes.find((item) => item.id === "duur")?.status).toBe("concept");

    const weekend = requestAction(
      store,
      { actor: OWNER, payload: { type: "offerte_versturen", quoteId: "duur" } },
      SATURDAY,
    );
    expect(weekend.reason).toMatch(/boven het maximum|Buiten werktijd/);

    const stranger = baseStore();
    stranger.quotes.push(quote({ id: "onbekend", customerName: "Nieuwe Klant", status: "concept" }));
    const queued = requestAction(
      stranger,
      { actor: OWNER, payload: { type: "offerte_versturen", quoteId: "onbekend" } },
      DURING_HOURS,
    );
    expect(queued.effect).toBe("wachtrij");
    expect(queued.reason).toMatch(/bestaande klanten/);
    expect(queued.store.quotes[0]?.status).toBe("concept");
  });

  it("pauzeert automatische acties met de noodstop", () => {
    let store = baseStore();
    store = setEmergencyStop(store, true, OWNER, DURING_HOURS);
    const paused = requestAction(store, { actor: OWNER, payload: bon(4000) }, DURING_HOURS);

    expect(store.permissions.emergencyStop).toBe(true);
    expect(store.permissions.rules.find((rule) => rule.actionType === "bon_boeken")?.mode).toBe("automatisch");
    expect(paused.effect).toBe("wachtrij");
    expect(paused.reason).toMatch(/Noodstop/);
    expect(paused.store.expenses).toHaveLength(0);

    const resumed = setEmergencyStop(paused.store, false, OWNER, DURING_HOURS);
    const again = requestAction(resumed, { actor: OWNER, payload: bon(4000) }, DURING_HOURS);
    expect(again.effect).toBe("uitvoeren");
    expect(again.store.expenses).toHaveLength(1);
  });

  it("weigert een permissiewijziging zonder goedkeuring", () => {
    const store = baseStore();
    const before = structuredClone(store.permissions.rules);
    const after = before.map((rule) =>
      rule.actionType === "bon_boeken" ? { ...rule, maxAmountCents: 20000 } : rule,
    );
    const proposed = proposePermissionChange(store, after, OWNER, DURING_HOURS);

    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.store.permissions.rules).toEqual(before);
    expect(proposed.store.audit.at(-1)).toMatchObject({
      action: "permissie_wijzigen",
      outcome: "wachtrij",
    });

    const refused = installPermissionRules(proposed.store, proposed.proposalId, OWNER, DURING_HOURS);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error).toMatch(/zonder goedkeuring/);
    expect(refused.store.permissions.rules).toEqual(before);
    expect(refused.store.audit.at(-1)?.outcome).toBe("geweigerd");

    const approved = decidePermissionProposal(
      proposed.store,
      proposed.proposalId,
      "goedgekeurd",
      "Akkoord, hoger maximum.",
      OWNER,
      DURING_HOURS,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.store.permissions.rules.find((rule) => rule.actionType === "bon_boeken")?.maxAmountCents).toBe(
      20000,
    );
    expect(approved.store.audit.at(-1)).toMatchObject({
      action: "permissie_wijzigen",
      outcome: "goedgekeurd",
      comment: "Akkoord, hoger maximum.",
    });
  });

  it("keurt een wachtrij-actie goed of af zonder stiekem te boeken", () => {
    const queued = requestAction(baseStore(), { actor: OWNER, payload: bon(12000) }, DURING_HOURS);
    expect(queued.approvalId).toBeTruthy();

    const rejected = decideApproval(queued.store, queued.approvalId ?? "", "afgewezen", "te duur", OWNER, DURING_HOURS);
    expect(rejected.store.expenses).toHaveLength(0);
    expect(rejected.store.approvals[0]?.status).toBe("afgewezen");

    const approved = decideApproval(queued.store, queued.approvalId ?? "", "goedgekeurd", null, OWNER, DURING_HOURS);
    expect(approved.effect).toBe("uitvoeren");
    expect(approved.store.expenses).toHaveLength(1);
    expect(approved.store.approvals[0]?.status).toBe("goedgekeurd");
  });

  it("legt elke stap vast in een append-only auditlog", () => {
    let store = baseStore();
    store = requestAction(store, { actor: OWNER, payload: bon(4000) }, DURING_HOURS).store;
    const prefix = store.audit.map((entry) => entry.id);

    store = requestAction(store, { actor: OWNER, payload: bon(12000) }, DURING_HOURS).store;
    store = setEmergencyStop(store, true, OWNER, DURING_HOURS);
    store = requestAction(store, { actor: OWNER, payload: bon(4000) }, DURING_HOURS).store;
    const proposed = proposePermissionChange(
      store,
      store.permissions.rules.map((rule) =>
        rule.actionType === "social_publiceren" ? { ...rule, mode: "uit" } : rule,
      ),
      OWNER,
      DURING_HOURS,
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    store = installPermissionRules(proposed.store, proposed.proposalId, OWNER, DURING_HOURS).store;

    expect(store.audit.map((entry) => entry.id).slice(0, prefix.length)).toEqual(prefix);
    expect(store.audit.length).toBeGreaterThan(prefix.length);
    expect(store.audit.map((entry) => entry.outcome)).toEqual(
      expect.arrayContaining(["uitgevoerd", "wachtrij", "geweigerd"]),
    );
    for (const entry of store.audit) {
      expect(auditEntryIsComplete(entry)).toBe(true);
      expect(entry.at).toBeTruthy();
      expect(entry.actor.kind === "mens" || entry.actor.kind === "ai").toBe(true);
      expect(entry.input).not.toBeUndefined();
      expect(entry.before).not.toBeUndefined();
      expect(entry.after).not.toBeUndefined();
    }
    expect(new Set(store.audit.map((entry) => entry.id)).size).toBe(store.audit.length);
  });
});
