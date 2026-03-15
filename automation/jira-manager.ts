import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { dbGet, dbRun, dbAll } from '../backend/src/utils/database';

class JiraAutomationManager {
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private projectKey: string;

  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL || '';
    this.username = process.env.JIRA_USERNAME || '';
    this.apiToken = process.env.JIRA_API_TOKEN || '';
    this.projectKey = process.env.JIRA_PROJECT_KEY || 'SCRUM';
  }

  get isConfigured(): boolean {
    return !!(this.baseUrl && this.username && this.apiToken);
  }

  async initialize() {
    // Also try loading from DB if .env is empty
    if (!this.isConfigured) {
      try {
        const configRow = await dbGet("SELECT value FROM settings WHERE key = 'jira_config'");
        if (configRow) {
          const config = JSON.parse(configRow.value);
          this.baseUrl = config.baseUrl || this.baseUrl;
          this.username = config.username || this.username;
        }
      } catch (err) {
        console.warn("Could not load JIRA config from DB");
      }
    }
  }

  private get client() {
    const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');
    return axios.create({
      baseURL: `${this.baseUrl.replace(/\/$/, '')}/rest/api/3`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'X-Atlassian-Token': 'no-check'
      }
    });
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('❌ JIRA not configured. Set env vars or use the Settings page.');
      return false;
    }
    try {
      const response = await this.client.get('/myself');
      console.log(`✅ JIRA Connected as: ${response.data.displayName} (${response.data.emailAddress})`);
      return true;
    } catch (err: any) {
      console.error('❌ JIRA Connection failed:', err.response?.status, err.response?.data?.errorMessages || err.message);
      return false;
    }
  }

  async checkDuplicateBug(trId: number): Promise<string | null> {
    if (!this.isConfigured) return null;
    try {
      const jql = `project = "${this.projectKey}" AND issuetype = "Task" AND status != "Done" AND summary ~ "[VWO Platform] C${trId}" ORDER BY created DESC`;
      const response = await this.client.get(`/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1`);
      if (response.data.issues && response.data.issues.length > 0) {
        return response.data.issues[0].key;
      }
    } catch (err) {
      // Dedup check failure is non-fatal
    }
    return null;
  }

  async createBug(data: {
    trId: number;
    title: string;
    error: string;
    steps: string;
    expected: string;
    priority: string;
  }): Promise<string | null> {
    if (!this.isConfigured) {
      const mockId = `${this.projectKey}-${Math.floor(Math.random() * 1000)}`;
      console.log(`[SIMULATION] Would create JIRA Bug: [VWO Platform] C${data.trId} - ${data.title}`);
      return mockId;
    }

    // Deduplication
    const existingBug = await this.checkDuplicateBug(data.trId);
    if (existingBug) {
      console.log(`⚠️ Duplicate bug found: ${existingBug}. Skipping creation.`);
      return existingBug;
    }

    try {
      const description = [
        `*Failed Test Case:* C${data.trId} - ${data.title}`,
        `*Environment:* Localhost (http://localhost:3000)`,
        `*Error:* ${data.error}`,
        ``,
        `*Steps to Reproduce:*`,
        data.steps,
        ``,
        `*Expected:* ${data.expected}`,
        `*Actual:* Test failed during automation execution.`,
      ].join('\n');

      const payload = {
        fields: {
          project: { key: this.projectKey },
          issuetype: { name: "Task" },
          summary: `[VWO Platform] C${data.trId} - ${data.title} - Automated Test Failure`,
          description: description,
          labels: ["automated-defect", "vwo-platform", "regression"]
        }
      };

      const response = await this.client.post('/issue', payload);
      const bugKey = response.data.key;
      console.log(`✅ Created JIRA Bug: ${bugKey}`);

      // Store locally
      try {
        await dbRun('UPDATE test_cases SET jira_bug_id = ? WHERE testrail_id = ?', [bugKey, data.trId]);
      } catch (e) { /* non-fatal */ }

      return bugKey;
    } catch (err: any) {
      console.error(`❌ Failed to create JIRA bug:`, err.response?.status, err.response?.data || err.message);
      return null;
    }
  }

  async updateTestIssueStatus(issueKey: string, status: 'PASSED' | 'FAILED', duration: number, errorMsg?: string) {
    if (!this.isConfigured) return;

    try {
      const dateStr = new Date().toISOString();
      const commentBody = status === 'PASSED'
        ? `*Execution:* ${dateStr}\n*Status:* ✅ PASSED\n*Duration:* ${duration}ms\n\n_Successfully verified core behaviors._`
        : `*Execution:* ${dateStr}\n*Status:* ❌ FAILED\n*Duration:* ${duration}ms\n\n*Error:* ${errorMsg}\n\n_Review attached evidence and linked Bug for details._`;

      // 1. Add Execution Comment
      await this.client.post(`/issue/${issueKey}/comment`, { body: commentBody });

      // 2. Add Label
      await this.client.put(`/issue/${issueKey}`, {
        update: { labels: [{ add: status === 'PASSED' ? 'passed' : 'failed' }] }
      });

      // 3. Transition to "Done" if PASSED
      if (status === 'PASSED') {
        const trRes = await this.client.get(`/issue/${issueKey}/transitions`);
        const doneTransition = trRes.data.transitions.find((t: any) => t.name.toLowerCase() === 'done');
        if (doneTransition) {
          await this.client.post(`/issue/${issueKey}/transitions`, {
            transition: { id: doneTransition.id }
          });
          console.log(`   ✅ Transitioned ${issueKey} to Done`);
        }
      }
    } catch (err: any) {
      console.error(`❌ Failed to update test issue ${issueKey}:`, err.response?.data || err.message);
    }
  }

  async linkBugToTest(bugKey: string, testKey: string) {
    if (!this.isConfigured) return;

    try {
      // 1. Create Blocks Link
      try {
        await this.client.post('/issueLink', {
          type: { name: 'Blocks' },
          inwardIssue: { key: bugKey },
          outwardIssue: { key: testKey }
        });
        console.log(`   🔗 Linked Bug ${bugKey} blocks Test ${testKey}`);
      } catch (linkErr) {
        // Fallback to Relates if Blocks does not exist
        await this.client.post('/issueLink', {
          type: { name: 'Relates' },
          inwardIssue: { key: bugKey },
          outwardIssue: { key: testKey }
        });
        console.log(`   🔗 Linked Bug ${bugKey} relates to Test ${testKey}`);
      }

      // 2. Add comment and label to Test Issue
      await this.client.post(`/issue/${testKey}/comment`, {
        body: `*BLOCKED* by ${bugKey}\nA regression defect was identified during automation.`
      });
      await this.client.put(`/issue/${testKey}`, {
        update: { labels: [{ add: 'blocked' }] }
      });
    } catch (err: any) {
      console.error(`❌ Failed to link Bug ${bugKey} to Test ${testKey}:`, err.response?.data || err.message);
    }
  }

  async attachScreenshot(issueKey: string, filePath: string) {
    if (!this.isConfigured || !fs.existsSync(filePath)) return;

    // Check file size < 10MB
    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) {
      console.warn(`⚠️ Screenshot ${path.basename(filePath)} exceeds 10MB limit. Skipping attachment.`);
      return;
    }

    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      await this.client.post(`/issue/${issueKey}/attachments`, form, {
        headers: { ...form.getHeaders(), 'X-Atlassian-Token': 'no-check' }
      });
      console.log(`✅ Attached screenshot to JIRA ${issueKey}`);
    } catch (err: any) {
      console.error(`❌ Failed to attach to JIRA:`, err.response?.status, err.response?.data || err.message);
    }
  }
}

export const jiraManager = new JiraAutomationManager();
