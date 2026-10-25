/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the server library out of the bundler; it is plain Node code.
  serverExternalPackages: ["@cognipeer/agent-server"],
};
export default nextConfig;
