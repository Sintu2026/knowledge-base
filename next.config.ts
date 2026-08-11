import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Screen recordings upload through a server action; the default 1MB
      // limit fits neither them nor document blocks.
      bodySizeLimit: "250mb",
    },
  },
};

export default nextConfig;
