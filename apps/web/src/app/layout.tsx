import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIMS",
  description: "Multi-tenant Hospital Information Management System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
