import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function queryTransitions(issueKey: string) {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/2`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  console.log(`Querying JIRA transitions for ${issueKey}...\n`);

  try {
    const res = await client.get(`/issue/${issueKey}/transitions`);
    console.log('Available Transitions:');
    for (const t of res.data.transitions) {
      console.log(`  - ID: ${t.id} | Name: "${t.name}" | To Status: "${t.to.name}"`);
    }
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}

queryTransitions('SCRUM-16');
