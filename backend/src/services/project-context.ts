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

  // 2. Scan JIRA attachments for PRDs (PDFs, DOCX) in parallel
  if (ticket.attachments && ticket.attachments.length > 0) {
    const relevantAttachments = ticket.attachments.filter(a => {
      const filename = a.filename.toLowerCase();
      return a.mimeType === 'application/pdf' || 
             filename.endsWith('.pdf') ||
             a.mimeType.includes('officedocument.wordprocessingml') || 
             filename.endsWith('.docx');
    });

    if (relevantAttachments.length > 0) {
      console.log(`🔍 [ContextService] Parsing ${relevantAttachments.length} relevant attachments in parallel...`);
      
      const attachmentPromises = relevantAttachments.map(async (attachment) => {
        const filename = attachment.filename.toLowerCase();
        const isPDF = attachment.mimeType === 'application/pdf' || filename.endsWith('.pdf');
        
        try {
          const buffer = await jiraClient.fetchAttachment(attachment.contentUrl);
          if (isPDF) {
            const parsed = await parsePDFBuffer(buffer);
            return `--- ATTACHED PRD (PDF): ${attachment.filename} ---\n${parsed.text}\n\n`;
          } else {
            const text = await parseDocxBuffer(buffer);
            return `--- ATTACHED PRD (DOCX): ${attachment.filename} ---\n${text}\n\n`;
          }
        } catch (e: any) {
          console.warn(`[ContextService] Failed attachment ${attachment.filename}:`, e.message);
          return '';
        }
      });

      const results = await Promise.all(attachmentPromises);
      context += results.join('');
    }
  }

  return context.trim();
}
