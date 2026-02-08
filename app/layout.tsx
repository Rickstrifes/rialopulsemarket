import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";
import Navbar from "@/components/Navbar";

import { Toaster } from "react-hot-toast";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Pulse - Solana Prediction Market",
  description: "Predict the future on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} antialiased min-h-screen flex flex-col font-sans`}
      >
        <WalletContextProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#13141f",
                color: "#fff",
                border: "1px solid #1f2937", // border-gray-800
                borderRadius: "8px",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
              },
              success: {
                duration: 4000,
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#13141f",
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#13141f",
                },
              },
            }}
          />
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-800">
            Made by{" "}
            <a
              href="https://x.com/Rickstrife08"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              @Rickstrife08
            </a>
            {" "}&{" "}
            <a
              href="https://x.com/nurairstalk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              @nurairstalk
            </a>
          </footer>
        </WalletContextProvider>
      </body>
    </html>
  );
}
