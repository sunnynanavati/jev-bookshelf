import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev Bookshelf",
  description: "Ask a moving bookshelf and pull the right books into view.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
