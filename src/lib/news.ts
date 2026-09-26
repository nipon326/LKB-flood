import { timeAgoThai } from "./status";
import { resilientFetch } from "./resilientFetch";

const QUERIES = [
  "น้ำท่วมลาดกระบัง OR คลองประเวศ",
  "น้ำท่วมกรุงเทพ ระบายน้ำ OR ผันน้ำ OR ประกาศเตือน",
];

function rssUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=th&gl=TH&ceid=TH:th`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1"));
}

function extractSource(xml: string): string | null {
  const m = xml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
  return m ? decodeEntities(m[1]) : null;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string | null;
  timeAgo: string;
}

async function fetchOneFeed(query: string): Promise<NewsItem[]> {
  const res = await resilientFetch(rssUrl(query), {
    headers: { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items.map((item) => {
    const rawTitle = extractTag(item, "title") ?? "";
    const source = extractSource(item) ?? "";
    // Google News titles are formatted "Headline - source.co"; drop the suffix
    // since we already show the source separately.
    const title = source
      ? rawTitle.replace(new RegExp(`\\s*-\\s*${source}$`), "")
      : rawTitle;
    const pubDate = extractTag(item, "pubDate");
    return {
      title,
      link: extractTag(item, "link") ?? "#",
      source,
      pubDate,
      timeAgo: timeAgoThai(pubDate),
    };
  });
}

export interface NewsResult {
  ok: boolean;
  items: NewsItem[];
  error?: string;
}

export async function fetchFloodNews(): Promise<NewsResult> {
  try {
    const results = await Promise.all(QUERIES.map(fetchOneFeed));
    const merged = results.flat();

    const seen = new Set<string>();
    const deduped = merged.filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });

    deduped.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });

    return { ok: true, items: deduped.slice(0, 8) };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : "ดึงข่าวไม่สำเร็จ",
    };
  }
}
