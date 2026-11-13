import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const nextConfig: NextConfig = {
  basePath: BASE_PATH || undefined,
  // When served under a prefix, send visitors who hit the bare domain to the site.
  async redirects() {
    if (!BASE_PATH) return [];
    return [{ source: "/", destination: BASE_PATH, basePath: false, permanent: false }];
  },
};

export default nextConfig;
