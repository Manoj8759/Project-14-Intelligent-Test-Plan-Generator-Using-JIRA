import dotenv from 'dotenv';
import path from 'path';
import { OllamaProvider } from '../services/llm-providers/ollama';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyOllamaStrict() {
  console.log('🚀 Verifying Local Ollama Strict Generation...');

  const config = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: 'llama3.2:latest' // Using the model found via tags
  };

  const provider = new OllamaProvider(config);

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
    console.log(`⏳ Testing connection with ${config.model}...`);
    const status = await provider.testConnection();
    if (!status.success) {
      console.error(`❌ ${status.message}`);
      return;
    }
    console.log(`✅ ${status.message}`);

    console.log('⏳ Generating test plan with strict prompt...');
    const result = await provider.generateTestPlan(ticketData, templateContent);
    
    console.log('\n--- RAW OLLAMA OUTPUT ---\n');
    console.log(result);
    console.log('\n----------------------\n');

    if (result.includes('Verified Facts') || result.includes('Missing / Unknown Information')) {
      console.log('✅ Success: Output follows strict anti-hallucination format.');
    } else {
      console.warn('⚠️ Warning: Output MISSING required verification headers.');
    }
  } catch (error: any) {
    console.error(`❌ Generation failed: ${error.message}`);
  }
}

verifyOllamaStrict();
