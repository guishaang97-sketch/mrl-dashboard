import "./globals.css";
import { ReactNode } from "react";
import { AuthProvider } from "@/lib/AuthProvider";
import Nav from "@/components/Nav";

export const metadata = {
  title: "MRL Cybertec — Service Dashboard",
  description: "Internal service ticketing dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
