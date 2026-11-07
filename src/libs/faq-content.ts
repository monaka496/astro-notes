import type { FaqContentBlock } from "@libs/microcms";

export const getFaqContentBlocks = (content: FaqContentBlock[] | string | undefined): FaqContentBlock[] => {
  if (typeof content === "string") return [{ fieldId: "richeditor", richeditor: content }];
  return Array.isArray(content) ? content : [];
};

export const getFaqContentHtml = (content: FaqContentBlock[] | string | undefined): string =>
  getFaqContentBlocks(content)
    .map((block) => {
      if (block.fieldId === "richeditor") return block.richeditor || "";
      if (block.fieldId === "html") return block.html || "";
      return "";
    })
    .join(" ");

export const getFaqContentText = (content: FaqContentBlock[] | string | undefined): string =>
  getFaqContentHtml(content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
