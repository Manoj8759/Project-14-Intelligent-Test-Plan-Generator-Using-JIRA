/**
 * TestRail API Client
 * Integration for pushing generated test cases to TestRail
 */
import axios, { AxiosInstance } from 'axios';

export interface TestRailConfig {
  baseUrl: string;
  username: string;
  apiKey: string;
  projectId?: number;
  suiteId?: number;
}

export interface TestRailCase {
  title: string;
  type_id?: number;
  priority_id?: number;
  estimate?: string;
  refs?: string;
  custom_steps_separated?: Array<{
    content: string;
    expected: string;
  }>;
  custom_expected?: string;
  custom_steps?: string;
}

export class TestRailClient {
  private client: AxiosInstance;

  constructor(private config: TestRailConfig) {
    const auth = Buffer.from(`${config.username}:${config.apiKey}`).toString('base64');
    
    // Ensure baseUrl doesn't end with slash
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    this.client = axios.create({
      baseURL: `${baseUrl}/index.php?/api/v2`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    });
  }

  /**
   * Test the connection to TestRail
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to get current user info
      await this.client.get('/get_user_by_email&email=' + encodeURIComponent(this.config.username));
      return { success: true, message: 'Connected to TestRail successfully' };
    } catch (error: any) {
      console.error('TestRail connection error:', error.response?.data || error.message);
      const message = error.response?.data?.error || error.message;
      return { success: false, message: `Failed to connect to TestRail: ${message}` };
    }
  }

  /**
   * Add a test case to a section
   */
  async addCase(sectionId: number, data: TestRailCase): Promise<any> {
    try {
      const response = await this.client.post(`/add_case/${sectionId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error adding TestRail case:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to add test case');
    }
  }

  /**
   * Get or create a section for a JIRA ticket
   */
  async getOrCreateSection(projectId: number, suiteId: number, ticketId: string): Promise<number> {
    try {
      // 1. Get existing sections
      const sectionsResponse = await this.client.get(`/get_sections/${projectId}&suite_id=${suiteId}`);
      const sections = sectionsResponse.data;
      
      const existingSection = sections.find((s: any) => s.name.includes(ticketId));
      if (existingSection) {
        return existingSection.id;
      }

      // 2. Create new section
      const createResponse = await this.client.post(`/add_section/${projectId}`, {
        suite_id: suiteId,
        name: `JIRA Import: ${ticketId}`,
        description: `Imported from Intelligent Test Plan Generator on ${new Date().toLocaleDateString()}`
      });
      return createResponse.data.id;
    } catch (error: any) {
      console.error('Error in getOrCreateSection:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to manage TestRail sections');
    }
  }
}

export const createTestRailClient = (config: TestRailConfig) => new TestRailClient(config);
