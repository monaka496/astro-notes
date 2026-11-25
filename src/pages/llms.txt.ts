import type { APIRoute } from "astro";
import { getAllCategories, getAllFaqs } from "@libs/microcms";
import { htmlToText } from "@utils/htmlToText";

const siteDescription =
  "スマートフォン（iPhone・Android）やモバイルキャリア・格安SIMの設定方法、トラブル解決策をわかりやすくまとめた個人の非公式FAQサイトです。";

const summarizeAnswer = (answer: string): string => {
  const text = htmlToText(answer);
  const sentenceEnd = text.indexOf("。");
  const firstSentence = sentenceEnd >= 0 ? text.slice(0, sentenceEnd + 1) : text;
  const characters = [...firstSentence];
  return characters.length > 120 ? `${characters.slice(0, 120).join("")}...` : firstSentence;
};

export const GET: APIRoute = async ({ site }) => {
  const [faqs, categories] = await Promise.all([getAllFaqs(), getAllCategories()]);
  const siteUrl = new URL("https://faq.monaka496.com/");
  if (site) siteUrl.href = site.href;
  const faqGroups = new Map(categories.map((category) => [category.id, { name: category.name, faqs: [] as typeof faqs }]));
  const uncategorized = [] as typeof faqs;

  for (const faq of faqs) {
    const faqCategories = faq.category ?? [];
    if (faqCategories.length === 0) {
      uncategorized.push(faq);
      continue;
    }
    for (const category of faqCategories) {
      const group = faqGroups.get(category.id);
      if (group) group.faqs.push(faq);
      else uncategorized.push(faq);
    }
  }

  const lines = [
    "# スマホのFAQ",
    "",
    `> ${siteDescription}`,
    "",
    `- サイトURL: [${siteUrl.href}](${siteUrl.href})`,
    `- 全FAQ全文データ: [${new URL("/llms-full.txt", siteUrl).href}](${new URL("/llms-full.txt", siteUrl).href})`,
  ];

  for (const { name, faqs: categoryFaqs } of faqGroups.values()) {
    if (categoryFaqs.length === 0) continue;
    lines.push("", `## ${name}`);
    for (const faq of categoryFaqs) {
      const title = faq.question || faq.title || "質問";
      const summary = summarizeAnswer(faq.answer);
      lines.push(`- [${title}](${new URL(`/faq/${faq.id}/`, siteUrl).href}): ${summary} ([Markdown](${new URL(`/faq/${faq.id}.md`, siteUrl).href}))`);
    }
  }

  if (uncategorized.length > 0) {
    lines.push("", "## その他");
    for (const faq of uncategorized) {
      const title = faq.question || faq.title || "質問";
      const summary = summarizeAnswer(faq.answer);
      lines.push(`- [${title}](${new URL(`/faq/${faq.id}/`, siteUrl).href}): ${summary} ([Markdown](${new URL(`/faq/${faq.id}.md`, siteUrl).href}))`);
    }
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
