import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function applyMarks(text: string, marks: any[] = []): string {
  let result = text;
  const types = marks.map((m: any) => m.type);
  if (types.includes('strong')) result = `**${result}**`;
  if (types.includes('em')) result = `_${result}_`;
  if (types.includes('code')) result = `\`${result}\``;
  return result;
}

function extractTextFromADF(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text') return applyMarks(node.text || '', node.marks);
  if (node.type === 'mention') return `@${node.attrs?.text || node.attrs?.id}`;
  if (node.type === 'emoji') return node.attrs?.text || '';
  if (node.type === 'hardBreak') return '\n';

  let content = '';
  if (node.content && Array.isArray(node.content)) {
    content = node.content.map((child: any) => extractTextFromADF(child)).join('');
  }

  return content;
}

function formatDescription(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (description.content) {
    return extractTextFromADF(description);
  }
  return JSON.stringify(description);
}

async function findDuplicates() {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/3`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  console.log("🔍 Fetching all Tasks in SCRUM project...");
  
  try {
    const res = await client.get(`/search/jql?jql=project = "SCRUM" AND issuetype = "Task"&maxResults=100`);
    const issues = res.data.issues;
    console.log(`Found ${issues.length} tasks.`);

    const seenDescriptions = new Map<string, string[]>();

    for (const issue of issues) {
      const desc = formatDescription(issue.fields.description);
      const normalized = desc.trim().toLowerCase().replace(/\s+/g, ' ');
      const summary = issue.fields.summary;
      const key = issue.key;

      if (!normalized) continue;

      if (!seenDescriptions.has(normalized)) {
        seenDescriptions.set(normalized, []);
      }
      seenDescriptions.get(normalized)!.push(key + " (" + summary + ")");
    }

    console.log("\n--- Duplicate Analysis ---");
    let duplicateCount = 0;
    for (const [desc, keys] of seenDescriptions.entries()) {
      if (keys.length > 1) {
        console.log(`\nDuplicate Group Found (Count: ${keys.length}):`);
        console.log(`Keys: ${keys.join(', ')}`);
        duplicateCount += (keys.length - 1);
      }
    }

    if (duplicateCount === 0) {
      console.log("No duplicates found based on description.");
    } else {
      console.log(`\nTotal duplicate issues identified: ${duplicateCount}`);
    }
  } catch (err: any) {
    console.error(err.response?.data || err.message);
  }
}

findDuplicates();
