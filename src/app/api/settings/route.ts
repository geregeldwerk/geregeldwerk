import { connection } from "next/server";
import { parseSettings } from "@/lib/api/draft";
import { fromUnknownError, readJson } from "@/lib/api/http";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  return Response.json({ settings: data.settings });
}

export async function PUT(request: Request) {
  await connection();
  try {
    const settings = parseSettings(await readJson(request));
    if (!Number.isFinite(settings.defaultVatRate) || settings.defaultVatRate < 0 || settings.defaultVatRate > 1) {
      return Response.json({ error: "BTW-tarief is ongeldig." }, { status: 400 });
    }
    await getRepository().update((data) => {
      const before = data.settings;
      data.settings = settings;
      copyStore(
        data,
        withAudit(data, {
          at: new Date().toISOString(),
          actor: OWNER,
          action: "bedrijfsgegevens",
          outcome: "uitgevoerd",
          summary: "Bedrijfsgegevens bijgewerkt.",
          input: settings,
          output: settings,
          before,
          after: settings,
        }),
      );
    });
    return Response.json({ settings });
  } catch (error) {
    return fromUnknownError(error);
  }
}
