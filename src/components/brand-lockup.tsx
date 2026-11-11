import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

const LOGO = { width: 1199, height: 296 } as const;

export function BrandLockup({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex shrink-0 items-center", className)}>
      <Image
        src="/brand/logo-licht-transparant.png"
        alt="GeregeldWerk"
        {...LOGO}
        priority
        className="h-8 w-auto dark:hidden sm:h-11"
      />
      <Image
        src="/brand/logo-transparant.png"
        alt=""
        {...LOGO}
        priority
        className="hidden h-8 w-auto dark:block sm:h-11"
      />
    </Link>
  );
}
