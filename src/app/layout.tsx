import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tester Selector",
  description: "Automated beta tester selection for Centercode CPMs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
