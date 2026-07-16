import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timesheet",
  description: "Invite-only biweekly payroll timesheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className="h-full font-sans antialiased"
      >
        <body className="min-h-full flex flex-col">
          <AppProviders>{children}</AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
