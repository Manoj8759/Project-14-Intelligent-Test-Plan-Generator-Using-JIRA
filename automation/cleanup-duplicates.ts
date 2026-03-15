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

async function cleanupDuplicates() {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');

  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/3`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  console.log("🔍 Fetching all Tasks in SCRUM project for cleanup...");
  
  try {
    // Fetch issues with fields explicitly requested
    const res = await client.get(`/search/jql?jql=project = "SCRUM" AND issuetype = "Task"&fields=summary,description&maxResults=100`);
    const issues = res.data.issues;
    console.log(`Found ${issues.length} tasks.`);

    const seenDescriptions = new Map<string, string[]>();

    for (const issue of issues) {
      const key = issue.key;
      const summary = issue.fields.summary;
      
      const descString = formatDescription(issue.fields.description);
      const normalized = descString.trim().toLowerCase().replace(/\s+/g, ' ');
      
      console.log(`Issue ${key}: ${normalized.substring(0, 50).replace(/\n/g, ' ')}...`);
      if (!normalized) continue;

      if (!seenDescriptions.has(normalized)) {
        seenDescriptions.set(normalized, []);
      }
      seenDescriptions.get(normalized)!.push(key);
    }

    const toDelete: string[] = [];
    console.log("\n--- Cleanup Plan ---");
    for (const [desc, keys] of seenDescriptions.entries()) {
      if (keys.length > 1) {
        // Keep the oldest one (first in the list usually if sorted by key/created)
        // Actually, keys might not be sorted. I'll sort them.
        keys.sort((a, b) => {
            const numA = parseInt(a.split('-')[1]);
            const numB = parseInt(b.split('-')[1]);
            return numA - numB;
        });
        
        const keepKey = keys[0];
        const duplicates = keys.slice(1);
        console.log(`Group for description: "${desc.substring(0, 50)}..."`);
        console.log(`  KEEP: ${keepKey}`);
        console.log(`  DELETE: ${duplicates.join(', ')}`);
        toDelete.push(...duplicates);
      }
    }

    if (toDelete.length === 0) {
      console.log("No duplicates identified for deletion.");
      return;
    }

    console.log(`\nStarting deletion of ${toDelete.length} issues...`);
    
    // We'll use /rest/api/3/issue/{issueIdOrKey} for deletion
    const delClient = axios.create({
        baseURL: `${baseUrl}/rest/api/3`,
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    });

    for (const key of toDelete) {
      try {
        await delClient.delete(`/issue/${key}`);
        console.log(`✅ Deleted: ${key}`);
      } catch (err: any) {
        console.error(`❌ Failed to delete ${key}:`, err.response?.data || err.message);
      }
    }

    console.log("\nCleanup complete.");
  } catch (err: any) {
    console.error("Fatal Error:", err.response?.data || err.message);
  }
}

cleanupDuplicates();
