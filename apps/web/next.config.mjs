/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@wakeel/shared"],
  async redirects() {
    return [
      { source: "/", destination: "/product/staff", permanent: false },
      { source: "/dashboard", destination: "/product/staff", permanent: false },
      { source: "/cases", destination: "/product/staff", permanent: false },
      { source: "/cases/:id", destination: "/product/staff", permanent: false },
    ];
  },
};

export default nextConfig;
