import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CompanyProvider } from "@/components/providers/company-provider";
import { FinancialYearProvider } from "@/components/providers/financial-year-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentCompany } from "@/lib/current-company";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Premgiri Books ERP",
  description: "Modular ERP for accounting, GST, inventory, and billing.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentCompany = await getCurrentCompany();
  const currentFinancialYear = await getCurrentFinancialYear();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <CompanyProvider initialCompany={currentCompany}>
            <FinancialYearProvider initialFinancialYear={currentFinancialYear}>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </FinancialYearProvider>
          </CompanyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
