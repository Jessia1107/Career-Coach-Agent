const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function numericEntity(cp) {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
}

function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clean(html) {
  return decodeHtmlEntities(stripTags(html));
}

function extractDivContent(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(`<div[^>]*class="[^"]*${escaped}[^"]*"[^>]*>`, 'i');
  const open = openRe.exec(html);
  if (!open) return null;

  let i = open.index + open[0].length;
  let depth = 1;

  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);

    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
    }
  }

  return html.slice(open.index + open[0].length, i - 6);
}

async function htmlFetch(url) {
  const maxRetries = 4;
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const jitter = Math.floor(Math.random() * 500);
        await new Promise((r) => setTimeout(r, delay + jitter));
        delay = Math.min(delay * 2, 4000);
        continue;
      }
      if (response.status === 404) return "";
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 4000);
    }
  }
}

function parseJobCards(html) {
  const results = [];
  const chunks = html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1);

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const linkMatch = chunk.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);
    const url = linkMatch ? decodeHtmlEntities(linkMatch[1]).split("?")[0] : "";

    let title = null;
    const h3 = chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3) title = clean(h3[1]);
    if (!title) {
      const sr = chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i);
      if (sr) title = clean(sr[1]);
    }
    if (!title) continue;

    let company = null;
    let companyUrl = null;
    const sub = chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i);
    if (sub) {
      const a = sub[1].match(/href="([^"]+)"/i);
      if (a) companyUrl = decodeHtmlEntities(a[1]).split("?")[0];
      company = clean(sub[1]) || null;
    }

    const loc = chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i);
    const location = loc ? clean(loc[1]) || null : null;
    const dt = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i);
    const date = dt ? dt[1] : null;

    results.push({
      id,
      title,
      company,
      companyUrl,
      location,
      date,
      url: url || `https://www.linkedin.com/jobs/view/${id}`,
    });
  }

  return results;
}

function parseJobDetail(html, id) {
  const title = html.match(
    /class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i
  )?.[1];
  const orgMatch = html.match(
    /class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
  );
  const company = orgMatch ? clean(orgMatch[2]) || null : null;
  const companyUrl = orgMatch ? decodeHtmlEntities(orgMatch[1]).split("?")[0] : null;

  const locMatch = html.match(
    /class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i
  );
  const location = locMatch ? clean(locMatch[1]) || null : null;

  let description = null;
  const descHtml =
    extractDivContent(html, "show-more-less-html__markup") ??
    extractDivContent(html, "description__text");
  if (descHtml) {
    const withBreaks = descHtml
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n");
    description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim() || null;
  }

  const criteria = {};
  const itemRe =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let cm;
  while ((cm = itemRe.exec(html)) !== null) {
    criteria[clean(cm[1]).toLowerCase()] = clean(cm[2]);
  }

  const applyMatch = html.match(/class="topcard__link[^"]*"[^>]*href="([^"]+)"/i);
  const applyUrl = applyMatch ? decodeHtmlEntities(applyMatch[1]).split("?")[0] : null;

  return {
    id,
    title: title ? clean(title) : "(untitled)",
    company,
    companyUrl,
    location,
    date: null,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    description,
    seniority: criteria["seniority level"] ?? null,
    employmentType: criteria["employment type"] ?? null,
    jobFunction: criteria["job function"] ?? null,
    industries: criteria["industries"] ?? null,
    applyUrl,
  };
}

// Universal LinkedIn URL Filter Mappings
const LINKEDIN_FILTERS = {
  // Experience Level (f_E)
  experienceLevels: {
    internship: '1',
    entry: '2',
    associate: '3',
    mid_senior: '4',
    director: '5',
    executive: '6'
  },
  // Work Type (f_WT)
  workTypes: {
    onsite: '1',
    remote: '2',
    hybrid: '3'
  }
};

function parseExperienceLevels(levels) {
  if (!levels) return null;
  if (typeof levels === 'string' && levels.includes(',')) return levels;
  if (Array.isArray(levels)) {
    return levels.map(l => LINKEDIN_FILTERS.experienceLevels[l.toLowerCase()] || l).join(',');
  }
  const key = String(levels).toLowerCase();
  return LINKEDIN_FILTERS.experienceLevels[key] || String(levels);
}

function jobageToTPR(days) {
  if (!days || days <= 0 || days >= 9999) return null;
  return `r${days * 86400}`;
}

function workTypeFlag(mode) {
  if (!mode) return null;
  const key = String(mode).toLowerCase();
  return LINKEDIN_FILTERS.workTypes[key] || null;
}

async function scrapeJobs(options = {}) {
  const keywords = options.keywords || "quantitative analyst";
  const location = options.location || "United States";
  const jobage = Number(options.jobage || 7);
  const remote = options.remote || "";
  const limit = Number(options.limit || 15);

  const params = new URLSearchParams();
  params.set("keywords", keywords);
  params.set("location", location);
  
  const tpr = jobageToTPR(jobage);
  if (tpr) params.set("f_TPR", tpr);
  
  const wt = workTypeFlag(remote);
  if (wt) params.set("f_WT", wt);

  const expLevel = parseExperienceLevels(options.experienceLevel);
  if (expLevel) params.set("f_E", expLevel);

  params.set("start", "0");

  const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
  console.log(`[Scraper] Searching: ${searchUrl}`);
  
  const searchHtml = await htmlFetch(searchUrl);
  if (!searchHtml) return [];

  const cards = parseJobCards(searchHtml).slice(0, limit);
  console.log(`[Scraper] Found ${cards.length} job cards. Fetching details...`);

  const results = [];
  for (const card of cards) {
    try {
      const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${card.id}`;
      const detailHtml = await htmlFetch(detailUrl);
      if (detailHtml) {
        const detail = parseJobDetail(detailHtml, card.id);
        results.push({
          ...card,
          description: detail.description,
          seniority: detail.seniority,
          employmentType: detail.employmentType,
          jobFunction: detail.jobFunction,
          industries: detail.industries,
          applyUrl: detail.applyUrl || card.url
        });
      }
      // Be polite to LinkedIn
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[Scraper] Failed to fetch details for job ${card.id}:`, err.message);
      results.push(card);
    }
  }
  return results;
}

module.exports = {
  scrapeJobs,
  htmlFetch,
  parseJobCards,
  parseJobDetail
};
