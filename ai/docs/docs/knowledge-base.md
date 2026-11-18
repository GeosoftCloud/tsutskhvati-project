# Knowledge base

An agent's knowledge base is edited at **Agents → (agent) → Knowledge** in the admin. It has
sources, a compile step, a reviewed and versioned document, and two runtime tools.

## Sources

| Source | What it is | Code |
|---|---|---|
| Website | Start URL plus the sitemap (or link following). Same domain only, robots.txt respected, include/exclude path globs (`*` = one segment, `**` = anything), optional language filter on the first path segment. Plain fetch and HTML → text, no headless browser. | `src/lib/knowledge/crawler.ts`, `crawl-rules.ts` |
| Files | xlsx, csv, pdf, docx, txt, md, up to 20 MB. Each sheet becomes a markdown table as is, with the sheet's own row numbers and column letters; no layout is assumed. Rows whose answers are only placeholder text (configurable, e.g. "upload to Drive") are dropped, and `22.0` becomes `22`. PDFs are transcribed by Gemini. | `src/lib/knowledge/files.ts`, `service.ts` |
| Manual | Q&A pairs and free notes typed in the admin. | `knowledge/actions.ts` |
| Structured catalog (per website) | A detail-page pattern plus a field schema. Each matching page becomes one record, extracted by Gemini structured output. Records are **not** put in the prompt. | `crawler.ts` `extractRecord` |

File originals go to the bucket `KNOWLEDGE_BUCKET` (default `<GCP_PROJECT_ID>-knowledge-files`,
created on first use). The extracted text is stored on the source doc, so the knowledge base keeps
working if the bucket is unavailable.

## Crawling and scheduling

A crawl is a queue in Firestore, advanced in time-boxed steps, so it survives request timeouts.
The admin page drives it while open ("Save & crawl now"). Unchanged pages (same content hash) are
only marked as seen, and only changed catalog pages are re-extracted. If more than 20% of fetches
fail, the old pages are kept and the source shows an error.

Scheduled re-crawls (daily by default, or weekly / on demand per source) need one Cloud Scheduler
job, which is **not created by this code**:

```
gcloud scheduler jobs create http knowledge-recrawl \
  --schedule="*/15 * * * *" --http-method=POST \
  --uri="https://<admin-platform-url>/api/cron/knowledge" \
  --headers="x-cdn-secret=<CDN_SHARED_SECRET>" --attempt-deadline=300s
```

Each call starts crawls that are due and continues crawls in progress. A re-crawl refreshes pages
and catalog records. It does not recompile or publish the document: that stays a human decision.
Catalog records are live as soon as they're crawled.

## Compile, review, publish

"Compile" sends every source to Gemini (`KNOWLEDGE_COMPILE_MODEL`, default `gemini-3.8-flash`) with
one prompt (`src/lib/knowledge/compile.ts`). The result is one document organized by topic or
entity, deduplicated, with conflicts flagged. Precedence is manual > files > website. The result is
saved as a **draft version**. The admin edits it next to a diff against the live version, then
publishes. Versions are numbered and kept; publishing an old version copies it into a new one.

## Runtime (cdn-service)

The published document travels with the agent config (`/api/public/agents/:id/config` and
`/channels/:channel`), so a publish is live within cdn-service's 60 s config cache.

- **Up to 40,000 tokens:** the document is placed in the system prompt, right after the agent's
  base prompt and before anything that changes per channel or visitor
  (`cdn-service/src/lib/system-prompt.js`). The prefix stays identical between turns, so Gemini's
  implicit context caching applies. Explicit `cachedContents` are not created.
- **Over 40,000 tokens:** the document is chunked by heading and the agent gets a
  `search_knowledge(query)` tool (BM25 keyword search, `cdn-service/src/lib/knowledge-search.js`).
- **Catalog:** the agent gets `search_catalog(filters)`. Filters come from the schema: `_min` and
  `_max` for numbers, exact match for enums and booleans, substring for text, plus `query` and
  `sort_by`. It returns at most 10 records with their URLs and the total match count. cdn-service
  calls the platform's encrypted `/api/public/agents/:id/catalog/search`, which caches records for
  5 minutes.

## Firestore (platform database)

```
agents/{id}.knowledge                     { publishedVersion, publishedAt, tokens, mode, latestVersion }
agents/{id}/knowledge-sources/{sourceId}  website | file | manual
agents/{id}/knowledge-pages/{sha1(url)}   { sourceId, url, title, lang, text, hash, fetchedAt, crawlId }
agents/{id}/catalog-records/{sha1(url)}   { sourceId, url, fields, hash, extractedAt, crawlId }
agents/{id}/knowledge-jobs/{sourceId}     crawl queue while a crawl runs
agents/{id}/knowledge-versions/{n}        { version, status, doc, tokens, mode, conflicts, sources, … }
```

All queries are single-field, so no index needs to be created.

## Limits

- 2,000 pages and 5,000 catalog records per website source; 900k characters per file and per
  compiled document (Firestore's 1 MiB doc limit).
- The compile step is one Gemini call with a 65k-token output cap. A document near that size
  should be split by narrowing the sources.
- Pages that render their content only in the browser come out empty.
