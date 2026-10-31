import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getAllFaqs } from "@libs/microcms";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const GET: APIRoute = async ({ site }) => {
  const faqs = await getAllFaqs();
  const items = faqs
    .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
    .map((faq) => {
      const title = faq.question || faq.title || "無題の質問";
      const body = [faq.answer ? `<p>${escapeHtml(faq.answer)}</p>` : "", faq.content || ""].filter(Boolean).join("\n");
      const plainText = [faq.answer, faq.content, faq.description]
        .filter(Boolean)
        .join(" ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const publishedDate = new Date(faq.publishedAt || faq.createdAt);

      return {
        title,
        description: (faq.description || plainText).slice(0, 300),
        link: `/faq/${encodeURIComponent(faq.id)}/`,
        pubDate: Number.isNaN(publishedDate.getTime()) ? undefined : publishedDate,
        content: body || plainText,
      };
    });

  return rss({
    title: "FAQサイト",
    description: "よくある質問と回答を検索できます。",
    site: site ?? new URL("http://localhost:4321"),
    items,
    trailingSlash: false,
    customData: "<language>ja</language>",
  });
};
