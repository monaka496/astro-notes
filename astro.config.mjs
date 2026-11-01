import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");

export default defineConfig({
  site: env.SITE_URL || process.env.SITE_URL || "https://faq.monaka496.com",
  trailingSlash: "always",
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return !["/404", "/404/", "/search", "/search/", "/rss.xml", "/robots.txt"].includes(pathname);
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
