import type { NextConfig } from "next";

const remotePatterns: NextConfig['images']['remotePatterns'] = [];

const r2BaseUrl = process.env.R2_PUBLIC_BASE_URL ?? 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev';

try {
  const parsed = new URL(r2BaseUrl);
  remotePatterns.push({
    protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
    hostname: parsed.hostname,
    pathname: '/**',
  });
} catch (error) {
  console.warn('Invalid R2_PUBLIC_BASE_URL, falling back to default domain.', error);
  remotePatterns.push({
    protocol: 'https',
    hostname: 'pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev',
    pathname: '/**',
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
