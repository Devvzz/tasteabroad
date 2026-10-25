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
});

const description = "Find the university city abroad that fits your taste in music, film, food and hobbies.";

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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
