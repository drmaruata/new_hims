import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@hims/domain-types',
    '@hims/validation',
    '@hims/api-client',
    '@hims/ui',
    '@hims/auth',
    '@hims/date-time',
    '@hims/localization',
    '@hims/clinical-safety',
  ],
};

export default nextConfig;
