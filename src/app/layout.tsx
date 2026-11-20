import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

const themeScript = `(function(){try{var t=localStorage.getItem("geregeldwerk-theme");if(t==="light")document.documentElement.classList.remove("dark");else document.documentElement.classList.add("dark");}catch(e){}})();`;

function accentClassName() {
  const theme = process.env.ACCENT_THEME;
  if (theme === "blue" || theme === "orange") return `accent-${theme}`;
  return "";
}

export const metadata: Metadata = {
  title: {
    default: "GeregeldWerk",
    template: "%s · GeregeldWerk",
  },
  description:
    "GeregeldWerk. Van aanvraag naar offerte. Slim geregeld. Jij doet het werk, wij doen de rest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning className={`dark ${geist.variable} ${geistMono.variable} ${accentClassName()} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a
          href="#inhoud"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Ga naar de inhoud
        </a>
        {children}
      </body>
    </html>
  );
}
