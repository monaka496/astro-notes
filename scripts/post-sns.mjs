import { BskyAgent, RichText } from '@atproto/api';

const contentId = process.env.CONTENT_ID?.trim();
if (!contentId) throw new Error('CONTENT_ID is required');

const articleUrl = `https://faq.monaka496.com/faq/${encodeURIComponent(contentId)}/`;

async function getTitle() {
  const suppliedTitle = process.env.TITLE?.trim();
  if (suppliedTitle) return suppliedTitle;

  const domain = process.env.MICROCMS_SERVICE_DOMAIN?.trim();
  const apiKey = process.env.MICROCMS_API_KEY?.trim();
  if (!domain || !apiKey) throw new Error('TITLE or MICROCMS_SERVICE_DOMAIN and MICROCMS_API_KEY are required');

  const response = await fetch(`https://${domain}.microcms.io/api/v1/faq/${encodeURIComponent(contentId)}`, {
    headers: { 'X-MICROCMS-API-KEY': apiKey },
  });
  if (!response.ok) throw new Error(`microCMS title lookup failed: HTTP ${response.status}`);
  const article = await response.json();
  const title = article.question ?? article.title;
  if (typeof title !== 'string' || !title.trim()) throw new Error('microCMS response has no question or title');
  return title.trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPublishedPage() {
  console.log('Waiting 90 seconds for Cloudflare Pages deployment...');
  await sleep(90_000);
  console.log('Finished waiting for Cloudflare Pages deployment.');
}

async function postMastodon(text) {
  const instance = process.env.MASTODON_INSTANCE?.replace(/\/$/, '');
  if (!instance || !process.env.MASTODON_ACCESS_TOKEN) throw new Error('Mastodon credentials are required');
  const response = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: text }),
  });
  if (!response.ok) throw new Error(`Mastodon post failed: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function postBluesky(text) {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error('Bluesky credentials are required');
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier, password });
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
        title: process.env.TITLE?.trim() || text.split('\n')[0],
        description: process.env.CATEGORY?.trim() || '新しいFAQ記事',
      },
    },
  });
}

const title = await getTitle();
await waitForPublishedPage();
const postText = `${title}\n${articleUrl}`;
const results = await Promise.allSettled([
  ['Mastodon', () => postMastodon(`${title}\n${articleUrl}`)],
  ['Bluesky', () => postBluesky(`${title}\n${articleUrl}`)],
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
