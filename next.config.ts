import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 这是一个每次请求都要读本地数据文件的后台应用，用不上静态预渲染那套缓存语义
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
