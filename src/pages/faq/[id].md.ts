import type { APIRoute, GetStaticPaths } from "astro";
import { getAllFaqs, type Faq } from "@libs/microcms";
import { getFaqContentBlocks } from "@libs/faq-content";
import { htmlToMarkdown } from "@utils/htmlToMarkdown";

const yamlString = (value: string | undefined) => JSON.stringify(value ?? "");

const contentBlockToMarkdown = (faq: Faq): string =>
  getFaqContentBlocks(faq.content)
    .map((block) => {
      if (block.fieldId === "richeditor") return htmlToMarkdown(block.richeditor);
      if (block.fieldId === "html") return htmlToMarkdown(block.html);
      if (block.fieldId === "affiliate_product") {
        const parts = [block.title ? `### ${block.title}` : "", block.image?.url ? `![${block.title || ""}](${block.image.url})` : "", block.description || ""];
        const links = [
          ["Amazon", block.amazon_url],
          ["楽天市場", block.rakuten_url],
          ["Yahoo!ショッピング", block.yahoo_url],
        ].filter(([, url]) => url).map(([label, url]) => `- [${label}](${url})`);
        return [...parts, ...links].filter(Boolean).join("\n\n");
      }
      if (block.fieldId === "affiliate_cta") {
        const label = block.label || "詳しくはこちら";
        return [block.micro_copy, block.url ? `[${label}](${block.url})` : label].filter(Boolean).join("\n\n");
      }
      if (block.fieldId === "affiliate_banner") {
        return block.banner_image?.url
          ? `[![${block.banner_image.url}](${block.banner_image.url})](${block.url || block.banner_image.url})`
          : block.url || "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

export const getStaticPaths: GetStaticPaths = async () => {
  const faqs = await getAllFaqs();
  return faqs.map((faq) => ({ params: { id: faq.id }, props: { faq } }));
};

export const GET: APIRoute = ({ props, site }) => {
  const { faq } = props as { faq: Faq };
  const title = faq.question || faq.title || "質問";
  const siteUrl = site ?? new URL("https://faq.monaka496.com/");
  const url = new URL(`/faq/${faq.id}/`, siteUrl).href;
  const categories = faq.category?.map((category) => category.name) ?? [];
  const tags = faq.tags?.map((tag) => tag.name) ?? faq.tag?.map((tag) => tag.tag) ?? [];
  const metadata = [
    "---",
    `title: ${yamlString(title)}`,
    `url: ${yamlString(url)}`,
    `category: ${JSON.stringify(categories)}`,
    `tags: ${JSON.stringify(tags)}`,
    `publishedAt: ${yamlString(faq.publishedAt)}`,
    `updatedAt: ${yamlString(faq.updatedAt || faq.publishedAt)}`,
    "---",
  ];
  const answer = htmlToMarkdown(faq.answer);
  const body = contentBlockToMarkdown(faq);
  const markdown = [
    metadata.join("\n"),
    "",
    `# ${title}`,
    "",
    "## 回答",
    "",
    answer || "回答はありません。",
    ...(body ? ["", body] : []),
    "",
  ].join("\n");

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
