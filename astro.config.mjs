import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const serviceDomain = env.MICROCMS_SERVICE_DOMAIN || process.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = env.MICROCMS_API_KEY || process.env.MICROCMS_API_KEY;
const siteUrl = env.SITE_URL || process.env.SITE_URL || "https://faq.monaka496.com";

const getFaqLastmodData = async () => {
  const faqLastmodByUrl = new Map();
  let latestUpdatedAt;

  if (!serviceDomain || !apiKey) {
    console.warn("[sitemap] microCMS credentials are missing; FAQ lastmod values will be omitted.");
    return { faqLastmodByUrl, latestUpdatedAt };
  }

  try {
    let offset = 0;
    const limit = 100;
    while (true) {
      const url = new URL(`https://${serviceDomain}.microcms.io/api/v1/faq`);
      url.searchParams.set("fields", "id,updatedAt,publishedAt");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      const response = await fetch(url, { headers: { "X-MICROCMS-API-KEY": apiKey } });
      if (!response.ok) throw new Error(`microCMS returned ${response.status}`);

      const data = await response.json();
      for (const faq of data.contents ?? []) {
        const date = faq.updatedAt || faq.publishedAt;
        if (!faq.id || !date) continue;
        const timestamp = Date.parse(date);
        if (!Number.isFinite(timestamp)) continue;

        const isoDate = new Date(timestamp).toISOString();
        faqLastmodByUrl.set(new URL(`/faq/${faq.id}/`, siteUrl).href, isoDate);
        if (!latestUpdatedAt || timestamp > Date.parse(latestUpdatedAt)) latestUpdatedAt = isoDate;
      }

      offset += (data.contents ?? []).length;
      if (offset >= (data.totalCount ?? 0) || (data.contents ?? []).length === 0) break;
    }
  } catch (error) {
    console.warn("[sitemap] Failed to fetch microCMS FAQ dates; FAQ lastmod values will be omitted.", error);
    return { faqLastmodByUrl: new Map(), latestUpdatedAt: undefined };
  }

  return { faqLastmodByUrl, latestUpdatedAt };
};

const { faqLastmodByUrl, latestUpdatedAt } = await getFaqLastmodData();

export default defineConfig({
  site: siteUrl,
  trailingSlash: "ignore",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return ![
          "/404",
          "/404/",
          "/preview",
          "/preview/",
          "/contact/complete",
          "/contact/complete/",
          "/search",
          "/search/",
          "/rss.xml",
          "/robots.txt",
        ].includes(pathname);
      },
      serialize(item) {
        const pathname = new URL(item.url).pathname.replace(/\/+$/, "") || "/";
        const faqMatch = pathname.match(/^\/faq\/([^/]+)$/);
        if (faqMatch) {
          const faqUrl = new URL(`/faq/${faqMatch[1]}/`, siteUrl).href;
          const lastmod = faqLastmodByUrl.get(faqUrl);
          if (lastmod) item.lastmod = lastmod;
        } else if (pathname === "/" || pathname.startsWith("/category/")) {
          item.lastmod = latestUpdatedAt || new Date().toISOString();
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
