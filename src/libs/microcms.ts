import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

// Cloudflare Pagesやビルド環境向けに process.env / フォールバック値を参照
const serviceDomain =
  import.meta.env.MICROCMS_SERVICE_DOMAIN ||
  (typeof process !== "undefined" ? process.env.MICROCMS_SERVICE_DOMAIN : "") ||
  "";

const apiKey =
  import.meta.env.MICROCMS_API_KEY ||
  (typeof process !== "undefined" ? process.env.MICROCMS_API_KEY : "") ||
  "";

if (!serviceDomain || !apiKey) {
  console.warn("MICROCMS_SERVICE_DOMAIN or MICROCMS_API_KEY is missing.");
}

export const client = createClient({
  serviceDomain,
  apiKey,
});

export type Category = {
  id: string;
  name: string;
};

export type Tag = {
  id: string;
  tag: string;
  name?: string;
};

export type Faq = {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  revisedAt: string;
  title?: string;
  description?: string;
  content?: string;
  question?: string;
  answer?: string;
  category?: Category[];
  tag?: Tag[];
  tags?: Array<{ id: string; name: string }>;
  thumbnail?: {
    url: string;
    height: number;
    width: number;
  };
};

// ★ Blog型をFaqのエイリアスとしてエクスポート
export type Blog = Faq;

export type FaqResponse = {
  totalCount: number;
  offset: number;
  limit: number;
  contents: Faq[];
};

// ★ BlogResponse と getBlogs も必要に応じて追加
export type BlogResponse = {
  totalCount: number;
  offset: number;
  limit: number;
  contents: Blog[];
};

// FAQ一覧の取得
export const getFaqs = async (queries?: MicroCMSQueries): Promise<FaqResponse> => {
  const response = await client.get<FaqResponse>({
    endpoint: "faq",
    queries,
  });
  return {
    ...response,
    contents: response.contents.map((faq) => ({
      ...faq,
      tags: faq.tag?.map((tag) => ({ id: tag.id, name: tag.tag })) || faq.tags || [],
    })),
  };
};

// Fetch all FAQ records for static search, related links, and ranking display.
export const getAllFaqs = async (): Promise<Faq[]> => {
  const contents: Faq[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const response = await getFaqs({ limit, offset });
    contents.push(...response.contents);
    offset += response.contents.length;
    if (offset >= response.totalCount || response.contents.length === 0) break;
  }
  return contents;
};

// ブログ一覧取得（endpoint が "blogs" や "blog" の場合）
export const getBlogs = async (queries?: MicroCMSQueries): Promise<BlogResponse> => {
  return await client.get<BlogResponse>({
    endpoint: "blogs", // microCMSのエンドポイント名に合わせて調整してください
    queries,
  });
};

// FAQ詳細の取得
export const getFaqDetail = async (
  contentId: string,
  queries?: MicroCMSQueries
): Promise<Faq> => {
  const faq = await client.getListDetail<Faq>({
    endpoint: "faq",
    contentId,
    queries,
  });
  return {
    ...faq,
    tags: faq.tag?.map((tag) => ({ id: tag.id, name: tag.tag })) || faq.tags || [],
  };
};

export type TagResponse = {
  totalCount: number;
  offset: number;
  limit: number;
  contents: Tag[];
};

export const getTags = async (queries?: MicroCMSQueries): Promise<TagResponse> => {
  return await client.get<TagResponse>({ endpoint: "tag", queries });
};

// カテゴリ一覧の取得
export const getCategories = async (queries?: MicroCMSQueries) => {
  return await client.get({
    endpoint: "categories",
    queries,
  });
};

export type Settings = {
  siteUrl: string;
  title: string;
  description: string;
  ogimage?: { url: string; width?: number; height?: number } | null;
  favicon?: { url: string } | null;
  "x-account"?: string;
  "analytics-id"?: string;
  about?: string;
};

export const getSettings = async (): Promise<Settings> => {
  try {
    const data = await client.get<Settings>({
      endpoint: "settings",
    });
    return {
      siteUrl: data.siteUrl || "https://mobile.monaka496.com",
      title: data.title || "スマホのFAQ",
      description: data.description || "スマートフォンに関するよくある質問と回答を掲載しています。",
      ogimage: data.ogimage ?? undefined,
      favicon: data.favicon ?? undefined,
      "x-account": data["x-account"] || undefined,
      "analytics-id": data["analytics-id"] || undefined,
      about: data.about || "",
    };
  } catch (error) {
    return {
      siteUrl: "https://mobile.monaka496.com",
      title: "スマホのFAQ",
      description: "スマートフォンに関するよくある質問と回答を掲載しています。",
      about: "",
    };
  }
};
