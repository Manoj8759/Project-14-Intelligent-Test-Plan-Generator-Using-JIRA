/**
 * Parse the PRD from SCRUM-3 and generate real test cases, 
 * then push them as Tasks to JIRA under the SCRUM project.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { dbRun, dbAll } from '../backend/src/utils/database';

// Parse DOCX using mammoth
async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

import { secureStore } from '../backend/src/utils/encryption';

// Use the Groq LLM to generate test cases from PRD text
async function generateTestCases(prdText: string): Promise<any[]> {
  const groqKey = await secureStore.getPassword('groq-api-key');
  
  if (!groqKey) {
    console.log('⚠️ No GROQ_API_KEY found in secureStore. Using rule-based extraction from PRD...');
    return extractTestCasesFromPRD(prdText);
  }

  console.log('🤖 Invoking Groq LLM (llama-3.3-70b-versatile)...');
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Senior QA Automation Engineer. Given a Product Requirements Document (PRD), generate comprehensive, high-quality test cases. 
Return ONLY a valid JSON array of objects with the following exact fields: 
- title (string, concise)
- preconditions (string)
- steps (string, numbered list)
- expected_result (string)
- priority (string: High/Medium/Low)

Ensure covering positive flows, negative edge cases, and core business objectives. Generate exactly 5-8 highly detailed test cases.
DO NOT return any markdown formatting outside of the JSON array, NO conversational text, JUST the JSON.`
        },
        {
          role: 'user',
          content: `Generate detailed test cases from this PRD:\n\n${prdText.substring(0, 5000)} // truncate to avoid token limits if needed`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }, {
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }
    });

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    console.error('❌ Failed to parse JSON from Groq response:', content.substring(0, 100));
  } catch (err: any) {
    console.error('❌ Groq API Error:', err.response?.data || err.message);
  }
  
  return extractTestCasesFromPRD(prdText);
}

// Rule-based fallback: Extract test cases from PRD sections

function extractTestCasesFromPRD(prdText: string): any[] {
  const cases: any[] = [];
  const lines = prdText.split('\n').filter(l => l.trim());
  
  // Find key features/requirements from the PRD
  let currentSection = '';
  const features: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(Feature|Requirement|Module|Section|Story)/i) || 
        trimmed.match(/^\d+\.\s/) || 
        trimmed.match(/^[A-Z][A-Z\s]+$/)) {
      currentSection = trimmed;
    }
    if (trimmed.length > 10 && !trimmed.match(/^(Author|Date|Version|Document|Table|Page)/i)) {
      features.push(trimmed);
    }
  }

  // Generate test cases from detected features
  const uniqueFeatures = [...new Set(features)].slice(0, 15);
  
  for (let i = 0; i < uniqueFeatures.length; i++) {
    const feature = uniqueFeatures[i];
    if (feature.length < 15) continue; // Skip short lines
    
    cases.push({
      title: `Verify: ${feature.substring(0, 80)}`,
      preconditions: "User is logged in and the application is accessible.",
      steps: `1. Navigate to the relevant module.\n2. Verify the behavior: ${feature}\n3. Check for expected outcome.`,
      expected_result: `The system behaves as specified: ${feature}`,
      priority: i < 5 ? 'High' : 'Medium'
    });
  }

  return cases.slice(0, 10); // Cap at 10
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  📄 SCRUM-3 PRD → Test Case Generation → JIRA');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Parse the downloaded PRD
  const prdPath = path.join(__dirname, '..', '.tmp', 'evidence', 'Product Requirements Document.docx');
  if (!fs.existsSync(prdPath)) {
    console.error('❌ PRD file not found. Run fetch-scrum3.ts first.');
    process.exit(1);
  }

  console.log('📖 Parsing PRD...');
  const prdText = await extractDocxText(prdPath);
  console.log(`   Extracted ${prdText.length} characters from PRD.`);
  console.log(`   Preview: ${prdText.substring(0, 200)}...\n`);

  // 2. Generate test cases
  console.log('🧠 Generating test cases from PRD...');
  const testCases = await generateTestCases(prdText);
  console.log(`   Generated ${testCases.length} test cases.\n`);

  // 3. Save to local DB
  console.log('💾 Saving test cases to local database...');
  await dbRun("DELETE FROM test_cases WHERE ticket_id = 'SCRUM-3'");
  
  for (const tc of testCases) {
    const trId = Math.floor(Math.random() * 9000) + 1000;
    tc.trId = trId;
    await dbRun(`
      INSERT INTO test_cases (ticket_id, title, steps, expected_result, priority, testrail_id, is_automated)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, ['SCRUM-3', tc.title, tc.steps, tc.expected_result, tc.priority || 'Medium', trId]);
    console.log(`   ✅ ${tc.title}`);
  }

  // 4. Push test cases as subtasks/linked tasks to JIRA under SCRUM-3
  console.log('\n📤 Pushing test cases to JIRA (Project: SCRUM)...');
  
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const client = axios.create({
    baseURL: `${baseUrl}/rest/api/2`,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
  });

  let createdCount = 0;
  for (const tc of testCases) {
    try {
      const description = [
        `*Preconditions:* ${tc.preconditions || 'N/A'}`,
        ``,
        `*Steps:*`,
        tc.steps,
        ``,
        `*Expected Result:* ${tc.expected_result}`,
        ``,
        `_Auto-generated from SCRUM-3 PRD by TESTER AI_MY_`
      ].join('\n');

      const payload = {
        fields: {
          project: { key: 'SCRUM' },
          issuetype: { name: 'Task' },
          summary: `Test Case Scenario: ${tc.title} | Test Case ID: TC-${tc.trId}`,
          description: description,
          labels: ['test-case', 'prd-generated', 'automated']
        }
      };

      const res = await client.post('/issue', payload);
      console.log(`   ✅ Created: ${res.data.key} - ${tc.title}`);
      createdCount++;

      // Save the Jira Task ID to our DB for linking later
      await dbRun('UPDATE test_cases SET jira_task_id = ? WHERE title = ?', [res.data.key, tc.title]);

      // Link to SCRUM-3
      try {
        await client.post('/issueLink', {
          type: { name: 'Relates' },
          inwardIssue: { key: res.data.key },
          outwardIssue: { key: 'SCRUM-3' }
        });
      } catch (linkErr) {
        // Link type might not exist, non-fatal
      }
    } catch (err: any) {
      console.error(`   ❌ Failed: ${tc.title} -`, err.response?.data?.errors || err.message);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  📊 Summary: ${createdCount}/${testCases.length} test cases pushed to JIRA`);
  console.log(`═══════════════════════════════════════════════════`);

  // 5. Export for Dynamic Execution
  const manifestPath = path.join(__dirname, 'data', 'test-manifest.json');
  console.log(`\n📦 Exporting test manifest to ${manifestPath}...`);
  fs.writeFileSync(manifestPath, JSON.stringify(testCases, null, 2));
  console.log('   ✅ Manifest exported.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
