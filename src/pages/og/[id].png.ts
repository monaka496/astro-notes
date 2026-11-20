import type { APIRoute, GetStaticPaths } from "astro";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { getAllFaqs, getFaqDetail } from "@libs/microcms";

const fontDirectory = join(process.cwd(), "node_modules/@fontsource/noto-sans-jp/files");
const fontData = [
  {
    name: "Noto Sans JP",
    data: readFileSync(join(fontDirectory, "noto-sans-jp-japanese-700-normal.woff")),
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    name: "Noto Sans JP",
    data: readFileSync(join(fontDirectory, "noto-sans-jp-latin-700-normal.woff")),
    weight: 700 as const,
    style: "normal" as const,
  },
];

export const getStaticPaths: GetStaticPaths = async () => {
  const faqs = await getAllFaqs();
  return faqs.map(({ id }) => ({ params: { id } }));
};

export const GET: APIRoute = async ({ params }) => {
  const faq = params.id ? await getFaqDetail(params.id) : null;
  if (!faq) return new Response("FAQ not found", { status: 404 });

  const title = faq.question || faq.title || "FAQ詳細";
  const category = faq.category?.[0]?.name;
  const svg = await satori(
    {
      type: "div",
      props: {
        style: { width: "1200px", height: "630px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", background: "#f8fafc", color: "#0f172a", padding: "64px 72px", border: "18px solid #2563eb", fontFamily: "Noto Sans JP" },
        children: [
          ...(category ? [{ type: "div", props: { style: { display: "flex", alignSelf: "flex-start", background: "#dbeafe", color: "#1d4ed8", borderRadius: "999px", padding: "10px 24px", fontSize: 24, marginBottom: 32 }, children: category } }] : []),
          { type: "div", props: { style: { display: "flex", alignItems: "flex-start", gap: 24, maxHeight: 350, overflow: "hidden", minWidth: 0 }, children: [
            { type: "div", props: { style: { display: "flex", color: "#2563eb", fontSize: 64, fontWeight: 700, flexShrink: 0 }, children: "Q." } },
            { type: "div", props: { style: { display: "flex", flex: 1, minWidth: 0, fontSize: title.length > 40 ? 42 : 54, fontWeight: 700, lineHeight: 1.45, overflowWrap: "anywhere" }, children: title } },
          ] } },
          { type: "div", props: { style: { display: "flex", alignSelf: "flex-end", color: "#64748b", fontSize: 24, marginTop: 24 }, children: "スマホのFAQ" } },
        ],
      },
    },
    { width: 1200, height: 630, fonts: fontData }
  );
  const png = await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer();
  return new Response(png, { headers: { "Content-Type": "image/png" } });
};
