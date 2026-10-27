import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waste Hub · Operations console",
  description:
    "Municipal waste operations, integrations, data quality and governance.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
