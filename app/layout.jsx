import "./globals.css";
import TabBar from "./TabBar";

export const metadata = {
  title: "Fifth Gear Fitness",
  description: "One tap to the clock.",
  appleWebApp: {
    capable: true,
    title: "Fifth Gear",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111214",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
