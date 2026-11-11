export type LaunchMode = "waitlist" | "live";

/** Standaard wachtlijst. Alleen de exacte waarde `live` opent de kassa. */
export function launchMode(value = process.env.NEXT_PUBLIC_LAUNCH_MODE): LaunchMode {
  return value === "live" ? "live" : "waitlist";
}
