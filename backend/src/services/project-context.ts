import { JiraClient } from './jira-client';
import { JiraTicket } from '../types';
import { parseAllSpecsInText } from './link-parser';
import { parsePDFBuffer } from './pdf-parser';
import { parseDocxBuffer } from './docx-parser';

/**
 * Extracts all project context from a JIRA ticket (Description, Links, Attachments)
 */
export async function extractProjectContext(jiraClient: JiraClient, ticket: JiraTicket): Promise<string> {
  let context = '';
  
  console.log(`🔍 [ContextService] Starting extraction for ${ticket.key}`);

  // 1. Scrape links from description
  try {
    const scrapedLinks = await parseAllSpecsInText(ticket.description || '');
    if (scrapedLinks) {
      context += `--- EXTERNAL PROJECT SPECS (FROM LINKS) ---\n${scrapedLinks}\n\n`;
      console.log(`✅ [ContextService] Scraped links from description`);
    }
  } catch (e) {
    console.warn('[ContextService] Error scraping links:', e);
  }

  // 2. Scan JIRA attachments for PRDs (PDFs, DOCX)
  if (ticket.attachments && ticket.attachments.length > 0) {
    console.log(`🔍 [ContextService] Checking ${ticket.attachments.length} attachments...`);
    for (const attachment of ticket.attachments) {
      const filename = attachment.filename.toLowerCase();
      const isPDF = attachment.mimeType === 'application/pdf' || filename.endsWith('.pdf');
      const isDocx = attachment.mimeType.includes('officedocument.wordprocessingml') || filename.endsWith('.docx');
      
      if (isPDF) {
        try {
          console.log(`📄 [ContextService] Parsing PDF: ${attachment.filename}`);
          const buffer = await jiraClient.fetchAttachment(attachment.contentUrl);
          const parsed = await parsePDFBuffer(buffer);
          context += `--- ATTACHED PRD (PDF): ${attachment.filename} ---\n${parsed.text}\n\n`;
        } catch (e) {
          console.warn(`[ContextService] Failed PDF: ${attachment.filename}`, e);
        }
      } else if (isDocx) {
        try {
          console.log(`📝 [ContextService] Parsing DOCX: ${attachment.filename}`);
          const buffer = await jiraClient.fetchAttachment(attachment.contentUrl);
          const text = await parseDocxBuffer(buffer);
          context += `--- ATTACHED PRD (DOCX): ${attachment.filename} ---\n${text}\n\n`;
        } catch (e) {
          console.warn(`[ContextService] Failed DOCX: ${attachment.filename}`, e);
        }
      } else {
        console.log(`⏭️ [ContextService] Skipping non-PRD attachment: ${attachment.filename}`);
      }
    }
  } else {
    console.log(`ℹ️ [ContextService] No attachments found for ${ticket.key}`);
  }

  return context.trim();
}
