import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
// @ts-expect-error
import withSvgr from "next-svgr";

const withNextIntl = createNextIntlPlugin("./src/libs/i18n.ts");

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const config = withSentryConfig(
  bundleAnalyzer(
    withNextIntl(
      withSvgr({
        eslint: {
          dirs: ["."],
        },
        poweredByHeader: false,
        reactStrictMode: true,
        serverExternalPackages: ["@electric-sql/pglite"],
        // Performance optimizations
        images: {
          formats: ["image/webp", "image/avif"],
          deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
          imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
          minimumCacheTTL: 60,
          dangerouslyAllowSVG: true,
          contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        },
        // Compiler optimizations
        compiler: {
          removeConsole: process.env.NODE_ENV === "production",
        },
        // Output optimizations
        output: "standalone",
        compress: true,
        // Headers for security and performance
        headers: async () => [
          {
            source: "/(.*)",
            headers: [
              {
                key: "X-Content-Type-Options",
                value: "nosniff",
              },
              {
                key: "X-Frame-Options",
                value: "DENY",
              },
              {
                key: "X-XSS-Protection",
                value: "1; mode=block",
              },
              {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
              },
            ],
          },
          {
            source: "/static/(.*)",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable",
              },
            ],
          },
        ],
      }),
    ),
  ),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    reactComponentAnnotation: {
      enabled: true,
    },
    tunnelRoute: "/monitoring",
    disableLogger: true,
    automaticVercelMonitors: true,
    telemetry: false,
  },
);
if (config.eslint) {
  config.eslint.ignoreDuringBuilds = true;
} else {
  config.eslint = {
    ignoreDuringBuilds: true,
  };
}
if (!config.experimental) {
  config.experimental = {};
}
// Next.js 15 experimental features for performance
config.experimental = {
  ...config.experimental,
  viewTransition: true,
  // Optimize package imports
  optimizePackageImports: [
    "react",
    "react-dom",
    "lucide-react",
    "@radix-ui/react-accordion",
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-avatar",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-label",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-popover",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-select",
    "@radix-ui/react-separator",
    "@radix-ui/react-slider",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-toast",
    "@radix-ui/react-toggle",
    "@radix-ui/react-toggle-group",
    "@radix-ui/react-tooltip",
    "framer-motion",
    "recharts",
    "chart.js",
  ],
  // Optimize CSS
  optimizeCss: true,
};
if (!config.typescript) {
  config.typescript = {};
}
config.typescript.ignoreBuildErrors = true;

export default config;
