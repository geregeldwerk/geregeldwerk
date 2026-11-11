import { Suspense } from "react";
import { connection } from "next/server";
import { WaitlistAdmin } from "@/components/waitlist-admin";
import { getWaitlistAdapter } from "@/lib/waitlist/adapter";

async function WaitlistList() {
  await connection();
  const entries = await getWaitlistAdapter().list();
  return <WaitlistAdmin entries={entries} />;
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Wachtlijst laden…</p>}>
      <WaitlistList />
    </Suspense>
  );
}
