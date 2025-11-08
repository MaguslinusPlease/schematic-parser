import * as cheerio from "cheerio";
import fs from "fs/promises";

const BASE_URL = "https://www.minecraft-schematics.com";
const OUTPUT_FILE = "./../../../minecraft-schematics.json";
const MAX_PARALLEL = 21;
const DEBUG = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extract schematic ID from URL
function extractIdFromUrl(url) {
  const match = url.match(/schematic\/(\d+)\//);
  return match ? match[1] : null;
}

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function parseListingPage(pageNum) {
  const url =
    pageNum === 1 ? `${BASE_URL}/latest/` : `${BASE_URL}/latest/${pageNum}/`;

  console.log(`\n🔍 Scraping list page ${pageNum}...`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const items = [];
  $(".row-fluid .span4").each((_, el) => {
    const fullUrl = BASE_URL + $(el).find("h3 a").attr("href");
    const imageSrc = $(el).find("img").attr("src");
    const downloadLink = fullUrl + "download/";
    const id = extractIdFromUrl(fullUrl);

    if (id && fullUrl && imageSrc && downloadLink) {
      items.push({ id, downloadLink, imageSrc, fullUrl });
    }
  });

  console.log(`   → Found ${items.length} items on page ${pageNum}`);
  return items;
}

async function getDetails(fullUrl) {
  try {
    const html = await fetchHtml(fullUrl);
    const $ = cheerio.load(html);

    const fullTitle = $("h1").text().trim() || "";
    const category =
      $(".span5 table tbody tr:first-child td:nth-child(2)").text().trim() ||
      "";
    const theme =
      $(".span5 table tbody tr:nth-child(2) td:nth-child(2)").text().trim() ||
      "";

    return { fullTitle, category, theme };
  } catch (err) {
    console.error(`⚠️ Error getting details for ${fullUrl}: ${err.message}`);
    return { fullTitle: "", category: "", theme: "" };
  }
}

async function addDetailsToItems(items, pageNum) {
  const results = [];
  for (let i = 0; i < items.length; i += MAX_PARALLEL) {
    const batch = items.slice(i, i + MAX_PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const details = await getDetails(item.fullUrl);
        return { ...item, ...details };
      })
    );
    results.push(...batchResults);
    console.log(
      `   ✔️ Processed ${Math.min(i + MAX_PARALLEL, items.length)} of ${
        items.length
      } items on page ${pageNum}`
    );
    await sleep(300);
  }
  return results;
}

async function loadExistingData() {
  try {
    const data = await fs.readFile(OUTPUT_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function scrapeAllPages() {
  const existingData = await loadExistingData();
  const existingIds = new Set(existingData.map((d) => d.id));
  const allItems = [];
  let pageNum = 1;
  let stop = false;

  while (!stop) {
    const items = await parseListingPage(pageNum);
    if (items.length === 0) break;

    // Stop if we hit an existing ID
    const newItems = [];
    for (const item of items) {
      if (existingIds.has(item.id)) {
        console.log(
          `🛑 Found existing ID (${item.id}) — stopping incremental scrape.`
        );
        stop = true;
        break;
      }
      newItems.push(item);
    }

    if (newItems.length === 0) break;

    const withDetails = await addDetailsToItems(newItems, pageNum);
    allItems.push(...withDetails);

    console.log(
      `✅ Finished page ${pageNum}. Collected ${withDetails.length} new items.`
    );

    if (DEBUG && pageNum >= 3) {
      console.log("🐞 Debug mode active — stopping after 3 pages.");
      break;
    }

    pageNum++;
  }

  if (allItems.length === 0) {
    console.log("No new schematics found — exiting.");
    return;
  }

  const newData = [...allItems, ...existingData];
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(newData, null, 2));
  console.log(
    `\n🎉 Done! Added ${allItems.length} new schematics. Total now: ${newData.length}`
  );
}

// Run the scraper
scrapeAllPages().catch((err) => console.error("❌ Fatal error:", err));
