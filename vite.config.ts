// Config padrão do TanStack Start + Vite, sem depender de pacotes do Lovable.
// Preset de deploy: "vercel" quando VERCEL=1 (Vercel define essa env automaticamente),
// senão "cloudflare-module" (Cloudflare Workers/Pages). Ajuste NITRO_PRESET se usar
// outro alvo (ex: "node-server" para rodar num servidor Node/VPS próprio).
import { defineConfig, loadEnv, type UserConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function resolveNitroPreset(): string {
  if (process.env.NITRO_PRESET) return process.env.NITRO_PRESET;
  if (process.env.VERCEL) return "vercel";
  return "cloudflare-module";
}

export default defineConfig(async ({ mode }) => {
  const internalPlugins = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    internalPlugins.push(
      devtools({
        logging: false,
        eventBusConfig: { enabled: false },
        enhancedLogs: { enabled: false },
        consolePiping: { enabled: false },
        removeDevtoolsOnBuild: false,
        injectSource: { enabled: true },
      }),
    );
  }

  internalPlugins.push(tailwindcss());
  internalPlugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));
  internalPlugins.push(
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
  );
  internalPlugins.push(
    nitro({
      preset: resolveNitroPreset(),
    }),
  );
  internalPlugins.push(viteReact());
  internalPlugins.push(
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      outDir: "dist/client",
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        globDirectory: "dist/client",
        globPatterns: ["**/*.{js,css,woff,woff2,png,jpg,svg,ico}"],
        navigateFallback: undefined,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Navegações/HTML: rede primeiro, cache como reserva offline.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  );

  // Replica o comportamento anterior de expor VITE_* via import.meta.env também
  // durante o bundle do servidor (SSR/Nitro), não só no client.
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const config: UserConfig = {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: internalPlugins,
  };

  return config;
});
