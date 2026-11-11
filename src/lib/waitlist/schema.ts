import { z } from "zod";

export const INDUSTRIES = [
  "bouw/installatie",
  "schilder/stukadoor",
  "schoonmaak",
  "hovenier",
  "autobranche/detailing",
  "zakelijke dienstverlening",
  "anders",
] as const;

export const EMPLOYEE_BANDS = ["zzp", "2-10", "meer dan 10"] as const;

export const WAITLIST_PLANS = ["starter", "professional", "business", "enterprise"] as const;

const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const waitlistSchema = z.object({
  name: z.string().trim().min(1, "Vul je naam in.").max(120),
  email: z.email("Vul een geldig e-mailadres in.").max(200),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  industry: z.enum(INDUSTRIES, { error: "Kies een branche." }),
  employees: z.enum(EMPLOYEE_BANDS, { error: "Kies het aantal medewerkers." }),
  country: z.enum(["NL", "BE"], { error: "Kies Nederland of België." }),
  plan: z.enum(WAITLIST_PLANS).optional().or(z.literal("")),
  timePain: z.string().trim().max(1000).optional().or(z.literal("")),
  consent: z.literal(true, { error: "Zonder toestemming kunnen we je niet inschrijven." }),
  website: optionalText,
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

export type StoredWaitlistEntry = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  company: string;
  industry: (typeof INDUSTRIES)[number];
  employees: (typeof EMPLOYEE_BANDS)[number];
  country: "NL" | "BE";
  plan: (typeof WAITLIST_PLANS)[number] | null;
  timePain: string;
};
