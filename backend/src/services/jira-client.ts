/**
 * JIRA REST API v3 Client
 */
import { JiraConfig, JiraTicket } from '../types';

export class JiraClient {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  // Build request headers with authentication
  private getHeaders(): Record<string, string> {
    const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // Build full API URL
  private getApiUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    return `${baseUrl}/rest/api/3${endpoint}`;
  }

  // Test connection by fetching current user
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.getApiUrl('/myself'), {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json() as { displayName?: string; emailAddress?: string };
        return {
          success: true,
          message: `Connected as ${data.displayName || 'Unknown'} (${data.emailAddress || 'N/A'})`
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: `Connection failed: ${response.status} - ${error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Fetch ticket details
  async fetchTicket(ticketId: string): Promise<JiraTicket> {
    const response = await fetch(this.getApiUrl(`/issue/${ticketId}`), {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ticket ${ticketId} not found`);
      }
      throw new Error(`Failed to fetch ticket: ${response.status} - ${await response.text()}`);
    }

    const data: any = await response.json();
    return this.parseTicket(data);
  }

  // Fetch attachment content
  async fetchAttachment(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment from ${url}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Parse JIRA API response to our Ticket type
  private parseTicket(data: any): JiraTicket {
    const fields = data.fields || {};
    
    // Extract acceptance criteria from description or custom field
    let acceptanceCriteria = '';
    if (fields.customfield_10014) { // Common custom field for AC
      acceptanceCriteria = fields.customfield_10014;
    } else if (fields.description) {
      acceptanceCriteria = this.extractAcceptanceCriteria(fields.description);
    }

    return {
      key: data.key,
      summary: fields.summary || '',
      description: this.formatDescription(fields.description),
      priority: fields.priority?.name || 'Medium',
      status: fields.status?.name || 'Unknown',
      assignee: fields.assignee?.displayName,
      labels: fields.labels || [],
      acceptanceCriteria,
      attachments: (fields.attachment || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        contentUrl: a.content,
        mimeType: a.mimeType
      }))
    };
  }

  // Format Atlassian Document Format (ADF) to plain text
  private formatDescription(description: any): string {
    if (!description) return '';
    
    // If it's already a string, return it
    if (typeof description === 'string') return description;
    
    // If it's ADF format, extract text
    if (description.content) {
      return this.extractTextFromADF(description);
    }
    
    return JSON.stringify(description);
  }

  // Recursively extract text from ADF with improved formatting
  private extractTextFromADF(node: any): string {
    if (!node) return '';
    
    // Text nodes
    if (node.type === 'text') {
      let text = node.text || '';
      // Handle marks (bold, italic, etc.)
      const marks = (node.marks || []).map((m: any) => m.type);
      if (marks.includes('strong')) text = `**${text}**`;
      if (marks.includes('em')) text = `_${text}_`;
      if (marks.includes('code')) text = `\`${text}\``;
      return text;
    }

    // Media and other nodes
    if (node.type === 'mention') return `@${node.attrs?.text || node.attrs?.id}`;
    if (node.type === 'emoji') return node.attrs?.text || '';
    if (node.type === 'hardBreak') return '\n';

    // Container nodes
    let content = '';
    if (node.content && Array.isArray(node.content)) {
      content = node.content.map((child: any) => this.extractTextFromADF(child)).join('');
    }

    // Block-level formatting
    switch (node.type) {
      case 'heading':
        const level = node.attrs?.level || 1;
        return `\n${'#'.repeat(level)} ${content}\n`;
      case 'paragraph':
        return `\n${content}\n`;
      case 'listItem':
        return `  - ${content}\n`;
      case 'bulletList':
      case 'orderedList':
        return `\n${content}\n`;
      case 'table':
        return `\n[Table]\n${content}\n`;
      case 'tableRow':
        return `${content}\n`;
      case 'tableHeader':
      case 'tableCell':
        return `| ${content} `;
      case 'codeBlock':
        return `\n\`\`\`\n${content}\n\`\`\`\n`;
      case 'blockquote':
        return `\n> ${content}\n`;
      case 'rule':
        return '\n---\n';
      default:
        return content;
    }
  }

  // Extract acceptance criteria from description text
  private extractAcceptanceCriteria(description: any): string {
    const text = this.formatDescription(description);
    
    // Look for common AC patterns
    const patterns = [
      /Acceptance Criteria:?\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i,
      /AC:?\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i,
      /Given[\s\S]*?(?=\n\n|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0]?.trim();
      }
    }
    
    return '';
  }
}

// Factory function
export const createJiraClient = (config: JiraConfig): JiraClient => {
  return new JiraClient(config);
};
