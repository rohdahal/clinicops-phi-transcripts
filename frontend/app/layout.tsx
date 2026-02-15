import type { Metadata } from "next";
import AppFooter from "@/src/components/AppFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicOps PHI Transcript Ops",
  description: "ClinicOps PHI Transcript Ops"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
