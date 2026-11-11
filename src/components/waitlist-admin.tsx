"use client";

import type { StoredWaitlistEntry } from "@/lib/waitlist/schema";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function WaitlistAdmin({ entries }: { entries: StoredWaitlistEntry[] }) {
  function download() {
    const header = ["aangemaakt", "naam", "email", "bedrijf", "branche", "medewerkers", "land", "pakket", "tijd"];
    const lines = entries.map((entry) =>
      [entry.createdAt, entry.name, entry.email, entry.company, entry.industry, entry.employees, entry.country, entry.plan ?? "", entry.timePain]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wachtlijst.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Wachtlijst</p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            {entries.length === 1 ? "1 aanmelding" : `${entries.length} aanmeldingen`}
          </h1>
        </div>
        <button type="button" onClick={download} className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold">
          CSV-export
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">Nog niemand op de lijst.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Aanmeldingen voor early access</caption>
            <thead className="text-muted-foreground">
              <tr>
                {["Datum", "Naam", "E-mail", "Bedrijf", "Branche", "Medewerkers", "Land", "Pakket"].map((label) => (
                  <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-3 py-3 whitespace-nowrap">{entry.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-3">{entry.name}</td>
                  <td className="px-3 py-3">{entry.email}</td>
                  <td className="px-3 py-3">{entry.company || "—"}</td>
                  <td className="px-3 py-3">{entry.industry}</td>
                  <td className="px-3 py-3">{entry.employees}</td>
                  <td className="px-3 py-3">{entry.country}</td>
                  <td className="px-3 py-3">{entry.plan ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
