/**
 * SnowDay Class (answer.ge) — Geosoft Headless AI Agent Configuration
 *
 * Setup summary (see ai/AGENT_SETUP_AND_ARCHITECTURE.md):
 *   1. Import ai/snowday-school-agent.json into Geosoft Admin Builder ("API only" mode)
 *   2. Ensure Start node -> Allowed domains includes "answer.ge" (and "localhost" for local dev)
 *   3. Save -> Publish -> Paste your Headless Agent Base URL below
 */
window.SNOWDAY_AGENT_CONFIG = {
  // Geosoft Headless Agent Base URL (from Agent Builder -> API button):
  // Chat endpoint: https://cdn-service-wqieturt5q-ew.a.run.app/api/v1/agents/5d77S75uDn9xuccR9Vle/chat
  agentBaseUrl: "https://cdn-service-wqieturt5q-ew.a.run.app/api/v1/agents/5d77S75uDn9xuccR9Vle",

  // Domain encoded inside generated Teacher QR codes.
  // Currently the Cloud Run URL; switch to "https://answer.ge" once the domain points to Cloud Run.
  // (QR codes made with the Cloud Run URL keep working after the switch.)
  publicSiteBaseUrl: "https://tsutskhvati-web-617054738609.europe-west1.run.app",

  // Cache AI-generated lesson websites in browser localStorage for 0ms instant refreshes:
  cacheGeneratedLessons: true,

  // Reuse AI-generated lesson websites across all students/devices scanning the same Google Doc
  // (keyed by Doc ID + content hash in Geosoft session storage so AI runs only ONCE per doc version):
  enableSharedServerCache: true
};
