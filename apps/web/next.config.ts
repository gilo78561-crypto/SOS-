/* global __dirname */
import type { NextConfig } from 'next';
import { resolve } from 'node:path';
const config: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../..'),
  transpilePackages: ['@sos/contracts'],
  serverExternalPackages: ['@sos/api'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
    ];
  },
};
export default config;
