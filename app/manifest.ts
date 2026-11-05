import type { MetadataRoute } from "next";
import { APP_NAME, DEPARTMENT_NAME } from "@/lib/branding";
import { THEME } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: `Submit payment requests to the ${DEPARTMENT_NAME}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: THEME.brand,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
