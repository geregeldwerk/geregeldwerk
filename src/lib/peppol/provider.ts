import { formatPeppolError, validatePeppolInvoice } from "@/lib/peppol/validate";

export interface PeppolDispatch {
  invoiceNumber: string;
  senderScheme: string;
  senderId: string;
  receiverScheme: string;
  receiverId: string;
  xml: string;
}

export interface PeppolDispatchResult {
  ok: boolean;
  provider: string;
  transmissionId: string | null;
  message: string;
}

/** Peppol Access Point. De enige ingebouwde implementatie is een lokale mock. */
export interface PeppolAccessPoint {
  readonly id: string;
  send(input: PeppolDispatch): Promise<PeppolDispatchResult>;
}

/**
 * Standaard mock. `sandbox` is dezelfde lokale simulator.
 * Een andere naam wordt niet aangeroepen: er is geen netwerk, geen account en geen sleutel.
 */
export function resolvePeppolProvider(
  env: { GEREGELDWERK_PEPPOL_PROVIDER?: string } = {
    GEREGELDWERK_PEPPOL_PROVIDER: process.env.GEREGELDWERK_PEPPOL_PROVIDER,
  },
): PeppolAccessPoint {
  const raw = (env.GEREGELDWERK_PEPPOL_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "" || raw === "mock" || raw === "sandbox") return createMockAccessPoint();
  return {
    id: raw,
    async send() {
      return {
        ok: false,
        provider: raw,
        transmissionId: null,
        message: `Provider ${raw} is niet aangesloten. Alleen de mock-provider is beschikbaar; er wordt niets echt verstuurd.`,
      };
    },
  };
}

export function createMockAccessPoint(): PeppolAccessPoint {
  return {
    id: "mock",
    async send(input) {
      const issues = validatePeppolInvoice(input.xml);
      if (issues.length > 0) {
        return {
          ok: false,
          provider: "mock",
          transmissionId: null,
          message: formatPeppolError(issues),
        };
      }
      if (!input.senderId || !input.receiverId) {
        return {
          ok: false,
          provider: "mock",
          transmissionId: null,
          message: "Verkoper of koper heeft geen Peppol-adres. Er is niets verstuurd.",
        };
      }
      return {
        ok: true,
        provider: "mock",
        transmissionId: `mock-${input.invoiceNumber}-${crypto.randomUUID()}`,
        message: "Gesimuleerd afgeleverd bij het mock Access Point. Er is niets naar het Peppol-netwerk gestuurd.",
      };
    },
  };
}
