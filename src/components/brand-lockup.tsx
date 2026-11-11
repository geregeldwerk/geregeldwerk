import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

export function BrandLockup({
  href = "/",
  size = "header",
  className,
}: {
  href?: string;
  size?: "header" | "hero";
  className?: string;
}) {
  const hero = size === "hero";
  return (
    <Link href={href} className={cn("flex shrink-0 items-center", hero ? "gap-4" : "gap-2.5", className)}>
      <span className={cn("flex min-w-0 items-center", hero ? "gap-4" : "gap-2.5", !hero && "sm:dark:hidden")}>
        <Image
          src="/brand/icoon.png"
          alt=""
          width={hero ? 80 : 36}
          height={hero ? 80 : 36}
          priority={hero || size === "header"}
          className={cn("rounded-xl", hero ? "size-16 rounded-2xl sm:size-20" : "size-9")}
        />
        <span className="min-w-0 text-left">
          <span className={cn("wordmark block truncate text-foreground", hero ? "text-xl sm:text-2xl" : "text-[13px] sm:text-sm")}>
            Geregeld<span className="text-primary">Werk</span>
          </span>
          {hero ? null : (
            <span className="mt-1 hidden truncate text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:block" aria-hidden>
              Jij doet het werk, wij doen de rest
            </span>
          )}
        </span>
      </span>
      {hero ? null : (
        <Image
          src="/brand/logo-woordmerk.png"
          alt="GeregeldWerk"
          width={1189}
          height={271}
          priority
          className="hidden h-11 w-auto sm:dark:block"
        />
      )}
    </Link>
  );
}
