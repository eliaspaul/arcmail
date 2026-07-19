import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "ArcMail — Web3 Messenger",
  description: "Encrypted wallet-to-wallet messaging on Arc Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}