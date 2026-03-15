import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function queryIssueTypes() {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/2`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  console.log('Querying JIRA project issue types...\n');

  // Get project details including issue types
  const projectRes = await client.get(`/project/${process.env.JIRA_PROJECT_KEY}`);
  console.log(`Project: ${projectRes.data.name} (${projectRes.data.key})`);
  console.log('\nAvailable Issue Types:');
  for (const it of projectRes.data.issueTypes) {
    console.log(`  - ID: ${it.id} | Name: "${it.name}" | Subtask: ${it.subtask}`);
  }
}

queryIssueTypes().catch(err => console.error(err.response?.data || err.message));
