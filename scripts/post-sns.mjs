import { BskyAgent, RichText } from '@atproto/api';
import satori from 'satori';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const contentId = process.env.CONTENT_ID?.trim();
if (!contentId) throw new Error('CONTENT_ID is required');

const articleUrl = `https://faq.monaka496.com/faq/${encodeURIComponent(contentId)}/`;

async function getArticleData() {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN?.trim();
  const apiKey = process.env.MICROCMS_API_KEY?.trim();
  let article = {};
  if (domain && apiKey) {
    const response = await fetch(`https://${domain}.microcms.io/api/v1/faq/${encodeURIComponent(contentId)}`, {
      headers: { 'X-MICROCMS-API-KEY': apiKey },
    });
    if (!response.ok) throw new Error(`microCMS article lookup failed: HTTP ${response.status}`);
    article = await response.json();
  }

  const suppliedTitle = process.env.TITLE?.trim();
  const title = suppliedTitle || article.question || article.title || '新着FAQ';
  const plainAnswer = typeof article.answer === 'string'
    ? article.answer.replace(/<[^>]*>/g, ' ').replace(/(?:&nbsp;|\s)+/gi, ' ').trim()
    : '';
  const description = plainAnswer.slice(0, 100) || 'スマホの疑問やトラブルをわかりやすく解決するFAQサイト';
  const categoryValue = article.category?.name ?? article.category?.[0]?.name ?? process.env.CATEGORY?.trim() ?? '';
  return { title, description, category: categoryValue };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPublishedPage() {
  console.log('Waiting 180 seconds for Cloudflare Pages deployment...');
  await sleep(180 * 1000);
  console.log('Finished waiting for Cloudflare Pages deployment.');
}

async function generateOgImageBuffer(title, category) {
  try {
    const scriptDirectory = dirname(fileURLToPath(import.meta.url));
    const fontDirectory = join(scriptDirectory, '..', 'node_modules', '@fontsource', 'noto-sans-jp', 'files');
    const fonts = await Promise.all([
      readFile(join(fontDirectory, 'noto-sans-jp-japanese-700-normal.woff')),
      readFile(join(fontDirectory, 'noto-sans-jp-latin-700-normal.woff')),
    ]);
    const fontData = fonts.map((data) => ({ name: 'Noto Sans JP', data, weight: 700, style: 'normal' }));
    const svg = await satori({
      type: 'div',
      props: {
        style: { width: '1200px', height: '630px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', padding: '64px 72px', border: '18px solid #2563eb', fontFamily: 'Noto Sans JP' },
        children: [
          ...(category ? [{ type: 'div', props: { style: { display: 'flex', alignSelf: 'flex-start', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', padding: '10px 24px', fontSize: 24, marginBottom: 32 }, children: category } }] : []),
          { type: 'div', props: { style: { display: 'flex', alignItems: 'flex-start', gap: 24, maxHeight: 350, overflow: 'hidden', minWidth: 0 }, children: [
            { type: 'div', props: { style: { display: 'flex', color: '#2563eb', fontSize: 64, fontWeight: 700, flexShrink: 0 }, children: 'Q.' } },
            { type: 'div', props: { style: { display: 'flex', flex: 1, minWidth: 0, fontSize: title.length > 40 ? 42 : 54, fontWeight: 700, lineHeight: 1.45, overflowWrap: 'anywhere' }, children: title } },
          ] } },
          { type: 'div', props: { style: { display: 'flex', alignSelf: 'flex-end', color: '#64748b', fontSize: 24, marginTop: 24 }, children: 'スマホのFAQ' } },
        ],
      },
    }, { width: 1200, height: 630, fonts: fontData });
    return await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer();
  } catch (error) {
    console.warn('OGP image generation failed; continuing without an image:', error);
    return null;
  }
}

async function uploadMastodonMedia(instance, token, ogBuffer, title) {
  const formData = new FormData();
  formData.append('file', new Blob([ogBuffer], { type: 'image/png' }), 'ogp.png');
  formData.append('description', title);
  let lastError;
  for (const endpoint of ['/api/v2/media', '/api/v1/media']) {
    try {
      const response = await fetch(`${instance}${endpoint}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
      const media = await response.json();
      if (!media.id) throw new Error('Mastodon media response did not include an id');
      return media.id;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Mastodon media upload failed: ${lastError}`);
}

async function postMastodon(text, ogBuffer, title) {
  const instance = process.env.MASTODON_INSTANCE?.replace(/\/$/, '');
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) throw new Error('Mastodon credentials are required');
  const mediaId = ogBuffer ? await uploadMastodonMedia(instance, token, ogBuffer, title) : null;
  const response = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: text, ...(mediaId ? { media_ids: [mediaId] } : {}) }),
  });
  if (!response.ok) throw new Error(`Mastodon post failed: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function postBluesky(text, ogBuffer, { title, description }) {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error('Bluesky credentials are required');
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier, password });
  let thumbBlob;
  if (ogBuffer) {
    const res = await agent.uploadBlob(new Uint8Array(ogBuffer), { encoding: 'image/png' });
    thumbBlob = res.data.blob;
  }
  const richText = new RichText({ text });
  await richText.detectFacets(agent);
  return agent.post({
    $type: 'app.bsky.feed.post',
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: articleUrl,
        title,
        description,
        ...(thumbBlob ? { thumb: thumbBlob } : {}),
      },
    },
  });
}

const article = await getArticleData();
const { title, description, category } = article;
const ogBuffer = await generateOgImageBuffer(title, category);
await waitForPublishedPage();
const postText = `${title}\n${articleUrl}`;
const results = await Promise.allSettled([
  ['Mastodon', () => postMastodon(postText, ogBuffer, title)],
  ['Bluesky', () => postBluesky(postText, ogBuffer, article)],
].map(async ([name, post]) => ({ name, result: await post() })));

let failures = 0;
for (let index = 0; index < results.length; index += 1) {
  const name = ['Mastodon', 'Bluesky'][index];
  const result = results[index];
  if (result.status === 'fulfilled') console.log(`${name} post succeeded`, result.value.result);
  else {
    failures += 1;
    console.error(`${name} post failed:`, result.reason);
  }
}
if (failures) process.exitCode = 1;
