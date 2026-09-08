import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/crm/leads/*/audio": ["./node_modules/ffmpeg-static/**/*"],
    "/api/crm/campaigns": ["./node_modules/ffmpeg-static/**/*"],
    "/api/cron/bulk-send": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
