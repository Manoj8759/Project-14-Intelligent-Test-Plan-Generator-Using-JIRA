/**
 * Fetch SCRUM-3 from JIRA, download its PRD attachment, 
 * and display the ticket data for test case generation.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fetchScrum3() {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/2`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  console.log('📋 Fetching SCRUM-3...\n');
  
  const res = await client.get('/issue/SCRUM-3?expand=renderedFields');
  const issue = res.data;

  console.log(`Key: ${issue.key}`);
  console.log(`Summary: ${issue.fields.summary}`);
  console.log(`Status: ${issue.fields.status?.name}`);
  console.log(`Priority: ${issue.fields.priority?.name}`);
  console.log(`Issue Type: ${issue.fields.issuetype?.name}`);
  console.log(`Description:\n${issue.fields.description || '(empty)'}\n`);

  // Check for attachments
  const attachments = issue.fields.attachment || [];
  console.log(`Attachments: ${attachments.length}`);
  
  for (const att of attachments) {
    console.log(`  - ${att.filename} (${att.mimeType}, ${(att.size / 1024).toFixed(1)}KB)`);
    console.log(`    URL: ${att.content}`);
    
    // Download PRD attachments (PDF/DOCX)
    if (att.filename.endsWith('.pdf') || att.filename.endsWith('.docx') || att.filename.endsWith('.doc')) {
      console.log(`    📥 Downloading ${att.filename}...`);
      
      const evidenceDir = path.join(__dirname, '..', '.tmp', 'evidence');
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }
      
      const filePath = path.join(evidenceDir, att.filename);
      const fileRes = await axios.get(att.content, {
        headers: { 'Authorization': `Basic ${auth}` },
        responseType: 'arraybuffer'
      });
      fs.writeFileSync(filePath, fileRes.data);
      console.log(`    ✅ Saved to: ${filePath}`);
    }
  }

  // Output the full ticket JSON for analysis
  const outputPath = path.join(__dirname, '..', '.tmp', 'scrum-3-data.json');
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(issue, null, 2));
  console.log(`\n💾 Full ticket data saved to: ${outputPath}`);
}

fetchScrum3().catch(err => {
  console.error('Error:', err.response?.status, err.response?.data || err.message);
});
