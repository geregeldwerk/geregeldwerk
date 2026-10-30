import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import type { SocialChannel } from "@/lib/domain/types";
import { addLead, copyStore, createPost } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  return Response.json({ posts: data.posts, leads: data.leads });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.kind !== "string") return jsonError("Ongeldig marketingverzoek.");
    let error: string | null = null;
    await getRepository().update((data) => {
      if (body.kind === "post") {
        const channel = body.channel;
        if (channel !== "instagram" && channel !== "facebook" && channel !== "linkedin") {
          error = "Kies een kanaal.";
          return;
        }
        if (typeof body.body !== "string" || !body.body.trim()) {
          error = "De post is leeg.";
          return;
        }
        copyStore(data, createPost(data, { channel: channel as SocialChannel, body: body.body }, OWNER, new Date()));
        return;
      }
      if (body.kind === "lead") {
        copyStore(
          data,
          addLead(
            data,
            {
              source: typeof body.source === "string" ? body.source : "",
              name: typeof body.name === "string" ? body.name : "",
              note: typeof body.note === "string" ? body.note : "",
            },
            OWNER,
            new Date(),
          ),
        );
        return;
      }
      error = "Onbekend marketingverzoek.";
    });
    if (error) return jsonError(error);
    const data = await getRepository().read();
    return Response.json({ posts: data.posts, leads: data.leads }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
