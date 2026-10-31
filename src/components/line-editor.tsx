"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyLine, type LineDraft } from "@/lib/domain/lines";
import { centsToInput, formatEuro, lineTotalCents, parseEuroToCents, parseQuantity } from "@/lib/domain/money";
import { UNITS } from "@/lib/domain/types";

export function LineEditor({
  lines,
  onChange,
}: {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
}) {
  function update(key: string, patch: Partial<LineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => {
        const quantity = parseQuantity(line.quantity);
        const cents = line.price.trim() ? parseEuroToCents(line.price) : null;
        const total = quantity != null && cents != null ? formatEuro(lineTotalCents(quantity, cents)) : "—";
        const priceMissing = line.price.trim() === "";
        return (
          <fieldset key={line.key} className="rounded-xl border border-border bg-card p-3">
            <legend className="px-1 text-xs text-muted-foreground">Regel {index + 1}</legend>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`${line.key}-description`}>Omschrijving</Label>
                <Input
                  id={`${line.key}-description`}
                  className="mt-1.5 h-10"
                  value={line.description}
                  onChange={(event) => update(line.key, { description: event.target.value })}
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-6 shrink-0"
                onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
              >
                Verwijder
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <Label htmlFor={`${line.key}-qty`}>Aantal</Label>
                <Input
                  id={`${line.key}-qty`}
                  className="mt-1.5 h-10"
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`${line.key}-unit`}>Eenheid</Label>
                <select
                  id={`${line.key}-unit`}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={line.unit}
                  onChange={(event) => update(line.key, { unit: event.target.value })}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  {UNITS.includes(line.unit as (typeof UNITS)[number]) ? null : (
                    <option value={line.unit}>{line.unit}</option>
                  )}
                </select>
              </div>
              <div>
                <Label htmlFor={`${line.key}-price`}>Prijs per eenheid</Label>
                <Input
                  id={`${line.key}-price`}
                  className="mt-1.5 h-10"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.price}
                  onChange={(event) => update(line.key, { price: event.target.value })}
                  onBlur={() => {
                    const parsed = parseEuroToCents(line.price);
                    if (parsed != null) update(line.key, { price: centsToInput(parsed) });
                  }}
                />
              </div>
              <div>
                <p className="text-sm font-medium">Regeltotaal</p>
                <p className="mt-2 text-sm tabular-nums">{total}</p>
              </div>
            </div>
            {priceMissing ? (
              <p className="mt-2 text-xs text-warning-foreground">Prijs ontbreekt. Vul zelf een bedrag in.</p>
            ) : null}
          </fieldset>
        );
      })}
      <Button type="button" variant="outline" className="h-10 self-start" onClick={() => onChange([...lines, emptyLine()])}>
        Regel toevoegen
      </Button>
    </div>
  );
}
