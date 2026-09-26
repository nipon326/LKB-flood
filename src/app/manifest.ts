import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "น้ำท่วมลาดกระบัง",
    short_name: "น้ำท่วมลาดกระบัง",
    description: "ติดตามระดับน้ำคลองประเวศฯ ฝน และประกาศเตือนภัยน้ำท่วม ลาดกระบัง",
    start_url: "/",
    // "standalone" (not "fullscreen"/forced orientation) — responsive layout
    // handles portrait and landscape, and this keeps the OS status bar
    // visible, which is more reassuring for elderly users than a chrome-less
    // window with no visible clock/signal/battery.
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#2a78d6",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
