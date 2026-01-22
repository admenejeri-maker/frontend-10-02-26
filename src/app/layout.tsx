import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scoop AI - ქირონი | სპორტული კვების კონსულტანტი",
  description: "სპორტული კვების პირადი ასისტენტი - პროტეინი, კრეატინი, ვიტამინები და სხვა",
  keywords: "scoop, protein, creatine, supplements, sports nutrition, საქართველო",
  openGraph: {
    title: "Scoop AI - ქირონი",
    description: "სპორტული კვების პირადი ასისტენტი",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka">
      <body className={`${notoSans.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
