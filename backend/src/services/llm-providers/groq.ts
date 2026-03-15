/**
 * Groq Cloud LLM Provider
 */
import Groq from 'groq-sdk';
import { GroqConfig } from '../../types';

export class GroqProvider {
  private client: Groq;
  private config: GroqConfig;

  constructor(config: GroqConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
      timeout: 30000 // 30 seconds
    });
  }

  // Test connection by listing models
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const models = await this.client.models.list();
      const availableModels = models.data?.map(m => m.id).join(', ') || 'No models found';
      return {
        success: true,
        message: `Connected. Available models: ${availableModels}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Groq connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: this.config.temperature,
        max_tokens: 4096
      });

      return response.choices[0]?.message?.content || 'No content generated';
    } catch (error) {
      throw new Error(`Groq generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Stream generation (for real-time updates)
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

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: this.config.temperature,
      max_tokens: 4096,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

export const createGroqProvider = (config: GroqConfig): GroqProvider => {
  return new GroqProvider(config);
};
