import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only used in the collapsed agent log, so it should not compete with the main font on first load.
  preload: false,
});

const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

const description ="Find the university city abroad that fits your taste in music, film, food and hobbies.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tasteabroad.vercel.app"),
  title: "TasteAbroad",
  description,
  openGraph: { title: "TasteAbroad", description, siteName: "TasteAbroad", type: "website" },
  twitter: { card: "summary", title: "TasteAbroad", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script below may set data-theme before React loads.
      suppressHydrationWarning
    >
      <head>
        {/* Apply a saved dark-mode choice before the first paint, so the page never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
