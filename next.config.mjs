/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4300/api/:path*",
      },
      {
        source: "/ws",
        destination: "http://127.0.0.1:4300/ws",
      },
      {
        source: "/ws/:path*",
        destination: "http://127.0.0.1:4300/ws/:path*",
      },
    ];
  },
};

export default nextConfig;
