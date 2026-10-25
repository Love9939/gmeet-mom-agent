import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Google Meet MoM — Meeting Minutes & Action Items",
  description:
    "Zero-cost Google Meet tab + microphone recorder & meeting intelligence.",
  keywords: [
    "Google Meet",
    "Minutes of Meeting",
    "MoM",
    "Audio Transcription",
    "Action Items",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fbfbf9] text-[#33332e]">
        {children}
      </body>
    </html>
  );
}
