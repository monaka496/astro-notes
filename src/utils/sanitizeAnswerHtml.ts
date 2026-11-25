const allowedTags = new Set(["p", "br", "ul", "ol", "li", "strong", "a"]);

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const sanitizeAnswerHtml = (html: string | null | undefined): string => {
  if (!html) return "";

  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (!part.startsWith("<")) return part.replace(/</g, "&lt;");

      const match = part.match(/^<\s*(\/?)\s*([a-z][\w-]*)\b([^>]*)>$/i);
      if (!match) return "";
      const [, closing, rawName, attributes] = match;
      const name = rawName.toLowerCase();
      if (!allowedTags.has(name)) return "";
      if (closing) return `</${name}>`;
      if (name !== "a") return `<${name}>`;

      const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = (href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim();
      const safeHref = /^(?:https?:\/\/|\/|#|mailto:)/i.test(value) ? value : "";
      return safeHref ? `<a href="${escapeAttribute(safeHref)}">` : "<a>";
    })
    .join("");
};
