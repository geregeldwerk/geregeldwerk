import { DOMParser, type Document as XmlDocument, type Element as XmlElement } from "@xmldom/xmldom";
import {
  isBelgianEnterpriseNumber,
  isBelgianVat,
  isDutchKvkCompact,
  isDutchVat,
  isValidIban,
} from "@/lib/peppol/identifiers";
import {
  ALLOWED_UNIT_CODES,
  CUSTOMIZATION_ID,
  PROFILE_ID,
  SUPPORTED_ENDPOINT_SCHEMES,
  VAT_PERCENTS,
  parseMoney,
  vatCentsFromTaxable,
} from "@/lib/peppol/spec";

export interface PeppolIssue {
  rule: string;
  message: string;
}

/**
 * Afgebakende controle op de EN 16931- en Peppol-regels die voor NL/BE-facturen
 * uit deze app gelden (BIS Billing 3.0.21). De volledige CEN- en Peppol-Schematron
 * en de UBL-XSD draaien hier niet: die hebben een XSLT 2-processor en een grote
 * artefactenset, en er wordt geen externe validatiedienst aangeroepen.
 * Elke melding noemt het officiële regelnummer, of een GW-regel als de eis van
 * deze app komt (tarieven NL/BE, intracommunautair tussen NL en BE).
 */
export function validatePeppolInvoice(xml: string): PeppolIssue[] {
  const parsed = parseXml(xml);
  if ("issues" in parsed) return parsed.issues;
  return validateDocument(parsed.doc);
}

export function formatPeppolError(issues: PeppolIssue[]): string {
  if (issues.length === 0) return "De e-factuur is niet geldig.";
  if (issues.length === 1) return issues[0].message;
  return `De e-factuur is niet geldig. ${issues.map((issue) => issue.message).join(" ")}`;
}

function parseXml(xml: string): { doc: XmlDocument } | { issues: PeppolIssue[] } {
  const unreadable: PeppolIssue = {
    rule: "GW-XML-01",
    message: "De XML is niet leesbaar als UBL-factuur. Controleer of het bestand heel is.",
  };
  try {
    const problems: string[] = [];
    const doc = new DOMParser({
      onError: (level, message) => {
        if (level === "error" || level === "fatalError") problems.push(message);
      },
    }).parseFromString(xml, "application/xml");
    if (problems.length > 0 || !doc.documentElement || localName(doc.documentElement) === "parsererror") {
      return { issues: [unreadable] };
    }
    return { doc };
  } catch {
    return { issues: [unreadable] };
  }
}

function validateDocument(doc: XmlDocument): PeppolIssue[] {
  const issues: PeppolIssue[] = [];
  const invoice = doc.documentElement;
  if (!invoice || localName(invoice) !== "Invoice") {
    issues.push({ rule: "GW-XML-01", message: "Het bestand is geen UBL Invoice." });
    return issues;
  }

  walkEmpty(invoice, issues);

  const customization = textOf(child(invoice, "CustomizationID"));
  if (!customization) {
    issues.push({ rule: "BR-01", message: "De specificatie-identifier ontbreekt (BR-01)." });
  } else if (customization !== CUSTOMIZATION_ID) {
    issues.push({
      rule: "PEPPOL-EN16931-R004",
      message:
        "De specificatie-identifier moet exact de Peppol BIS Billing 3.0-waarde zijn, zonder versienummer (PEPPOL-EN16931-R004).",
    });
  }

  const profile = textOf(child(invoice, "ProfileID"));
  if (!profile) {
    issues.push({ rule: "PEPPOL-EN16931-R001", message: "Het bedrijfsproces ontbreekt (PEPPOL-EN16931-R001)." });
  } else if (profile !== PROFILE_ID) {
    issues.push({
      rule: "PEPPOL-EN16931-R007",
      message: "Het bedrijfsproces moet het Peppol-factuurproces 01 zijn (PEPPOL-EN16931-R007).",
    });
  }

  if (children(invoice, "Note").length > 1) {
    issues.push({
      rule: "PEPPOL-EN16931-R002",
      message: "Er mag maar één opmerking op factuurniveau staan (PEPPOL-EN16931-R002).",
    });
  }

  if (!textOf(child(invoice, "ID"))) {
    issues.push({ rule: "BR-02", message: "Het factuurnummer ontbreekt (BR-02)." });
  }
  const issueDate = textOf(child(invoice, "IssueDate"));
  if (!isIsoDate(issueDate)) {
    issues.push({ rule: "BR-03", message: "De factuurdatum ontbreekt of heeft niet de vorm jjjj-mm-dd (BR-03)." });
  }
  if (textOf(child(invoice, "InvoiceTypeCode")) !== "380") {
    issues.push({ rule: "BR-04", message: "Het factuurtype moet 380 (handelsfactuur) zijn (BR-04)." });
  }
  if (textOf(child(invoice, "DocumentCurrencyCode")) !== "EUR") {
    issues.push({ rule: "BR-05", message: "De factuurvaluta moet EUR zijn (BR-05)." });
  }
  const dueDate = textOf(child(invoice, "DueDate"));
  if (dueDate && !isIsoDate(dueDate)) {
    issues.push({ rule: "PEPPOL-COMMON-R030", message: "De vervaldatum moet de vorm jjjj-mm-dd hebben (PEPPOL-COMMON-R030)." });
  }
  if (!textOf(child(invoice, "BuyerReference")) && !orderReference(invoice)) {
    issues.push({
      rule: "PEPPOL-EN16931-R003",
      message: "Een koperreferentie of ordernummer is verplicht (PEPPOL-EN16931-R003).",
    });
  }

  const supplierParty = partyOf(invoice, "AccountingSupplierParty");
  const buyerParty = partyOf(invoice, "AccountingCustomerParty");
  const seller = readParty(supplierParty);
  const buyer = readParty(buyerParty);

  if (!seller.name) issues.push({ rule: "BR-06", message: "De naam van de verkoper ontbreekt (BR-06)." });
  if (!buyer.name) issues.push({ rule: "BR-07", message: "De naam van de koper ontbreekt (BR-07)." });
  if (!seller.country) issues.push({ rule: "BR-09", message: "Het land van de verkoper ontbreekt (BR-09)." });
  if (!buyer.country) issues.push({ rule: "BR-11", message: "Het land van de koper ontbreekt (BR-11)." });
  if (!supplierParty || !child(supplierParty, "PostalAddress")) {
    issues.push({ rule: "BR-08", message: "Het adres van de verkoper ontbreekt (BR-08)." });
  }
  if (!buyerParty || !child(buyerParty, "PostalAddress")) {
    issues.push({ rule: "BR-10", message: "Het adres van de koper ontbreekt (BR-10)." });
  }

  if (!seller.endpointId) {
    issues.push({
      rule: "PEPPOL-EN16931-R020",
      message: "Het elektronisch adres (Peppol endpoint) van de verkoper ontbreekt (PEPPOL-EN16931-R020).",
    });
  } else {
    checkEndpoint(seller.endpointScheme, seller.endpointId, "verkoper", issues);
  }
  if (!buyer.endpointId) {
    issues.push({
      rule: "PEPPOL-EN16931-R010",
      message: "Het elektronisch adres (Peppol endpoint) van de koper ontbreekt (PEPPOL-EN16931-R010).",
    });
  } else {
    checkEndpoint(buyer.endpointScheme, buyer.endpointId, "koper", issues);
  }

  checkVatIdentifier(seller.vatNumber, "verkoper", issues);
  checkVatIdentifier(buyer.vatNumber, "koper", issues);
  if (seller.legalScheme === "0208" || seller.legalScheme === "0106" || seller.legalScheme === "0190") {
    checkEndpoint(seller.legalScheme, seller.legalId, "verkoper", issues);
  }
  if (buyer.legalScheme === "0208" || buyer.legalScheme === "0106" || buyer.legalScheme === "0190") {
    checkEndpoint(buyer.legalScheme, buyer.legalId, "koper", issues);
  }
  if (!seller.vatNumber && !seller.legalId) {
    issues.push({
      rule: "BR-CO-26",
      message: "De verkoper heeft een btw-nummer of een inschrijvingsnummer nodig (BR-CO-26).",
    });
  }

  if (seller.country === "NL") {
    if (!seller.street || !seller.city || !seller.postal) {
      issues.push({
        rule: "NL-R-002",
        message: "Een Nederlandse verkoper moet straat, postcode en plaats vermelden (NL-R-002).",
      });
    }
    if (seller.legalScheme !== "0106" && seller.legalScheme !== "0190") {
      issues.push({
        rule: "NL-R-003",
        message: "Het inschrijvingsnummer van een Nederlandse verkoper moet een KvK-nummer (0106) of OIN (0190) zijn (NL-R-003).",
      });
    }
  }
  if (seller.country === "NL" && buyer.country === "NL") {
    if (!buyer.street || !buyer.city || !buyer.postal) {
      issues.push({
        rule: "NL-R-004",
        message: "Bij een Nederlandse koper moeten straat, postcode en plaats ingevuld zijn (NL-R-004).",
      });
    }
    if (buyer.legalScheme !== "0106" && buyer.legalScheme !== "0190") {
      issues.push({
        rule: "NL-R-005",
        message: "Het inschrijvingsnummer van een Nederlandse koper moet een KvK-nummer (0106) of OIN (0190) zijn (NL-R-005).",
      });
    }
  }

  const lines = children(invoice, "InvoiceLine");
  if (lines.length === 0) {
    issues.push({ rule: "BR-16", message: "De factuur heeft geen regels (BR-16)." });
  }

  const parsedLines = lines.map((line, index) => readLine(line, index, issues));
  const monetary = child(invoice, "LegalMonetaryTotal");
  const lineExtension = expectMoney(monetary ? child(monetary, "LineExtensionAmount") : null, "BR-12", "De som van de regels", issues);
  const taxExclusive = expectMoney(monetary ? child(monetary, "TaxExclusiveAmount") : null, "BR-13", "Het totaal zonder btw", issues);
  const taxInclusive = expectMoney(monetary ? child(monetary, "TaxInclusiveAmount") : null, "BR-14", "Het totaal met btw", issues);
  const payable = expectMoney(monetary ? child(monetary, "PayableAmount") : null, "BR-15", "Het te betalen bedrag", issues);
  const allowance = optionalMoney(monetary ? child(monetary, "AllowanceTotalAmount") : null, issues);
  const charge = optionalMoney(monetary ? child(monetary, "ChargeTotalAmount") : null, issues);
  const prepaid = optionalMoney(monetary ? child(monetary, "PrepaidAmount") : null, issues);
  const rounding = optionalMoney(monetary ? child(monetary, "PayableRoundingAmount") : null, issues);

  const lineSum = parsedLines.reduce((sum, line) => sum + (line?.netCents ?? 0), 0);
  if (lineExtension != null && lineExtension !== lineSum) {
    issues.push({
      rule: "BR-CO-10",
      message: "De som van de regelbedragen komt niet overeen met het regeltotaal (BR-CO-10).",
    });
  }
  if (lineExtension != null && taxExclusive != null && taxExclusive !== lineExtension - allowance + charge) {
    issues.push({
      rule: "BR-CO-13",
      message: "Het totaal zonder btw klopt niet met de regels (BR-CO-13).",
    });
  }

  const taxTotal = child(invoice, "TaxTotal");
  const headerTax = expectMoney(taxTotal ? child(taxTotal, "TaxAmount") : null, "BR-CO-14", "Het btw-bedrag", issues);
  const subtotals = taxTotal ? children(taxTotal, "TaxSubtotal") : [];
  let subtotalTax = 0;
  const groups = new Map<string, { category: string; percent: number; taxable: number; tax: number; reasonCode: string; reason: string }>();

  for (const subtotal of subtotals) {
    const taxable = expectMoney(child(subtotal, "TaxableAmount"), "BR-CO-17", "De grondslag", issues);
    const tax = expectMoney(child(subtotal, "TaxAmount"), "BR-CO-17", "Het btw-bedrag van een tarief", issues);
    const categoryEl = child(subtotal, "TaxCategory");
    const category = textOf(categoryEl ? child(categoryEl, "ID") : null);
    const percentText = textOf(categoryEl ? child(categoryEl, "Percent") : null);
    const percent = percentText ? Number(percentText) : Number.NaN;
    const reasonCode = textOf(categoryEl ? child(categoryEl, "TaxExemptionReasonCode") : null);
    const reason = textOf(categoryEl ? child(categoryEl, "TaxExemptionReason") : null);
    if (tax != null) subtotalTax += tax;
    if (!category || !Number.isFinite(percent)) {
      issues.push({ rule: "BR-48", message: "Elke btw-uitsplitsing heeft een categorie en een percentage nodig (BR-48)." });
      continue;
    }
    const key = `${category}|${percent}`;
    const current = groups.get(key) ?? { category, percent, taxable: 0, tax: 0, reasonCode, reason };
    current.taxable += taxable ?? 0;
    current.tax += tax ?? 0;
    current.reasonCode = reasonCode || current.reasonCode;
    current.reason = reason || current.reason;
    groups.set(key, current);
    if (tax != null && taxable != null && tax !== vatCentsFromTaxable(taxable, percent)) {
      issues.push({
        rule: "BR-CO-17",
        message: "Het btw-bedrag is niet de grondslag maal het percentage, afgerond op centen (BR-CO-17).",
      });
    }
    checkCategoryRules(category, percent, reasonCode, reason, issues);
  }

  if (headerTax != null && headerTax !== subtotalTax) {
    issues.push({
      rule: "BR-CO-14",
      message: "Het totale btw-bedrag is niet de som van de btw-uitsplitsing (BR-CO-14).",
    });
  }
  if (taxExclusive != null && headerTax != null && taxInclusive != null && taxInclusive !== taxExclusive + headerTax) {
    issues.push({
      rule: "BR-CO-15",
      message: "Het totaal met btw is niet het totaal zonder btw plus de btw (BR-CO-15).",
    });
  }
  if (taxInclusive != null && payable != null && payable !== taxInclusive - prepaid + rounding) {
    issues.push({
      rule: "BR-CO-16",
      message: "Het te betalen bedrag klopt niet met het totaal, vooruitbetaald en afronding (BR-CO-16).",
    });
  }
  if (payable != null && payable > 0 && !dueDate && !textOf(child(child(invoice, "PaymentTerms"), "Note"))) {
    issues.push({
      rule: "BT-9",
      message: "Bij een te betalen bedrag is een vervaldatum of een betaalvoorwaarde nodig.",
    });
  }

  const lineGroups = new Map<string, number>();
  for (const line of parsedLines) {
    if (!line) continue;
    const key = `${line.category}|${line.percent}`;
    lineGroups.set(key, (lineGroups.get(key) ?? 0) + line.netCents);
    if (!groups.has(key)) {
      issues.push({
        rule: "BR-S-01",
        message: `Regel ${line.id} heeft btw-categorie ${line.category} ${line.percent}%, maar die ontbreekt in de btw-uitsplitsing.`,
      });
    }
  }
  for (const [key, group] of groups) {
    const fromLines = lineGroups.get(key) ?? 0;
    if (group.taxable !== fromLines) {
      issues.push({
        rule: "BR-S-08",
        message: `De grondslag voor ${group.category} ${group.percent}% komt niet overeen met de regels (BR-S-08).`,
      });
    }
  }

  const categories = new Set(parsedLines.flatMap((line) => (line ? [line.category] : [])));
  if (categories.has("S") && !seller.vatNumber) {
    issues.push({ rule: "BR-S-02", message: "Bij een standaardtarief is het btw-nummer van de verkoper verplicht (BR-S-02)." });
  }
  if (categories.has("Z") && !seller.vatNumber) {
    issues.push({ rule: "BR-Z-02", message: "Bij 0% btw is het btw-nummer van de verkoper verplicht (BR-Z-02)." });
  }
  if (categories.has("AE")) {
    if (!seller.vatNumber || !buyer.vatNumber) {
      issues.push({
        rule: "BR-AE-02",
        message: "Bij verlegde btw moeten verkoper én koper een btw-nummer hebben (BR-AE-02).",
      });
    }
  }
  if (categories.has("K")) {
    if (!seller.vatNumber || !buyer.vatNumber) {
      issues.push({
        rule: "BR-IC-02",
        message: "Bij een intracommunautaire levering moeten verkoper én koper een btw-nummer hebben (BR-IC-02).",
      });
    }
    if (seller.country && buyer.country && seller.country === buyer.country) {
      issues.push({
        rule: "GW-IC-01",
        message: "Een intracommunautaire levering kan alleen als verkoper en koper in verschillende EU-landen zitten.",
      });
    }
    const delivery = child(invoice, "Delivery");
    const deliveryDate = textOf(delivery ? child(delivery, "ActualDeliveryDate") : null);
    const period = child(invoice, "InvoicePeriod");
    const hasPeriod = Boolean(textOf(period ? child(period, "StartDate") : null) || textOf(period ? child(period, "EndDate") : null));
    if (!isIsoDate(deliveryDate) && !hasPeriod) {
      issues.push({
        rule: "BR-IC-11",
        message: "Bij een intracommunautaire levering is een leverdatum of een factuurperiode nodig (BR-IC-11).",
      });
    }
    const deliveryCountry = textOf(
      child(child(child(child(delivery, "DeliveryLocation"), "Address"), "Country"), "IdentificationCode"),
    );
    if (!deliveryCountry) {
      issues.push({
        rule: "BR-IC-12",
        message: "Bij een intracommunautaire levering is het land van levering nodig (BR-IC-12).",
      });
    }
  }

  if ((seller.country === "NL" || seller.country === "BE") && (categories.has("S") || categories.has("Z"))) {
    const allowed = VAT_PERCENTS[seller.country];
    const reported = new Set<number>();
    for (const line of parsedLines) {
      if (!line || (line.category !== "S" && line.category !== "Z")) continue;
      if (!allowed.includes(line.percent) && !reported.has(line.percent)) {
        reported.add(line.percent);
        const list = allowed.map((item) => `${item}%`).join(", ");
        const countryLabel = seller.country === "BE" ? "Belgische" : "Nederlandse";
        issues.push({
          rule: "GW-BTW-01",
          message: `Voor een ${countryLabel} verkoper is alleen ${list} toegestaan, niet ${line.percent}%.`,
        });
      }
    }
  }

  const payment = child(invoice, "PaymentMeans");
  if (seller.country === "NL" && !payment) {
    issues.push({
      rule: "NL-R-007",
      message: "Een Nederlandse factuur moet een betaalmiddel bevatten, bijvoorbeeld een IBAN (NL-R-007).",
    });
  }
  if (payment) {
    const code = textOf(child(payment, "PaymentMeansCode"));
    const allowedCodes = ["30", "48", "49", "57", "58", "59"];
    if (!allowedCodes.includes(code)) {
      issues.push(
        seller.country === "NL" && buyer.country === "NL"
          ? {
              rule: "NL-R-008",
              message: "Bij een Nederlandse verkoper en koper moet de betaalwijze 30, 48, 49, 57, 58 of 59 zijn (NL-R-008).",
            }
          : { rule: "BR-49", message: "De betaalwijze ontbreekt of is geen geldige code (BR-49)." },
      );
    }
    const account = textOf(child(child(payment, "PayeeFinancialAccount"), "ID"));
    if ((code === "30" || code === "58") && !account) {
      issues.push({ rule: "BR-61", message: "Bij een overschrijving is een rekeningnummer verplicht (BR-61)." });
    }
    if (account && !isValidIban(account)) {
      issues.push({
        rule: "GW-IBAN-01",
        message: "Het IBAN op de factuur is ongeldig. Gebruik een geldig IBAN zonder spaties of met spaties.",
      });
    }
  }

  return issues;
}

function checkCategoryRules(
  category: string,
  percent: number,
  reasonCode: string,
  reason: string,
  issues: PeppolIssue[],
) {
  if (category === "S") {
    if (!(percent > 0)) {
      issues.push({ rule: "BR-S-05", message: "Een standaardtarief moet hoger zijn dan 0% (BR-S-05)." });
    }
    if (reasonCode || reason) {
      issues.push({
        rule: "BR-S-10",
        message: "Bij een standaardtarief mag geen vrijstellingsreden staan (BR-S-10).",
      });
    }
    return;
  }
  if (category === "Z") {
    if (percent !== 0) issues.push({ rule: "BR-Z-05", message: "Een nultarief moet 0% zijn (BR-Z-05)." });
    if (reasonCode || reason) {
      issues.push({ rule: "BR-Z-10", message: "Bij 0% (nultarief) mag geen vrijstellingsreden staan (BR-Z-10)." });
    }
    return;
  }
  if (category === "AE") {
    if (percent !== 0) issues.push({ rule: "BR-AE-05", message: "Verlegde btw moet 0% zijn (BR-AE-05)." });
    if (reasonCode !== "VATEX-EU-AE" && !reason) {
      issues.push({
        rule: "BR-AE-10",
        message: "Bij verlegde btw is de reden VATEX-EU-AE of een tekst zoals 'Btw verlegd' nodig (BR-AE-10).",
      });
    }
    return;
  }
  if (category === "K") {
    if (percent !== 0) {
      issues.push({ rule: "BR-IC-05", message: "Een intracommunautaire levering moet 0% zijn (BR-IC-05)." });
    }
    if (reasonCode !== "VATEX-EU-IC" && !reason) {
      issues.push({
        rule: "BR-IC-10",
        message: "Bij een intracommunautaire levering is de reden VATEX-EU-IC of een verklarende tekst nodig (BR-IC-10).",
      });
    }
    return;
  }
  issues.push({
    rule: "GW-BTW-02",
    message: `Btw-categorie ${category} wordt niet ondersteund. Gebruik S, Z, AE (verlegd) of K (intracommunautair).`,
  });
}

function readLine(
  line: XmlElement,
  index: number,
  issues: PeppolIssue[],
): { id: string; netCents: number; category: string; percent: number } | null {
  const id = textOf(child(line, "ID")) || String(index + 1);
  const name = textOf(child(child(line, "Item"), "Name"));
  if (!name) issues.push({ rule: "BR-25", message: `Regel ${id} heeft geen omschrijving (BR-25).` });
  const quantityEl = child(line, "InvoicedQuantity");
  const quantity = Number(textOf(quantityEl));
  if (!(quantity > 0)) {
    issues.push({ rule: "BR-22", message: `Het aantal van regel ${id} moet groter zijn dan 0.` });
  }
  const unitCode = quantityEl?.getAttribute("unitCode") ?? "";
  if (!ALLOWED_UNIT_CODES.includes(unitCode as (typeof ALLOWED_UNIT_CODES)[number])) {
    issues.push({
      rule: "GW-UNIT-01",
      message: `De eenheid van regel ${id} heeft geen ondersteunde Peppol-code. Gebruik stuk, uur, meter, m², set of post.`,
    });
  }
  const net = expectMoney(child(line, "LineExtensionAmount"), "BR-24", `Het bedrag van regel ${id}`, issues);
  const price = expectMoney(child(child(line, "Price"), "PriceAmount"), "BR-26", `De prijs van regel ${id}`, issues);
  if (price != null && price < 0) {
    issues.push({ rule: "BR-27", message: `De prijs van regel ${id} mag niet negatief zijn (BR-27).` });
  }
  const categoryEl = child(child(line, "Item"), "ClassifiedTaxCategory");
  const category = textOf(categoryEl ? child(categoryEl, "ID") : null);
  const percent = Number(textOf(categoryEl ? child(categoryEl, "Percent") : null));
  if (!category) {
    issues.push({ rule: "BR-CO-04", message: `Regel ${id} heeft geen btw-categorie (BR-CO-04).` });
    return null;
  }
  if (net == null || !Number.isFinite(percent)) return null;
  return { id, netCents: net, category, percent };
}

function checkEndpoint(scheme: string, id: string, role: string, issues: PeppolIssue[]) {
  if (!scheme) {
    issues.push({
      rule: "BR-CL-25",
      message: `Het Peppol-adres van de ${role} heeft geen scheme, zoals 0106 of 0208 (BR-CL-25).`,
    });
    return;
  }
  if (!SUPPORTED_ENDPOINT_SCHEMES.includes(scheme as (typeof SUPPORTED_ENDPOINT_SCHEMES)[number])) {
    issues.push({
      rule: "GW-EAS-01",
      message: `Scheme ${scheme} voor de ${role} valt buiten NL/BE. Gebruik 0106, 0190, 9944, 0208 of 9925.`,
    });
    return;
  }
  if (scheme === "0106" && !isDutchKvkCompact(id)) {
    issues.push({
      rule: "PEPPOL-COMMON-R054",
      message: `Het KvK-nummer van de ${role} moet uit 8 cijfers bestaan (PEPPOL-COMMON-R054).`,
    });
  }
  if (scheme === "0190" && !/^\d{20}$/.test(id)) {
    issues.push({
      rule: "PEPPOL-COMMON-R055",
      message: `Het OIN van de ${role} moet uit 20 cijfers bestaan (PEPPOL-COMMON-R055).`,
    });
  }
  if (scheme === "0208" && !isBelgianEnterpriseNumber(id)) {
    issues.push({
      rule: "PEPPOL-COMMON-R043",
      message: `Het ondernemingsnummer van de ${role} moet 10 cijfers zijn en aan de controlecijfers voldoen (PEPPOL-COMMON-R043).`,
    });
  }
  if (scheme === "9944" && !isDutchVat(id)) {
    issues.push({
      rule: "PEPPOL-COMMON-R056-1",
      message: `Het Nederlandse btw-nummer van de ${role} moet de vorm NL123456789B01 hebben (PEPPOL-COMMON-R056-1).`,
    });
  }
  if (scheme === "9925" && !isBelgianVat(id)) {
    issues.push({
      rule: "GW-BE-VAT",
      message: `Het Belgische btw-nummer van de ${role} moet beginnen met BE en een geldig ondernemingsnummer bevatten.`,
    });
  }
}

function checkVatIdentifier(value: string, role: string, issues: PeppolIssue[]) {
  if (!value) return;
  if (!/^[A-Z]{2}.+/.test(value)) {
    issues.push({
      rule: "BR-CO-09",
      message: `Het btw-nummer van de ${role} moet met een landcode beginnen, zoals NL of BE (BR-CO-09).`,
    });
    return;
  }
  if (value.startsWith("NL") && !isDutchVat(value)) {
    issues.push({
      rule: "PEPPOL-COMMON-R056-2",
      message: `Het Nederlandse btw-nummer van de ${role} moet de vorm NL123456789B01 hebben (PEPPOL-COMMON-R056-2).`,
    });
  }
  if (value.startsWith("BE") && !isBelgianVat(value)) {
    issues.push({
      rule: "GW-BE-VAT",
      message: `Het Belgische btw-nummer van de ${role} moet beginnen met BE en een geldig ondernemingsnummer bevatten.`,
    });
  }
}

function readParty(party: XmlElement | null) {
  const address = party ? child(party, "PostalAddress") : null;
  const legal = party ? child(party, "PartyLegalEntity") : null;
  const legalId = legal ? child(legal, "CompanyID") : null;
  const endpoint = party ? child(party, "EndpointID") : null;
  return {
    name: textOf(legal ? child(legal, "RegistrationName") : null),
    street: textOf(address ? child(address, "StreetName") : null),
    city: textOf(address ? child(address, "CityName") : null),
    postal: textOf(address ? child(address, "PostalZone") : null),
    country: textOf(child(address ? child(address, "Country") : null, "IdentificationCode")),
    endpointId: textOf(endpoint),
    endpointScheme: endpoint?.getAttribute("schemeID") ?? "",
    vatNumber: vatNumberOf(party),
    legalId: textOf(legalId),
    legalScheme: legalId?.getAttribute("schemeID") ?? "",
  };
}

function vatNumberOf(party: XmlElement | null): string {
  if (!party) return "";
  for (const scheme of children(party, "PartyTaxScheme")) {
    const id = textOf(child(child(scheme, "TaxScheme"), "ID")).toUpperCase();
    if (id === "VAT") return textOf(child(scheme, "CompanyID"));
  }
  return "";
}

function partyOf(invoice: XmlElement, name: string): XmlElement | null {
  return child(child(invoice, name), "Party");
}

function orderReference(invoice: XmlElement): string {
  return textOf(child(child(invoice, "OrderReference"), "ID"));
}

function expectMoney(el: XmlElement | null, rule: string, label: string, issues: PeppolIssue[]): number | null {
  if (!el) {
    issues.push({ rule, message: `${label} ontbreekt (${rule}).` });
    return null;
  }
  const cents = parseMoney(textOf(el));
  if (cents == null) {
    issues.push({ rule, message: `${label} is geen bedrag in euro met hoogstens twee decimalen (${rule}).` });
    return null;
  }
  if (el.getAttribute("currencyID") !== "EUR") {
    issues.push({ rule: "BR-05", message: `${label} moet in EUR staan (BR-05).` });
  }
  return cents;
}

function optionalMoney(el: XmlElement | null, issues: PeppolIssue[]): number {
  if (!el) return 0;
  const cents = parseMoney(textOf(el));
  if (cents == null) {
    issues.push({ rule: "BR-CO-13", message: "Een totaalbedrag is geen geldig eurobedrag (BR-CO-13)." });
    return 0;
  }
  return cents;
}

function walkEmpty(el: XmlElement, issues: PeppolIssue[]) {
  if (isEmpty(el)) {
    issues.push({
      rule: "PEPPOL-EN16931-R008",
      message: `Het element ${localName(el)} is leeg. Laat lege velden weg (PEPPOL-EN16931-R008).`,
    });
  }
  for (const item of childElements(el)) walkEmpty(item, issues);
}

function isEmpty(el: XmlElement): boolean {
  if (textOf(el) && childElements(el).length === 0) return false;
  if (childElements(el).length > 0) return false;
  return !textOf(el);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function child(parent: XmlElement | null, name: string): XmlElement | null {
  if (!parent) return null;
  return childElements(parent).find((element) => localName(element) === name) ?? null;
}

function children(parent: XmlElement, name: string): XmlElement[] {
  return childElements(parent).filter((element) => localName(element) === name);
}

function childElements(parent: XmlElement): XmlElement[] {
  const result: XmlElement[] = [];
  for (let index = 0; index < parent.childNodes.length; index += 1) {
    const node = parent.childNodes[index];
    if (node?.nodeType === 1) result.push(node as XmlElement);
  }
  return result;
}

function textOf(element: XmlElement | null): string {
  if (!element) return "";
  const chunks: string[] = [];
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const node = element.childNodes[index];
    if (node?.nodeType === 3 || node?.nodeType === 4) chunks.push(node.nodeValue ?? "");
  }
  return chunks.join("").trim();
}

function localName(element: XmlElement): string {
  if (element.localName) return element.localName;
  const name = element.nodeName;
  const index = name.indexOf(":");
  return index >= 0 ? name.slice(index + 1) : name;
}
