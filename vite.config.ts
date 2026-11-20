import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Keys that must NEVER be exposed to the client bundle
const BLOCKED_CLIENT_KEYS = new Set(["NEXT_PUBLIC_GEMINI_API_KEY"]);

export default defineConfig(({ mode }) => {
  // Load only client-safe env vars (VITE_* and NEXT_PUBLIC_*), excluding blocked keys
  const env = loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]);

  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (BLOCKED_CLIENT_KEYS.has(key)) continue;
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  // Safe fallback for known public keys referenced in client code
  const knownPublicKeys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET",
    "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
    "NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION",
    "NEXT_PUBLIC_MIDTRANS_PAYMENT_LINK_1_MONTH",
    "NEXT_PUBLIC_MIDTRANS_PAYMENT_LINK_3_MONTH",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_APP_URL",
  ];
  for (const key of knownPublicKeys) {
    if (!(`process.env.${key}` in processEnvDefines)) {
      processEnvDefines[`process.env.${key}`] = JSON.stringify("");
    }
  }

  return {
    plugins: [react()],
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      ...processEnvDefines,
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3000,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "vendor-react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)/ },
              { name: "vendor-firebase", test: /node_modules[\\/](firebase|@firebase)/ },
              { name: "vendor-motion", test: /node_modules[\\/]framer-motion/ },
              { name: "vendor-charts", test: /node_modules[\\/](recharts|d3-)/ },
              { name: "vendor-pdf", test: /node_modules[\\/](jspdf|html2canvas)/ },
            ],
          },
        },
      },
    },
  };
});
