export default function manifest() {
  return {
    name: "Fifth Gear Fitness",
    short_name: "Fifth Gear",
    start_url: "/today",
    display: "standalone",
    background_color: "#1f3a2e",
    theme_color: "#1f3a2e",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
