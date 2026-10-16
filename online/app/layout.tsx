import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "筑波大学書道部",
  description: "筑波大学書道部の活動・作品と、ハワイへの挑戦をご紹介します。",
  icons: {
    icon: "/assets/icons/brush.svg",
    shortcut: "/assets/icons/brush.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
