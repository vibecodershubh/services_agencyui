import "./globals.css";

export const metadata = {
  title: "Asterline — Build what moves business forward",
  description: "Asterline builds intelligent products, resilient cloud systems, and the delivery engines behind them.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
