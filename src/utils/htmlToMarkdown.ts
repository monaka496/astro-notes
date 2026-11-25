const decodeEntities = (value: string) =>
  value.replace(/&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const hex = code[1]?.toLowerCase() === "x";
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });

const escapeMarkdownUrl = (url: string) => url.trim().replace(/[()\s]/g, (character) => encodeURIComponent(character));

const inlineMarkdown = (html: string): string =>
  html
    .replace(/<img\b([^>]*)>/gi, (_tag, attributes: string) => {
      const src = attributes.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const alt = attributes.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const imageUrl = src?.[1] ?? src?.[2] ?? src?.[3] ?? "";
      return imageUrl ? `![${alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? ""}](${escapeMarkdownUrl(imageUrl)})` : "";
    })
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_tag, attributes: string, text: string) => {
      const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const url = href?.[1] ?? href?.[2] ?? href?.[3] ?? "";
      const label = inlineMarkdown(text).trim();
      return url ? `[${label || escapeMarkdownUrl(url)}](${escapeMarkdownUrl(url)})` : label;
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*")
    .replace(/<del\b[^>]*>([\s\S]*?)<\/del\s*>/gi, "~~$1~~")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, (_tag, text: string) => `\`${decodeEntities(text.replace(/<[^>]*>/g, ""))}\``)
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<[^>]*>/g, "");

const tableToMarkdown = (html: string): string => {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(([, row]) =>
    [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)\s*>/gi)].map(([, cell]) => inlineMarkdown(cell).trim().replace(/\|/g, "\\|")),
  );
  if (rows.length === 0) return "";
  const first = `| ${rows[0].join(" | ")} |`;
  const separator = `| ${rows[0].map(() => "---").join(" | ")} |`;
  return [first, separator, ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`)].join("\n");
};

export const htmlToMarkdown = (source: string | null | undefined): string => {
  if (!source) return "";

  let markdown = source
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi, (table) => `\n${tableToMarkdown(table)}\n`)
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, (_tag, content: string) => `\n\n\`\`\`\n${decodeEntities(content.replace(/<[^>]*>/g, ""))}\n\`\`\`\n\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_tag, level: string, content: string) => `\n\n${"#".repeat(Number(level))} ${inlineMarkdown(content).trim()}\n\n`)
    .replace(/<(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<\/(?:ul|ol)\s*>/gi, "\n")
    .replace(/<blockquote\b[^>]*>/gi, "\n\n> ")
    .replace(/<\/blockquote\s*>/gi, "\n\n")
    .replace(/<hr\b[^>]*\/?>/gi, "\n\n---\n\n")
    .replace(/<p\b[^>]*>/gi, "\n\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<(?:div|section|article)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:div|section|article)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_tag, attributes: string, text: string) => {
      const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const url = href?.[1] ?? href?.[2] ?? href?.[3] ?? "";
      const label = inlineMarkdown(text).trim();
      return url ? `[${label || escapeMarkdownUrl(url)}](${escapeMarkdownUrl(url)})` : label;
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*")
    .replace(/<del\b[^>]*>([\s\S]*?)<\/del\s*>/gi, "~~$1~~")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, (_tag, text: string) => `\`${decodeEntities(text.replace(/<[^>]*>/g, ""))}\``)
    .replace(/<[^>]*>/g, "");

  markdown = decodeEntities(markdown)
    .replace(/[\t\f\v ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown;
};
