/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@wakeel/shared"],
  async rewrites() {
    return [
      { source: "/overview", destination: "/product/staff" },
      { source: "/matters", destination: "/product/staff" },
      { source: "/matters/:path*", destination: "/product/staff" },
      { source: "/calendar", destination: "/product/staff" },
      { source: "/alerts", destination: "/product/staff" },
      { source: "/clients", destination: "/product/staff" },
      { source: "/vault", destination: "/product/staff" },
      { source: "/billing", destination: "/product/staff" },
      { source: "/team", destination: "/product/staff" },
      { source: "/settings", destination: "/product/staff" },
      { source: "/reports", destination: "/product/staff" },
      { source: "/onboarding", destination: "/product/staff" },
      { source: "/onboarding/:path*", destination: "/product/staff" }
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/product/staff", permanent: false },
      { source: "/cases", destination: "/matters", permanent: false },
      { source: "/cases/:id", destination: "/matters/:id", permanent: false },
    ];
  },
};

export default nextConfig;
