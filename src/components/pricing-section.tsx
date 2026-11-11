"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandCheck } from "@/components/brand-check";
import { formatAddonPrice, formatPriceCents } from "@/lib/billing/format";
import type { BillingCatalog, BillingInterval, Plan } from "@/lib/billing/types";

export function PricingSection({ catalog }: { catalog: BillingCatalog }) {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Facturatieperiode" className="inline-flex rounded-full border border-border bg-card p-1">
          <PeriodButton pressed={interval === "month"} onClick={() => setInterval("month")}>
            Maand
          </PeriodButton>
          <PeriodButton pressed={interval === "year"} onClick={() => setInterval("year")}>
            Jaar
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-primary normal-case">
              {catalog.yearlyDiscountLabel}
            </span>
          </PeriodButton>
        </div>
        <p className="text-sm text-muted-foreground">{catalog.vatNote}</p>
      </div>

      <ul className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {catalog.plans.map((plan) => (
          <li key={plan.id}>
            <article
              className={
                plan.highlighted
                  ? "flex h-full flex-col rounded-3xl border border-primary bg-card p-5 shadow-md shadow-primary/10"
                  : "flex h-full flex-col rounded-3xl border border-border bg-card p-5"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-xl">{plan.name}</h3>
                {plan.badge ? (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{plan.badge}</span>
                ) : null}
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{priceLine(plan, interval)}</p>
              {interval === "year" && plan.yearlyPriceCents != null ? (
                <p className="mt-1 text-sm font-semibold text-primary">{catalog.yearlyDiscountLabel}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{plan.monthlyPriceCents == null ? "Samenstelling op maat" : "Exclusief btw"}</p>
              )}
              <ul className="mt-5 grid gap-1 text-sm">
                {plan.limits.map((item) => (
                  <li key={item.key} className="text-foreground">
                    {item.display}
                  </li>
                ))}
              </ul>
              <ul className="mt-5 grid flex-1 gap-2 border-t border-border pt-5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature.key} className="flex items-start gap-2">
                    <BrandCheck className="mt-0.5" />
                    <span>{feature.label}</span>
                  </li>
                ))}
              </ul>
              <PlanCta plan={plan} mailto={catalog.enterpriseMailto} />
            </article>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="px-4 py-4 text-left font-heading text-xl">Vergelijk de limieten</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Limiet</th>
              {catalog.plans.map((plan) => (
                <th key={plan.id} scope="col" className="px-4 py-3 font-medium">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.plans[0].limits.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th scope="row" className="bg-transparent px-4 py-3 font-medium">{row.label}</th>
                {catalog.plans.map((plan) => {
                  const cell = plan.limits.find((item) => item.key === row.key);
                  return (
                    <td key={plan.id} className="px-4 py-3">
                      {cell ? cellValue(cell) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="uitbreidingen" className="scroll-mt-28">
        <h3 className="font-heading text-2xl">Uitbreidingen</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Voor alle pakketten. Je voegt ze later toe; afrekenen zit nog niet op deze pagina.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.addons.map((addon) => (
            <li key={addon.id} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm">{addon.name}</p>
              <p className="mt-1 text-lg font-semibold">{formatAddonPrice(addon)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{catalog.priceFootnote}</p>
      </div>
    </div>
  );
}

function PeriodButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground"
      }
    >
      {children}
    </button>
  );
}

function priceLine(plan: Plan, interval: BillingInterval): string {
  if (plan.monthlyPriceCents == null || plan.yearlyPriceCents == null) return "Prijs op aanvraag";
  if (interval === "year") return `${formatPriceCents(plan.yearlyPriceCents)}/jaar`;
  return `${formatPriceCents(plan.monthlyPriceCents)}/maand`;
}

function cellValue(cell: Plan["limits"][number]): string {
  if (cell.unlimited) return "Onbeperkt";
  if (cell.custom || cell.value == null) return "Aangepast";
  if (cell.key === "storageGb") return `${cell.value} GB`;
  return String(cell.value);
}

function PlanCta({ plan, mailto }: { plan: Plan; mailto: string }) {
  const className = plan.highlighted
    ? "mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
    : "mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:border-primary/40";
  if (plan.id === "enterprise") {
    return (
      <a href={mailto} className={className}>
        {plan.cta.label}
      </a>
    );
  }
  return (
    <Link href={plan.cta.href} className={className}>
      {plan.cta.label}
    </Link>
  );
}
