import type { ExtractedLine, Extraction, FollowUpSuggestion } from "@/lib/domain/types";

const MONTHS =
  "januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december";
const WEEKDAYS = "maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag";

const NUMBER_WORDS: ReadonlyArray<readonly [RegExp, number]> = [
  [/\bpaar\b/i, 2],
  [/\btien\b/i, 10],
  [/\bnegen\b/i, 9],
  [/\bacht\b/i, 8],
  [/\bzeven\b/i, 7],
  [/\bzes\b/i, 6],
  [/\bvijf\b/i, 5],
  [/\bvier\b/i, 4],
  [/\bdrie\b/i, 3],
  [/\btwee\b/i, 2],
  [/\b(een|één)\b/i, 1],
];

const VERB_WHITELIST = new Set([
  "leveren",
  "monteren",
  "ophangen",
  "vervangen",
  "afvoeren",
  "repareren",
  "aansluiten",
  "ontstoppen",
  "installeren",
  "bijplaatsen",
  "werkzaamheden",
  "oude",
  "plaatsen",
  "inspecteren",
  "aanleggen",
]);

const BRANDS =
  /vaillant|intergas|nefit|remeha|atag|bosch|itho|daalderop|awb|ferroli|brink|cw[456]|hr[-\s]?ketel/i;

interface CatalogItem {
  id: string;
  defaultUnit: string;
  rules: ReadonlyArray<{ re: RegExp; label: string }>;
}

const CATALOG: readonly CatalogItem[] = [
  {
    id: "cv",
    defaultUnit: "stuk",
    rules: [{ re: /cv[-\s]?ketels?|combiketels?/i, label: "CV-ketel" }],
  },
  {
    id: "warmtepomp",
    defaultUnit: "stuk",
    rules: [{ re: /warmtepompen?/i, label: "Warmtepomp" }],
  },
  {
    id: "boiler",
    defaultUnit: "stuk",
    rules: [{ re: /\bboilers?\b/i, label: "Boiler" }],
  },
  {
    id: "radiator",
    defaultUnit: "stuk",
    rules: [{ re: /radiatoren|radiator/i, label: "Radiator" }],
  },
  {
    id: "thermostaat",
    defaultUnit: "stuk",
    rules: [{ re: /thermostaten|thermostaat/i, label: "Thermostaat" }],
  },
  {
    id: "kraan",
    defaultUnit: "stuk",
    rules: [
      { re: /keukenkranen|keukenkraan/i, label: "Keukenkraan" },
      { re: /mengkranen|mengkraan/i, label: "Mengkraan" },
      { re: /\bkranen\b|\bkraan\b/i, label: "Kraan" },
    ],
  },
  {
    id: "wastafel",
    defaultUnit: "stuk",
    rules: [{ re: /wastafels?/i, label: "Wastafel" }],
  },
  {
    id: "toilet",
    defaultUnit: "stuk",
    rules: [{ re: /\btoiletten\b|\btoilet\b|\bwc\b/i, label: "Toilet" }],
  },
  {
    id: "afvoer",
    defaultUnit: "stuk",
    rules: [{ re: /\bafvoer(?:leiding|buis|put)?\b/i, label: "Afvoer" }],
  },
  {
    id: "leiding",
    defaultUnit: "meter",
    rules: [{ re: /\bwaterleiding\b|\bleidingen\b|\bleiding\b/i, label: "Leiding" }],
  },
  {
    id: "groepenkast",
    defaultUnit: "stuk",
    rules: [{ re: /groepenkasten|groepenkast|meterkast/i, label: "Groepenkast" }],
  },
  {
    id: "stopcontact",
    defaultUnit: "stuk",
    rules: [
      {
        re: /stopcontacten|stopcontact|wandcontactdozen|wandcontactdoos/i,
        label: "Stopcontact",
      },
    ],
  },
  {
    id: "verlichting",
    defaultUnit: "stuk",
    rules: [{ re: /verlichting|\blampen\b|\blamp\b|spotjes|\bspots\b/i, label: "Verlichting" }],
  },
  {
    id: "dakgoot",
    defaultUnit: "meter",
    rules: [{ re: /dakgoten|dakgoot/i, label: "Dakgoot" }],
  },
  {
    id: "dak",
    defaultUnit: "m²",
    rules: [{ re: /\bdakpannen\b|\bdak\b/i, label: "Dak" }],
  },
  {
    id: "badkamer",
    defaultUnit: "post",
    rules: [{ re: /badkamer/i, label: "Badkamer" }],
  },
  {
    id: "keuken",
    defaultUnit: "post",
    rules: [{ re: /\bkeuken\b/i, label: "Keuken" }],
  },
  {
    id: "vloer",
    defaultUnit: "m²",
    rules: [{ re: /vloerverwarming|\bvloer\b/i, label: "Vloer" }],
  },
  {
    id: "airco",
    defaultUnit: "stuk",
    rules: [{ re: /airconditioning|\bairco\b/i, label: "Airco" }],
  },
  {
    id: "rookmelder",
    defaultUnit: "stuk",
    rules: [{ re: /rookmelders?/i, label: "Rookmelder" }],
  },
  {
    id: "deur",
    defaultUnit: "stuk",
    rules: [{ re: /\bdeuren\b|\bdeur\b/i, label: "Deur" }],
  },
  {
    id: "raam",
    defaultUnit: "stuk",
    rules: [{ re: /\bramen\b|\braam\b/i, label: "Raam" }],
  },
  {
    id: "kitwerk",
    defaultUnit: "meter",
    rules: [{ re: /\bkitwerk\b|\bkitten\b/i, label: "Kitwerk" }],
  },
];

const ROOM_OBJECT_IDS = new Set(["keuken", "badkamer"]);

type Action =
  | "leveren"
  | "plaatsen"
  | "vervangen"
  | "afvoeren"
  | "repareren"
  | "aansluiten"
  | "ontstoppen"
  | "inspecteren"
  | "werk";

interface ObjectHit {
  id: string;
  label: string;
  defaultUnit: string;
  quantity: number | null;
  unit: string | null;
}

const DATE_IN_CLAUSE = new RegExp(
  `\\b\\d{1,2}\\s+(?:${MONTHS})(?:\\s+\\d{4})?`,
  "gi",
);

export function extractFromMessage(text: string): Extraction {
  const source = text.replace(/\r\n/g, "\n").trim();
  const customerName = extractCustomerName(source);
  const location = extractLocation(source);
  const customerPhone = extractPhone(source);
  const customerEmail = extractEmail(source);
  const requestedDate = extractRequestedDate(source);
  const lineItems = extractLineItems(source);
  const jobDescription = buildJobDescription(lineItems);
  const missingInfo = collectMissingInfo(source, {
    customerName,
    location,
    customerPhone,
    customerEmail,
    requestedDate,
    lineItems,
  });

  return {
    customerName,
    customerPhone,
    customerEmail,
    location,
    jobDescription,
    requestedDate,
    lineItems,
    missingInfo,
    followUp: suggestFollowUp(source, customerName, requestedDate),
  };
}

export function collectMissingInfo(
  source: string,
  fields: {
    customerName: string | null;
    location: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    requestedDate: string | null;
    lineItems: ExtractedLine[];
  },
): string[] {
  const missing: string[] = [];
  if (!fields.customerName) missing.push("Klantnaam ontbreekt");
  if (!fields.location) missing.push("Plaats of adres ontbreekt");
  if (!fields.customerPhone && !fields.customerEmail) {
    missing.push("Contactgegevens (telefoon of e-mail) ontbreken");
  }
  if (!fields.requestedDate) missing.push("Gewenste uitvoerdatum ontbreekt");
  if (fields.lineItems.length === 0) {
    missing.push("Geen concrete werkzaamheden herkend");
  } else if (fields.lineItems.some((line) => line.quantity == null || line.unit == null)) {
    missing.push("Aantal of eenheid is niet overal duidelijk");
  }
  if (
    fields.lineItems.some((line) => /cv-ketel|warmtepomp/i.test(line.description)) &&
    !BRANDS.test(source)
  ) {
    missing.push("Type of merk van het toestel ontbreekt");
  }
  if (mentionsPrice(source)) {
    missing.push(
      "Het bericht noemt een bedrag. Geregeldwerk neemt geen prijzen over; vul ze zelf in.",
    );
  }
  return missing;
}

export function suggestFollowUp(
  source: string,
  customerName: string | null,
  requestedDate: string | null,
): FollowUpSuggestion | null {
  if (!source.trim()) return null;
  const who = customerName ?? "de klant";
  if (/offerte|prijsopgave|prijsindicatie/i.test(source)) {
    return {
      title: `Offerte afronden voor ${who}`,
      detail: requestedDate
        ? `Genoemde termijn: ${requestedDate}. Vul eerst de prijzen in en verstuur de offerte daarna pas.`
        : "Vul eerst de prijzen in en verstuur de offerte daarna pas.",
    };
  }
  if (requestedDate) {
    return {
      title: `Inplannen bij ${who}`,
      detail: `Genoemde termijn: ${requestedDate}.`,
    };
  }
  return {
    title: `Ontbrekende gegevens navragen bij ${who}`,
    detail: "Vraag naam, plaats, datum en de precieze klus na voordat je een offerte verstuurt.",
  };
}

export function buildJobDescription(lineItems: ExtractedLine[]): string {
  return lineItems.map((line) => line.description).join(", ");
}

export function mentionsPrice(text: string): boolean {
  return /(?:€|eur(?:o)?)\s*\d|\d+(?:[.,]\d{1,2})?\s*(?:€|eur(?:o)?)\b/i.test(text);
}

function extractCustomerName(text: string): string | null {
  const met = text.match(
    /\bmet\s+([\p{Lu}][\p{L}'-]+(?:\s+(?:de|van|der|den|het|ten|ter)\s+[\p{Lu}][\p{L}'-]+|\s+[\p{Lu}][\p{L}'-]+)*)(?:\s+uit|\s+van|,|\.)/u,
  );
  if (met) return cleanName(met[1]);

  const familie = text.match(
    /\b[Ff]amilie\s+((?:de|van|der|den|het|ten|ter|De|Van|Der|Den)\s+)?([\p{Lu}][\p{L}'-]+)/u,
  );
  if (familie) {
    return cleanName(`Familie ${familie[1] ?? ""}${familie[2]}`);
  }

  const titled = text.match(
    /\b([Mm]evrouw|[Mm]eneer|[Dd]hr\.?|[Mm]evr\.?)\s+((?:de|van|der|den|het|ten|ter|De|Van|Der|Den)\s+)?([\p{Lu}][\p{L}'-]+)/u,
  );
  if (titled) {
    const title = normalizeTitle(titled[1]);
    const particle = titled[2] ? preserveParticle(titled[2]) : "";
    return cleanName(`${title} ${particle}${titled[3]}`);
  }

  const klant = text.match(
    /\b(?:[Kk]lant|[Oo]pdrachtgever)\s+((?:de|van|der|den|het|ten|ter|De|Van|Der|Den)\s+)?([\p{Lu}][\p{L}'-]+(?:\s+(?:de|van|der|den|het|ten|ter|De|Van|Der|Den)\s+[\p{Lu}][\p{L}'-]+)?)/u,
  );
  if (klant) return cleanName(`${klant[1] ?? ""}${klant[2]}`);

  const business = text.match(
    /\bbij\s+([\p{Lu}][\p{L}'-]+(?:\s+(?:Het|De|Van|Der|Den|het|de|van|der|den)\s+[\p{Lu}][\p{L}'-]+|\s+[\p{Lu}][\p{L}'-]+){0,5})/u,
  );
  if (business) {
    const name = business[1].replace(/\s+\b(in|te|uit)\b.*$/i, "").trim();
    if (name) return cleanName(name);
  }

  return null;
}

function normalizeTitle(title: string): string {
  const compact = title.toLowerCase().replace(".", "");
  if (compact === "dhr") return "Dhr.";
  if (compact === "mevr") return "Mevr.";
  if (compact === "meneer") return "Meneer";
  return "Mevrouw";
}

function preserveParticle(particle: string): string {
  return particle.replace(/\s+/g, " ");
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function extractLocation(text: string): string | null {
  const street = text.match(
    /\b([\p{Lu}][\p{L}'-]*(?:straat|laan|weg|plein|dijk|gracht|kade|singel|hof|park|steeg))\s+(\d+(?:[a-zA-Z])?(?:\s*[-/]\s*\d+[a-zA-Z]?)?)/u,
  );
  const placePattern =
    /\b(?:in|te|uit|naar)\s+(?!de\s|het\s)([\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){0,2})/gu;
  let place: string | null = null;
  for (const match of text.matchAll(placePattern)) {
    place = match[1].trim();
    break;
  }
  if (street && place) return `${street[1]} ${street[2].replace(/\s+/g, "")}, ${place}`;
  if (street) return `${street[1]} ${street[2].replace(/\s+/g, "")}`;
  return place;
}

function extractPhone(text: string): string | null {
  const match = text.match(
    /(?:\+31|0031|0)\s*6(?:[\s-]?\d){8}\b|(?:\+31|0)\s*[1-9]\d(?:[\s-]?\d){6,7}\b/,
  );
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

export function extractRequestedDate(text: string): string | null {
  const long = text.match(
    new RegExp(
      `(?:(${WEEKDAYS})\\s+)?(\\d{1,2})\\s+(${MONTHS})(?:\\s+(\\d{4}))?`,
      "i",
    ),
  );
  if (long) {
    const weekday = long[1] ? `${long[1].toLowerCase()} ` : "";
    const year = long[4] ? ` ${long[4]}` : "";
    return `${weekday}${long[2]} ${long[3].toLowerCase()}${year}`;
  }
  const nextWeekday = text.match(new RegExp(`volgende week\\s+(${WEEKDAYS})`, "i"));
  if (nextWeekday) return `volgende week ${nextWeekday[1].toLowerCase()}`;
  if (/\bovermorgen\b/i.test(text)) return "overmorgen";
  if (/\bmorgen\b/i.test(text)) return "morgen";
  if (/\bzo snel mogelijk\b|\bzsm\b|\basap\b/i.test(text)) return "zo snel mogelijk";
  const thisWeek = text.match(new RegExp(`deze week(?:\\s+(${WEEKDAYS}))?`, "i"));
  if (thisWeek) {
    return thisWeek[1] ? `deze week ${thisWeek[1].toLowerCase()}` : "deze week";
  }
  if (/\bvolgende week\b/i.test(text)) return "volgende week";
  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numeric) return `${numeric[1]}-${numeric[2]}-${numeric[3]}`;
  return null;
}

function extractLineItems(text: string): ExtractedLine[] {
  const clauses = splitClauses(text);
  const lines: ExtractedLine[] = [];
  const seen = new Set<string>();
  let pending: ObjectHit | null = null;
  let last: ObjectHit | null = null;

  const emit = (object: ObjectHit, actions: Set<Action>, clause: string) => {
    const quantity = object.quantity ?? 1;
    const unit = object.unit ?? object.defaultUnit;
    const descriptions = describeActions(object.label, actions, clause);
    for (const description of descriptions) {
      if (seen.has(description)) continue;
      seen.add(description);
      const isRemoval = description.startsWith("Oude ");
      lines.push({
        description,
        quantity,
        unit: isRemoval ? "stuk" : unit,
      });
    }
    last = { ...object };
    pending = null;
  };

  for (const clause of clauses) {
    const objects = findObjects(clause);
    const actions = actionsIn(clause, objects.length > 0);
    if (objects.length === 0) {
      if (actions.size > 0 && (pending || last)) {
        const target = pending ?? last;
        if (!target) continue;
        const quantity = extractQuantity(clause) ?? target.quantity;
        const unit = extractUnit(clause) ?? target.unit;
        emit({ ...target, quantity, unit }, actions, clause);
      }
      continue;
    }

    if (pending) {
      emit(pending, new Set<Action>(["werk"]), pending.label);
    }

    for (const object of objects) {
      const quantity = extractQuantity(clause);
      const unit = extractUnit(clause);
      const hit: ObjectHit = { ...object, quantity, unit };
      if (actions.size > 0) emit(hit, actions, clause);
      else pending = hit;
      last = hit;
    }
  }

  if (pending) emit(pending, new Set<Action>(["werk"]), pending.label);
  return lines;
}

function splitClauses(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?;])\s+|,\s+|\s+\ben\b\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !/^(hoi|hallo|beste|groet|groeten|mvg)[,.!\s]*$/i.test(part));
}

function findObjects(clause: string): Array<Omit<ObjectHit, "quantity" | "unit">> {
  const found: Array<Omit<ObjectHit, "quantity" | "unit">> = [];
  for (const item of CATALOG) {
    for (const rule of item.rules) {
      if (rule.re.test(clause)) {
        found.push({ id: item.id, label: rule.label, defaultUnit: item.defaultUnit });
        break;
      }
    }
  }
  const specific = found.filter((item) => !ROOM_OBJECT_IDS.has(item.id));
  if (specific.length > 0 && specific.length < found.length && !/renov|verbouw|tegel/i.test(clause)) {
    return specific;
  }
  return found;
}

function actionsIn(clause: string, hasObject: boolean): Set<Action> {
  const actions = new Set<Action>();
  if (/\b(leveren|levert)\b/i.test(clause) || (hasObject && /\b(nieuwe|nieuw)\b/i.test(clause))) {
    actions.add("leveren");
  }
  if (
    /\b(ophangen|ophangt|monteren|monteert|plaatsen|plaatst|installeren|installeert|bijplaatsen|aanleggen)\b/i.test(
      clause,
    )
  ) {
    actions.add("plaatsen");
  }
  if (/\b(vervangen|vervangt|vervanging)\b/i.test(clause)) actions.add("vervangen");
  if (/\b(afvoeren|afgevoerd|meenemen|verwijderen|demonteren)\b/i.test(clause)) {
    actions.add("afvoeren");
  }
  if (/\b(repareren|repareert|reparatie|lekt|lekkage|\blek\b|defect|kapot)\b/i.test(clause)) {
    actions.add("repareren");
  }
  if (/\b(aansluiten|aansluiting)\b/i.test(clause)) actions.add("aansluiten");
  if (/\b(ontstoppen|ontstopt|verstopt|verstopping)\b/i.test(clause)) actions.add("ontstoppen");
  if (/\b(inspectie|inspecteren|nalopen|opname)\b/i.test(clause)) actions.add("inspecteren");
  return actions;
}

function describeActions(label: string, actions: Set<Action>, clause: string): string[] {
  const descriptions: string[] = [];
  if (actions.has("vervangen")) {
    descriptions.push(`${label} vervangen`);
  } else {
    if (actions.has("leveren")) descriptions.push(`${label} leveren`);
    if (actions.has("plaatsen")) descriptions.push(`${label} ${mountVerb(clause)}`);
    if (actions.has("repareren")) descriptions.push(`${label} repareren`);
    if (actions.has("aansluiten")) descriptions.push(`${label} aansluiten`);
    if (actions.has("ontstoppen")) descriptions.push(`${label} ontstoppen`);
    if (actions.has("inspecteren")) descriptions.push(`${label} inspecteren`);
  }
  if (actions.has("afvoeren")) descriptions.push(`Oude ${label} afvoeren`);
  if (descriptions.length === 0) descriptions.push(`Werkzaamheden ${label}`);
  return descriptions;
}

function mountVerb(clause: string): string {
  if (/bijplaatsen/i.test(clause)) return "bijplaatsen";
  if (/ophangen/i.test(clause)) return "ophangen";
  if (/installeren/i.test(clause)) return "installeren";
  if (/aanleggen/i.test(clause)) return "aanleggen";
  if (/plaatsen/i.test(clause)) return "plaatsen";
  return "monteren";
}

function extractQuantity(clause: string): number | null {
  const withoutDates = clause.replace(DATE_IN_CLAUSE, " ");
  const cleaned = stripContacts(withoutDates);
  const digit = cleaned.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (digit) {
    const raw = digit[1];
    const value = Number(raw.replace(",", "."));
    const looksLikeYear = raw.length === 4 && !raw.includes(",") && !raw.includes(".");
    if (!looksLikeYear && value > 0 && value < 1000) return value;
  }
  for (const [pattern, value] of NUMBER_WORDS) {
    if (pattern.test(cleaned)) return value;
  }
  return null;
}

function extractUnit(clause: string): string | null {
  if (/\b(m2|m²|vierkante meters?)\b/i.test(clause)) return "m²";
  if (/\b(uren|uur)\b/i.test(clause)) return "uur";
  if (/\bmeters?\b/i.test(clause)) return "meter";
  if (/\bstuks?\b/i.test(clause)) return "stuk";
  if (/\bsets?\b/i.test(clause)) return "set";
  return null;
}

function stripContacts(clause: string): string {
  return clause
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+31|0031|0)\s*6(?:[\s-]?\d){8}/g, " ")
    .replace(/\b\d{4}\s?[A-Z]{2}\b/g, " ");
}

export function groundedLineDescription(description: string, source: string): boolean {
  const sourceFold = source.toLocaleLowerCase("nl-NL");
  const words = description
    .toLocaleLowerCase("nl-NL")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);
  if (words.length === 0) return false;
  return words.every((word) => VERB_WHITELIST.has(word) || sourceFold.includes(word));
}

export function textIncludesFold(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("nl-NL").includes(needle.toLocaleLowerCase("nl-NL"));
}
