import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['exceljs', 'nodemailer', 'google-auth-library'],
  experimental: {
    // Foto sesudah diunggah lewat server action; batas body Vercel 4,5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};

export default nextConfig;
