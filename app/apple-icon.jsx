import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: a simple stopwatch face, green on dark.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111214",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ width: 28, height: 14, background: "#2fbf71", borderRadius: 4, marginBottom: 6 }} />
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            border: "12px solid #2fbf71",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 10, height: 38, background: "#f4f4f2", borderRadius: 5, marginBottom: 30 }} />
        </div>
      </div>
    ),
    size
  );
}
