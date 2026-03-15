/**
 * Service to extract and parse external links (PRDs, PDFs) from ticket descriptions
 */
import axios from 'axios';
import { parsePDFBuffer } from './pdf-parser';
import { parseDocxBuffer } from './docx-parser';

export interface ExtractedSpec {
  url: string;
  type: 'pdf' | 'docx' | 'html' | 'text' | 'unknown';
  content: string;
}

/**
 * Extract URLs from a string
 */
export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

/**
 * Fetch and parse content from a URL
 */
export const parseExternalSpec = async (url: string): Promise<ExtractedSpec> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'Accept': 'application/pdf, text/html, application/xhtml+xml'
      }
    });

    const contentType = response.headers['content-type'] || '';
    const buffer = Buffer.from(response.data);

    if (contentType.includes('application/pdf')) {
      const parsed = await parsePDFBuffer(buffer);
      return {
        url,
        type: 'pdf',
        content: parsed.text
      };
    } else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      const text = await parseDocxBuffer(buffer);
      return {
        url,
        type: 'docx',
        content: text
      };
    } else if (contentType.includes('text/html')) {
      // Basic HTML to text
      const html = buffer.toString('utf-8');
      const text = html.replace(/<[^>]*>?/gm, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
      return {
        url,
        type: 'html',
        content: text
      };
    } else if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      return {
        url,
        type: 'text',
        content: buffer.toString('utf-8')
      };
    }

    return {
      url,
      type: 'unknown',
      content: ''
    };
  } catch (error) {
    console.warn(`Failed to parse external spec from ${url}:`, error instanceof Error ? error.message : error);
    return {
      url,
      type: 'unknown',
      content: ''
    };
  }
};

/**
 * Parse all external links in a text and return aggregated spec content
 */
export const parseAllSpecsInText = async (text: string): Promise<string> => {
  const urls = extractUrls(text);
  if (urls.length === 0) return '';

  console.log(`🔍 Found ${urls.length} potential spec links. Parsing...`);
  
  const results = await Promise.all(urls.map(url => parseExternalSpec(url)));
  const validSpecs = results.filter(r => r.content.length > 0);

  if (validSpecs.length === 0) return '';

  return validSpecs.map(spec => `--- Source: ${spec.url} ---\n${spec.content}`).join('\n\n');
};
