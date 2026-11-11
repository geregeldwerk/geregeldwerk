import Link from "next/link";
import { publishedReviews, type Review } from "@/lib/trust";

export function Reviews({ reviews = publishedReviews() }: { reviews?: Review[] }) {
  if (reviews.length === 0) {
    return (
      <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28 rounded-3xl border border-dashed border-primary/40 bg-card px-5 py-8">
        <h2 id="reviews-title" className="max-w-2xl text-2xl tracking-tight text-balance sm:text-3xl">
          Word een van de eerste gebruikers. Test GeregeldWerk mee en help het vormgeven.
        </h2>
        <Link href="/app" className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Probeer gratis
        </Link>
      </section>
    );
  }

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28">
      <h2 id="reviews-title" className="text-3xl tracking-tight sm:text-4xl">Ervaringen</h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {reviews.map((review) => (
          <li key={`${review.name}-${review.company}`} className="rounded-3xl border border-border bg-card p-5">
            <blockquote>
              <p className="text-base leading-7">“{review.quote}”</p>
              {review.score != null ? (
                <p className="mt-3 text-sm font-semibold text-primary">{review.score} van 5</p>
              ) : null}
              <footer className="mt-4 text-sm">
                <p className="font-semibold">{review.name}</p>
                <p className="text-muted-foreground">{review.company} · {review.industry}</p>
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
