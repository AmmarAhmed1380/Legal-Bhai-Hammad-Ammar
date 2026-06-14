import "./globals.css";

export const metadata = {
  title: "LegalBahi",
  description: "Secure matter and hearing management for Pakistani lawyers",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
