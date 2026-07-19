import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { CallLensStateProvider } from "./state";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const metadataBase = new URL(`${host.startsWith("localhost") ? "http" : "https"}://${host}`);
  const title = "CallLens Coach — Dialect-aware AI QA & Coaching";
  const description = "Evidence-based quality assurance, Arabic dialect insight, and agent coaching for modern contact centers.";
  return {
    metadataBase,
    title,
    description,
    openGraph: { title, description, siteName: "CallLens Coach", type: "website", images: [{ url: "/og.png", width: 1728, height: 909, alt: "CallLens Coach product overview" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CallLensStateProvider>{children}</CallLensStateProvider></body></html>;
}
