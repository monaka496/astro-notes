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
  answer: string;
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

// FAQ下書きプレビューの取得
export const getFaqPreview = async (contentId: string, draftKey: string): Promise<Faq> => {
  const faq = await client.get<Faq>({
    endpoint: "faq",
    contentId,
    queries: { draftKey },
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

export type SiteConfig = {
  siteUrl: string;
  title: string;
  description: string;
  defaultOgpImage?: { url: string; width?: number; height?: number } | null;
  favicon?: { url: string } | null;
  appleTouchIcon?: { url: string; height: number; width: number } | null;
  logo?: { url: string; width?: number; height?: number } | null;
  snsLinks?: Array<{
    "x-twitter"?: string;
    mastodon?: string;
    bluesky?: string;
  }> | null;
  copyright?: string;
  analyticsId?: string;
  SSGFormUrl?: string;
  noticeText?: string;
  enableNotice?: boolean;
  about?: string;
};

type SiteConfigResponse = SiteConfig & {
  // Older settings schema compatibility.
  ogimage?: SiteConfig["defaultOgpImage"];
  "x-account"?: string;
  "analytics-id"?: string;
};

const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteUrl: "https://faq.monaka496.com/",
  title: "スマホのFAQ",
  description: "スマホの端末設定や通信キャリアの疑問を解決するFAQサイトです",
  enableNotice: false,
};

export const getSiteConfig = async (): Promise<SiteConfig> => {
  try {
    const data = await client.get<SiteConfigResponse>({
      endpoint: "settings",
    });
    const title = data.title || DEFAULT_SITE_CONFIG.title;
    const legacyXAccount = data["x-account"];
    return {
      ...DEFAULT_SITE_CONFIG,
      ...data,
      siteUrl: data.siteUrl || DEFAULT_SITE_CONFIG.siteUrl,
      title,
      description: data.description || DEFAULT_SITE_CONFIG.description,
      defaultOgpImage: data.defaultOgpImage ?? data.ogimage ?? undefined,
      favicon: data.favicon ?? undefined,
      logo: data.logo ?? undefined,
      snsLinks: data.snsLinks ?? (legacyXAccount ? [{ "x-twitter": legacyXAccount.startsWith("http") ? legacyXAccount : `https://x.com/${legacyXAccount.replace(/^@/, "")}` }] : []),
      copyright: data.copyright || `© ${new Date().getFullYear()} ${title} ALL Rights Reserved`,
      analyticsId: data.analyticsId || data["analytics-id"] || undefined,
      SSGFormUrl: data.SSGFormUrl || undefined,
      noticeText: data.noticeText || "",
      enableNotice: data.enableNotice ?? false,
      about: data.about || "",
    };
  } catch {
    return {
      ...DEFAULT_SITE_CONFIG,
      copyright: `© ${new Date().getFullYear()} ${DEFAULT_SITE_CONFIG.title} ALL Rights Reserved`,
      snsLinks: [],
      about: "",
    };
  }
};

// Existing page code uses this function for the optional ABOUT body.
export type Settings = SiteConfig;
export const getSettings = getSiteConfig;
