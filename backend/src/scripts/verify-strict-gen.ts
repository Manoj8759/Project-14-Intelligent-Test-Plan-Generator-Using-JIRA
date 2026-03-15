import dotenv from 'dotenv';
import path from 'path';
import { GroqProvider } from '../services/llm-providers/groq';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyStrictGeneration() {
  console.log('🚀 Verifying Strict Anti-Hallucination Generation...');

  const config = {
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama3-70b-8192', // Use a standard model for test
    temperature: 0.1
  };

  if (!config.apiKey) {
    console.error('❌ Missing GROQ_API_KEY in .env');
    return;
  }

  const provider = new GroqProvider(config);

  const ticketData = {
    key: 'SCRUM-1',
    summary: 'Project-14-Intelligent-Test-Plan-Generator-Using-JIRA',
    description: 'Build a full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable templates.',
    priority: 'Medium'
  };

  const templateContent = `
# Test Plan Template

## 1. Overview
- Ticket ID: {key}
- Summary: {summary}

## 2. Test Scenarios
{scenarios}
`;

  try {
    console.log('⏳ Generating test plan with strict prompt...');
    const result = await provider.generateTestPlan(ticketData, templateContent);
    
    console.log('\n--- RAW LLM OUTPUT ---\n');
    console.log(result);
    console.log('\n----------------------\n');

    if (result.includes('Verified Facts:') && result.includes('Missing / Unknown Information:')) {
      console.log('✅ Success: Output follows strict anti-hallucination format.');
    } else {
      console.warn('⚠️ Warning: Output MISSING required verification headers.');
    }
  } catch (error: any) {
    console.error(`❌ Generation failed: ${error.message}`);
  }
}

verifyStrictGeneration();
