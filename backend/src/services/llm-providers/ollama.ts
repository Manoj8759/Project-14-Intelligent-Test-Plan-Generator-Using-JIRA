/**
 * Ollama Local LLM Provider
 */
import { OllamaConfig } from '../../types';

export class OllamaProvider {
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  // Get base URL with default
  private getBaseUrl(): string {
    return this.config.baseUrl || 'http://localhost:11434';
  }

  // Test connection by fetching available models
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data: any = await response.json();
        const models = data.models?.map((m: any) => m.name).join(', ') || 'No models found';
        return {
          success: true,
          message: `Connected. Available models: ${models}`
        };
      } else {
        return {
          success: false,
          message: `Ollama connection failed: ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Ollama connection error: ${error instanceof Error ? error.message : 'Unknown error'}. Is Ollama running?`
      };
    }
  }

  // Fetch available models
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data: any = await response.json();
        return data.models?.map((m: any) => m.name) || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  // Generate test plan
  async generateTestPlan(
    ticketData: {
      key: string;
      summary: string;
      description: string;
      acceptanceCriteria?: string;
      priority: string;
      productSpecs?: string;
    },
    templateContent: string
  ): Promise<string> {
    const systemPrompt = `ROLE: You are a QA assistant operating under strict verification rules.

SCOPE OF KNOWLEDGE:
You may ONLY use information explicitly provided in the JIRA ticket data, any referenced Product Specs (PRD) within the description, and the provided template.

STRICT RULES (MANDATORY):
1. DO NOT invent features, APIs, error codes, UI elements, or behavior.
2. DO NOT assume default or "typical" system behavior.
3. If information is missing or unclear, respond with: "Insufficient information to determine."
4. Every assertion must be traceable to provided input.
5. If a detail is inferred, label it explicitly as: "Inference (low confidence)".
6. IMPORTANT: Always check the "Product Specifications" section for details from JIRA attachments or PRD links. Treat these as the primary source of truth for generating test scenarios and cases.

PROCESS YOU MUST FOLLOW:
Step 1: Extract verifiable facts from the JIRA ticket and PRD references.
Step 2: List unknown or missing information.
Step 3: Generate output ONLY from verifiable facts.
Step 4: Perform a self-check for hallucinations.

OUTPUT FORMAT (STRICT):
- Verified Facts:
- Missing / Unknown Information:
- Generated Test Plan: (Follow the template structure)`;

    const userPrompt = `
JIRA Ticket Data:
- Key: ${ticketData.key}
- Summary: ${ticketData.summary}
- Priority: ${ticketData.priority}
- Description: ${ticketData.description}
- Acceptance Criteria: ${ticketData.acceptanceCriteria || 'Not specified'}
- Product Specifications (from JIRA attachments or links): ${ticketData.productSpecs || 'None found/No documents provided'}

Template Structure:
${templateContent}

Generate the test plan following the strict Anti-Hallucination protocol and the template above.`;

    const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false
      }),
      signal: AbortSignal.timeout(120000) // 120 seconds for local models
    });

    if (!response.ok) {
      throw new Error(`Ollama generation failed: ${response.status}`);
    }

    const data: any = await response.json();
    return data.response || 'No content generated';
  }

  // Stream generation
  async *streamTestPlan(
    ticketData: {
      key: string;
      summary: string;
      description: string;
      acceptanceCriteria?: string;
      priority: string;
      productSpecs?: string;
    },
    templateContent: string
  ): AsyncGenerator<string> {
    const systemPrompt = `ROLE: You are a QA assistant operating under strict verification rules.
SCOPE: JIRA ticket, PRD references, and Template only.
STRICT: DO NOT invent features. Refer to product specs in JIRA Attachments or description if available.
Follow the 4-step process and strict output format (Verified Facts, Missing Info, Generated Plan).
PRDs are your ONLY source for detailed feature behavior.
`;

    const userPrompt = `
JIRA Ticket: ${ticketData.key} - ${ticketData.summary}
Priority: ${ticketData.priority}
Description: ${ticketData.description}
Acceptance Criteria: ${ticketData.acceptanceCriteria || 'Not specified'}
Product Specs: ${ticketData.productSpecs || 'None'}

Template:
${templateContent}

Generate a test plan following the strict Anti-Hallucination protocol.`;

    const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: true
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      throw new Error(`Ollama stream failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch {
            // Ignore parse errors for partial data
          }
        }
      }
    }
  }
}

export const createOllamaProvider = (config: OllamaConfig): OllamaProvider => {
  return new OllamaProvider(config);
};
