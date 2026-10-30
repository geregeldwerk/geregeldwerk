import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const themeScript = `(function(){try{var t=localStorage.getItem("geregeldwerk-theme");if(t==="light")document.documentElement.classList.remove("dark");else document.documentElement.classList.add("dark");}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "Geregeldwerk",
    template: "%s · Geregeldwerk",
  },
  description:
    "Geregeldwerk helpt Nederlandse installateurs en klusbedrijven een appje of e-mail om te zetten in een conceptofferte. Jij doet het werk, wij doen de rest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
