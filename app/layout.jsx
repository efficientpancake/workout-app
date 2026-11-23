import "./globals.css";
import TabBar from "./TabBar";

export const metadata = {
  title: "Fifth Gear Fitness",
  description: "Plan your week, log your food, run your workout.",
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
  themeColor: "#1f3a2e",
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
