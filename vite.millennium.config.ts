import { defineConfig } from "vite";
import path from "node:path";
import deckyConfig from "./vite.plugin.config";

export default defineConfig(async (env) => {
  const base = await (deckyConfig as any)(env);
  const aliases = (base.resolve?.alias ?? []).map((entry: any) => {
    const replacement = String(entry.replacement ?? "");
    if (replacement.endsWith("src\\shims\\decky-api.ts") || replacement.endsWith("src/shims/decky-api.ts")) {
      return { ...entry, replacement: path.resolve(__dirname, "src/shims/millennium-api.ts") };
    }
    if (replacement.endsWith("src\\shims\\decky-ui.ts") || replacement.endsWith("src/shims/decky-ui.ts")) {
      return { ...entry, replacement: path.resolve(__dirname, "src/shims/millennium-ui.ts") };
    }
    return entry;
  });

  return {
    ...base,
    resolve: { ...base.resolve, alias: aliases },
    build: {
      ...base.build,
      outDir: ".millennium/Dist",
      emptyOutDir: true,
      lib: {
        ...base.build?.lib,
        entry: path.resolve(__dirname, "src/millennium-entry.tsx"),
      },
      rollupOptions: {
        ...base.build?.rollupOptions,
        output: {
          entryFileNames: "index.js",
          assetFileNames: "assets/[name]-[hash][extname]",
          codeSplitting: false,
        },
      },
    },
  };
});
