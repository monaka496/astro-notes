import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = site ? new URL("sitemap-index.xml", site).href : "/sitemap-index.xml";
  const disallowedPaths = ["/preview/", "/contact/complete/", "/search/", "/404"];
  const disallowRules = disallowedPaths.map((path) => `Disallow: ${path}`).join("\n");
  const userAgents = [
    "OAI-SearchBot",
    "PerplexityBot",
    "Claude-SearchBot",
    "GPTBot",
    "Google-Extended",
    "ClaudeBot",
    "CCBot",
    "Bytespider",
  ];
  const aiCrawlerRules = userAgents
    .map((userAgent) => `User-agent: ${userAgent}\nAllow: /\n${disallowRules}`)
    .join("\n\n");

  return new Response(
    `User-agent: *\nAllow: /\n${disallowRules}\n\n${aiCrawlerRules}\n\nSitemap: ${sitemapUrl}\n`,
    {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
};
