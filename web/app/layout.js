import { Prata, Archivo } from "next/font/google";
import "./globals.css";

const prata = Prata({ weight: "400", subsets: ["latin"], variable: "--font-serif", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "ETDOX — Build what moves business forward",
  description: "ETDOX builds intelligent products, resilient cloud systems, and the delivery engines behind them.",
};

export default function RootLayout({ children }) {
  return <html lang="en" className={`${prata.variable} ${archivo.variable}`}><body>{children}</body></html>;
}
