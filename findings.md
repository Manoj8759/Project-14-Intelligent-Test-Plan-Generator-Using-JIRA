# 🔍 Findings - AI Testplan Generator - JIRA

> **Project Memory: Research, Discoveries, Constraints**

---

## 📅 Discovery Log

| Date | Finding | Source | Impact |
|------|---------|--------|--------|
| 2026-03-15 | Vercel Serverless Constraints | Deployment | Found that Vercel filesystem is read-only, causing crashes on `mkdirSync` |
| 2026-03-15 | Puppeteer Shared Libs | Deployment | Puppeteer Requires dynamic import or a dedicated layer/plugin for serverless |
| 2026-03-15 | Relative API Paths | Frontend | Frontend must use `/api` relative paths on same-origin monorepos to avoid CORS |

---

## 🔗 Integration Research

### JIRA API
<!-- Document JIRA API findings here -->
- **Documentation:** https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Authentication:** To be researched
- **Rate Limits:** To be researched
- **Endpoints of Interest:**
  - To be documented

---

## 📚 Resources Found

| Resource | URL | Description |
|----------|-----|-------------|
| | | |

---

## ⚠️ Constraints & Limitations

- **Read-Only Filesystem:** Vercel/Serverless environments do not allow disk writes. Gated `templates` storage and `SQLite` initialization to prevent runtime crashes.
- **Puppeteer in Serverless:** Standard `puppeteer` can fail due to missing shared libraries; moved to dynamic import as a precaution.
- **Monorepo Routing:** SPA routing on Vercel requires specific rewrite rules in `vercel.json` to handle client-side URLs.

---

## 💡 Insights

- **Horizontal Scaling:** Transitioning to Postgres (Neon/Vercel) from SQLite is necessary for serverless environments.
- **Parallel Context Extraction:** Using `Promise.all` for JIRA attachments significantly improves LLM generation speed.
- **Developer Attribution:** Centrally managed footer text ensures consistency across environments.

---

## 🤔 Open Questions

<!-- Questions that need answers -->
1. What JIRA project will the test plans be created in?
2. What format should the generated test plans follow?
3. Should the tool create JIRA issues, or update existing ones?

---

*Last Updated: 2026-03-15*
