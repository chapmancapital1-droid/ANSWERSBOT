/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@answerspot/shared-types'],
  output: 'standalone',
};

export default nextConfig;
