const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export const htmlToText = (html: string | null | undefined): string => {
  if (!html) return "";

  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*br\b[^>]*\/?>/gi, "\n")
    .replace(/<\s*\/(?:p|div|section|article|h[1-6]|li|tr|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const hex = code[1]?.toLowerCase() === "x";
        const value = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
          ? String.fromCodePoint(value)
          : entity;
      }
      return namedEntities[code.toLowerCase()] ?? entity;
    })
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
