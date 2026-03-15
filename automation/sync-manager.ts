import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance } from 'axios';
import { dbRun, dbGet } from '../backend/src/utils/database';
import { secureStore } from '../backend/src/utils/encryption';

interface TestRailCase {
  title: string;
  type_id: number;
  priority_id: number;
  custom_preconds?: string;
  custom_steps?: string;
  custom_expected?: string;
  custom_sprint?: string;
}

interface TestRailResult {
  status_id: number;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string;
}

class TestRailSyncManager {
  private config: any;
  private apiKey: string = '';

  async initialize() {
    try {
      const configRow = await dbGet("SELECT value FROM settings WHERE key = 'testrail_config'");
      if (configRow) {
        this.config = JSON.parse(configRow.value);
        this.apiKey = await secureStore.getPassword('testrail-api-key') || '';
      }
    } catch (err) {
      console.warn("Could not load TestRail config from DB:", err);
    }
  }

  private get client(): AxiosInstance | null {
    if (!this.config || !this.apiKey || !this.config.baseUrl) return null;
    const auth = Buffer.from(`${this.config.username}:${this.apiKey}`).toString('base64');
    return axios.create({
      baseURL: `${this.config.baseUrl}/index.php?/api/v2`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    });
  }

  async getProjectId(name: string): Promise<number> {
    const apiClient = this.client;
    if (!apiClient) return 1; 
    try {
      const response = await apiClient.get('/get_projects');
      const project = response.data.find((p: any) => p.name === name);
      return project ? project.id : (this.config.projectId || 1);
    } catch (err) {
      return this.config?.projectId || 1;
    }
  }

  async syncScenarios(ticketId: string, scenarios: any[]) {
    const apiClient = this.client;
    const projectId = await this.getProjectId('Scrum 3');
    let sectionId = 1;

    if (apiClient) {
      try {
        const sectionsRes = await apiClient.get(`/get_sections/${projectId}`);
        let section = sectionsRes.data.find((s: any) => s.name.includes(ticketId));
        
        if (!section) {
          const sectionRes = await apiClient.post(`/add_section/${projectId}`, { 
            name: `JIRA-${ticketId} Import`,
            suite_id: this.config.suiteId || 1
          });
          section = sectionRes.data;
        }
        sectionId = section.id;
      } catch (err) {
        console.warn("Failed to fetch/create TestRail section, using default ID 1");
      }
    }

    for (const scenario of scenarios) {
      console.log(`Processing scenario: ${scenario.title}`);
      try {
        let trId = 0;
        
        if (apiClient) {
          const payload: TestRailCase = {
            title: `[VWO Platform] ${scenario.title}`,
            type_id: 3, 
            priority_id: 3, 
            custom_preconds: scenario.preconditions,
            custom_steps: scenario.steps,
            custom_expected: scenario.expected,
            custom_sprint: "Current"
          };

          const response = await apiClient.post(`/add_case/${sectionId}`, payload);
          trId = response.data.id;
        } else {
          trId = Math.floor(Math.random() * 1000) + 5000; 
          console.log(`[SIMULATION] Mock TestRail push for: ${scenario.title}`);
        }

        // Traceability: Save to local DB
        await dbRun(`
          INSERT INTO test_cases (ticket_id, title, steps, expected_result, priority, testrail_id, is_automated)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [ticketId, scenario.title, scenario.steps, scenario.expected, "High", trId]);
        
        console.log(`✅ ${apiClient ? 'Synced' : 'Saved locally'}: ${scenario.title} -> ID: ${trId}`);
      } catch (err: any) {
        console.error(`❌ Failed to process ${scenario.title}:`, err.response?.data || err.message);
      }
    }
  }

  async addResult(testCaseId: number, statusId: number, comment: string, defectId?: string): Promise<number | null> {
    const apiClient = this.client;
    if (!apiClient) {
      console.log(`[SIMULATION] Added TR Result for C${testCaseId}: Status ${statusId}, Error: ${comment.substring(0, 50)}...`);
      return Math.floor(Math.random() * 10000);
    }

    try {
      const payload: TestRailResult = {
        status_id: statusId,
        comment: comment,
        defects: defectId
      };
      
      const response = await apiClient.post(`/add_result_for_case/${this.config.runId || 1}/${testCaseId}`, payload);
      return response.data.id;
    } catch (err: any) {
      console.error(`❌ Failed to add result for C${testCaseId}:`, err.response?.data || err.message);
      return null;
    }
  }

  async addAttachmentToResult(resultId: number, filePath: string) {
    const apiClient = this.client;
    if (!apiClient) {
      console.log(`[SIMULATION] Attached evidence ${path.basename(filePath)} to Result ${resultId}`);
      return;
    }

    try {
      if (!fs.existsSync(filePath)) return;
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('attachment', fs.createReadStream(filePath));

      await apiClient.post(`/add_attachment_to_result/${resultId}`, form, {
        headers: {
          ...form.getHeaders()
        }
      });
      console.log(`✅ Attached evidence ${path.basename(filePath)} to TestRail.`);
    } catch (err: any) {
      console.error(`❌ Failed to attach evidence:`, err.response?.data || err.message);
    }
  }
}

export const trSync = new TestRailSyncManager();
