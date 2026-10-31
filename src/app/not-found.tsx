import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-4xl">Pagina niet gevonden</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">Deze route bestaat niet in Geregeldwerk.</p>
      <Link href="/" className="mt-6 text-sm underline">
        Terug naar nieuw bericht
      </Link>
    </main>
  );
}
