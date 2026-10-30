import { describe, expect, it } from "vitest";
import { extractFromMessage } from "@/lib/domain/extract";
import { buildDraftQuote } from "@/lib/domain/quote";
import { sanitizeExtraction } from "@/lib/domain/sanitize";

const CV_MESSAGE =
  "Klant Jansen in Hulst wil een nieuwe cv-ketel, ophangen en oude afvoeren, graag offerte";

describe("extractFromMessage", () => {
  it("leest de cv-ketel-zin uit tot klant, plaats en regels zonder prijs", () => {
    const result = extractFromMessage(CV_MESSAGE);

    expect(result.customerName).toBe("Jansen");
    expect(result.location).toBe("Hulst");
    expect(result.requestedDate).toBeNull();
    expect(result.customerPhone).toBeNull();
    expect(result.lineItems).toEqual([
      { description: "CV-ketel leveren", quantity: 1, unit: "stuk" },
      { description: "CV-ketel ophangen", quantity: 1, unit: "stuk" },
      { description: "Oude CV-ketel afvoeren", quantity: 1, unit: "stuk" },
    ]);
    expect(result.lineItems.some((line) => line.description === "Afvoer")).toBe(false);
    expect(result.missingInfo).toEqual(
      expect.arrayContaining([
        "Gewenste uitvoerdatum ontbreekt",
        "Contactgegevens (telefoon of e-mail) ontbreken",
        "Type of merk van het toestel ontbreekt",
      ]),
    );
    expect(result.missingInfo.some((item) => item.startsWith("Klantnaam"))).toBe(false);
    expect(result.followUp?.title).toContain("Jansen");
    for (const line of result.lineItems) {
      expect(Object.keys(line).sort()).toEqual(["description", "quantity", "unit"]);
    }
  });

  it("leest een geplakt WhatsApp-bericht", () => {
    const result = extractFromMessage(
      [
        "Hoi, met Pieter de Vries uit Goes.",
        "Kunnen jullie volgende week dinsdag langskomen?",
        "De keukenkraan lekt en de afvoer onder de spoelbak is verstopt.",
        "Groet, Pieter",
        "06-00000000",
      ].join("\n"),
    );

    expect(result.customerName).toBe("Pieter de Vries");
    expect(result.location).toBe("Goes");
    expect(result.customerPhone).toBe("06-00000000");
    expect(result.requestedDate).toBe("volgende week dinsdag");
    expect(result.lineItems.map((line) => line.description)).toEqual([
      "Keukenkraan repareren",
      "Afvoer ontstoppen",
    ]);
    expect(result.missingInfo.some((item) => item.includes("Contactgegevens"))).toBe(false);
  });

  it("pakt aantal, datum en aanspreekvorm bij stopcontacten", () => {
    const result = extractFromMessage(
      "Mevrouw De Test in Terneuzen wil 3 stopcontacten bijplaatsen in de woonkamer, graag prijsopgave voor vrijdag 12 juni.",
    );

    expect(result.customerName).toBe("Mevrouw De Test");
    expect(result.location).toBe("Terneuzen");
    expect(result.requestedDate).toBe("vrijdag 12 juni");
    expect(result.lineItems).toEqual([
      { description: "Stopcontact bijplaatsen", quantity: 3, unit: "stuk" },
    ]);
    expect(result.location).not.toContain("woonkamer");
  });

  it("neemt geen bedrag over uit het bericht", () => {
    const text = "Klant Jansen in Hulst wil een kraan vervangen. Reken maar op ongeveer 150 euro.";
    const result = extractFromMessage(text);

    expect(JSON.stringify(result)).not.toMatch(/150/);
    expect(result.missingInfo.some((item) => /bedrag/i.test(item))).toBe(true);
    expect(result.lineItems.map((line) => line.description)).toEqual(["Kraan vervangen"]);

    const quote = buildDraftQuote(result, {
      sourceText: text,
      vatRate: 0.21,
      existingNumbers: [],
      now: new Date("2026-04-01T00:00:00.000Z"),
      id: "q-prijs",
    });
    expect(quote.lines.every((line) => line.unitPriceCents === null)).toBe(true);
  });

  it("markeert een vaag bericht als onvolledig en verzint geen regels", () => {
    const result = extractFromMessage("Kun je even langskomen?");

    expect(result.customerName).toBeNull();
    expect(result.location).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.missingInfo).toEqual(
      expect.arrayContaining([
        "Klantnaam ontbreekt",
        "Plaats of adres ontbreekt",
        "Contactgegevens (telefoon of e-mail) ontbreken",
        "Gewenste uitvoerdatum ontbreekt",
        "Geen concrete werkzaamheden herkend",
      ]),
    );
    expect(result.followUp?.title).toContain("de klant");
  });

  it("leest straat, aantal en afvoer van oude radiatoren", () => {
    const result = extractFromMessage(
      "Familie Vermeer, Voorbeeldstraat 12 in Middelburg. Twee radiatoren vervangen en de oude meenemen.",
    );

    expect(result.customerName).toBe("Familie Vermeer");
    expect(result.location).toBe("Voorbeeldstraat 12, Middelburg");
    expect(result.lineItems).toEqual([
      { description: "Radiator vervangen", quantity: 2, unit: "stuk" },
      { description: "Oude Radiator afvoeren", quantity: 2, unit: "stuk" },
    ]);
  });

  it("geeft bij een leeg bericht geen herinnering en wel de gaten", () => {
    const result = extractFromMessage("   ");
    expect(result.followUp).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.missingInfo.length).toBeGreaterThan(0);
  });
});

describe("sanitizeExtraction", () => {
  it("gooit verzonnen klant, plaats, datum en prijzen weg", () => {
    const source = "Klant Jansen in Hulst wil een kraan.";
    const result = sanitizeExtraction(
      {
        customerName: "Verzonnen Persoon",
        location: "Parijs",
        requestedDate: "morgen",
        jobDescription: "Gouden kraan leveren",
        lineItems: [
          {
            description: "Gouden kraan leveren",
            quantity: 1,
            unit: "stuk",
            unitPrice: 99900,
            price: 12,
          },
          { description: "Kraan vervangen", quantity: 1, unit: "stuk", amount: 10 },
        ],
        missingInfo: [],
      },
      source,
    );

    expect(result.customerName).toBeNull();
    expect(result.location).toBeNull();
    expect(result.requestedDate).toBeNull();
    expect(result.lineItems).toEqual([
      { description: "Kraan vervangen", quantity: 1, unit: "stuk" },
    ]);
    expect(JSON.stringify(result.lineItems)).not.toMatch(/99900|unitPrice|amount/);
    expect(result.missingInfo.length).toBeGreaterThan(0);
    expect(result.missingInfo.some((item) => item.startsWith("Klantnaam"))).toBe(true);
  });

  it("houdt een naam alleen als die in het bericht staat", () => {
    const result = sanitizeExtraction(
      {
        customerName: "Jansen",
        location: "Hulst",
        lineItems: [{ description: "Kraan repareren", quantity: 1, unit: "stuk" }],
      },
      "Klant Jansen in Hulst wil de kraan repareren.",
    );

    expect(result.customerName).toBe("Jansen");
    expect(result.location).toBe("Hulst");
    expect(result.lineItems[0]?.description).toBe("Kraan repareren");
  });
});
