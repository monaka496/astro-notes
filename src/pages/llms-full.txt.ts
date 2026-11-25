import type { APIRoute } from "astro";
import { getAllFaqs } from "@libs/microcms";
import { htmlToText } from "@utils/htmlToText";

export const GET: APIRoute = async ({ site }) => {
  const faqs = await getAllFaqs();
  const siteUrl = site ?? new URL("https://faq.monaka496.com/");
  const lines = [
    "# スマホのFAQ - 全記事データ",
    "",
    `> スマートフォン・モバイル通信に関するQ&Aデータベース（[${siteUrl.href}](${siteUrl.href})）`,
  ];

  for (const faq of faqs) {
    const title = faq.question || faq.title || "質問";
    const date = faq.updatedAt || faq.publishedAt;
    const timestamp = date ? Date.parse(date) : Number.NaN;
    const updatedDate = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "不明";
    const categoryNames = faq.category?.map((category) => category.name).join("、") || "その他";
    lines.push(
      "",
      "---",
      "",
      `## Q: ${title}`,
      `- URL: ${new URL(`/faq/${faq.id}/`, siteUrl).href}`,
      `- カテゴリ: ${categoryNames}`,
      `- 最終更新日: ${updatedDate}`,
      "",
      "### A:",
      "",
      htmlToText(faq.answer) || "（回答なし）",
    );
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
