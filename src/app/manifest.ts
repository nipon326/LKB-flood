import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "น้ำท่วมลาดกระบัง",
    short_name: "น้ำท่วมลาดกระบัง",
    description: "ติดตามระดับน้ำคลองประเวศฯ ฝน และประกาศเตือนภัยน้ำท่วม ลาดกระบัง",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#f3f4f6",
    theme_color: "#2a78d6",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
