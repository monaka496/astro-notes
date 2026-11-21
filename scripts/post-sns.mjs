import { TwitterApi } from 'twitter-api-v2';
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

function truncateForX(title, url) {
  // Reserve X's 23-character t.co URL and one newline from its 280-unit limit.
  const maxTitleWeight = 280 - 23 - 1;
  const weight = (char) => /[\u1100-\u11ff\u2e80-\uA4cf\uAC00-\uD7af\uF900-\uFAFF\uFE10-\uFE6f\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u.test(char) ? 2 : 1;
  const chars = Array.from(title);
  if (chars.reduce((sum, char) => sum + weight(char), 0) <= maxTitleWeight) return `${title}\n${url}`;
  let shortened = '';
  let used = 3; // account for the three ASCII dots
  for (const char of chars) {
    const charWeight = weight(char);
    if (used + charWeight > maxTitleWeight) break;
    shortened += char;
    used += charWeight;
  }
  return `${shortened}...\n${url}`;
}

async function postX(text) {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });
  return client.v2.tweet(text);
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
const postText = truncateForX(title, articleUrl);
const results = await Promise.allSettled([
  ['X', () => postX(postText)],
  ['Mastodon', () => postMastodon(`${title}\n${articleUrl}`)],
  ['Bluesky', () => postBluesky(`${title}\n${articleUrl}`)],
].map(async ([name, post]) => ({ name, result: await post() })));

let failures = 0;
for (let index = 0; index < results.length; index += 1) {
  const name = ['X', 'Mastodon', 'Bluesky'][index];
  const result = results[index];
  if (result.status === 'fulfilled') console.log(`${name} post succeeded`, result.value.result);
  else {
    failures += 1;
    console.error(`${name} post failed:`, result.reason);
  }
}
if (failures) process.exitCode = 1;
