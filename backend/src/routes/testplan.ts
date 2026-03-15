/**
 * Test Plan Generation Routes
 */
import { Router, Response } from 'express';
import { createJiraClient, JiraClient } from '../services/jira-client';
import { createGroqProvider } from '../services/llm-providers/groq';
import { createOllamaProvider } from '../services/llm-providers/ollama';
import { dbGet, dbRun, dbAll } from '../utils/database';
import { secureStore } from '../utils/encryption';
import { LLMProvider, JiraTicket } from '../types';
import { extractProjectContext } from '../services/project-context';
import { parseMarkdownTestCases, mapToTestRail } from '../services/test-case-parser';
import { createTestRailClient } from '../services/testrail-client';
import { parseDocxBuffer } from '../services/docx-parser';

const router = Router();
// Get stored configs
const getConfigs = async () => {
  const [jiraConfigRow, llmConfigRow] = await Promise.all([
    dbGet('SELECT value FROM settings WHERE key = ?', ['jira_config']),
    dbGet('SELECT value FROM settings WHERE key = ?', ['llm_config'])
  ]);

  const jiraConfig = (jiraConfigRow && jiraConfigRow.value) ? JSON.parse(jiraConfigRow.value) : null;
  const llmConfig = (llmConfigRow && llmConfigRow.value) ? JSON.parse(llmConfigRow.value) : null;

  // Get decrypted tokens
  if (jiraConfig) {
    jiraConfig.apiToken = await secureStore.getPassword('jira-api-token');
  }
  if (llmConfig?.groq?.hasKey) {
    llmConfig.groq.apiKey = await secureStore.getPassword('groq-api-key');
  }

  return { jiraConfig, llmConfig };
};

// POST /api/testplan/generate - Generate test plan
router.post('/generate', async (req, res) => {
  try {
    const { ticketId, templateId, provider } = req.body;

    if (!ticketId || !templateId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ticketId and templateId are required' 
      });
    }

    const { jiraConfig, llmConfig } = await getConfigs();

    if (!jiraConfig?.apiToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'JIRA not configured' 
      });
    }

    if (!llmConfig) {
      return res.status(400).json({ 
        success: false, 
        error: 'LLM not configured' 
      });
    }

    // Fetch ticket and extract ALL project context (Links + Attachments)
    const jiraClient = createJiraClient(jiraConfig);
    const ticket = await jiraClient.fetchTicket(ticketId);
    
    const productSpecs = await extractProjectContext(jiraClient, ticket);
    ticket.productSpecs = productSpecs;

    // Fetch template
    const template = await dbGet('SELECT content FROM templates WHERE id = ?', [templateId]);
    if (!template || !template.content) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // Select provider
    const selectedProvider: LLMProvider = provider || llmConfig.provider;
    let generatedContent: string;

    if (selectedProvider === 'groq') {
      if (!llmConfig.groq?.apiKey) {
        return res.status(400).json({ success: false, error: 'Groq API key not configured' });
      }
      const groq = createGroqProvider(llmConfig.groq);
      generatedContent = await groq.generateTestPlan(ticket, template.content);
    } else {
      const ollama = createOllamaProvider(llmConfig.ollama || {});
      generatedContent = await ollama.generateTestPlan(ticket, template.content);
    }

    // Save to history
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    if (DB_TYPE === 'postgres') {
      await dbRun(
        `INSERT INTO test_plan_history (ticket_id, template_id, generated_content, provider_used) 
         VALUES ($1, $2, $3, $4)`,
        [ticketId, templateId, generatedContent, selectedProvider]
      );
    } else {
      await dbRun(
        `INSERT INTO test_plan_history (ticket_id, template_id, generated_content, provider_used) 
         VALUES (?, ?, ?, ?)`,
        [ticketId, templateId, generatedContent, selectedProvider]
      );
    }

    res.json({ 
      success: true, 
      data: {
        ticketId,
        templateId,
        providerUsed: selectedProvider,
        generatedContent,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/testplan/stream - SSE streaming endpoint
router.get('/stream', async (req, res: Response) => {
  const { ticketId, templateId, provider } = req.query as {
    ticketId: string;
    templateId: string;
    provider: LLMProvider;
  };

  if (!ticketId || !templateId) {
    return res.status(400).json({ success: false, error: 'ticketId and templateId required' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { jiraConfig, llmConfig } = await getConfigs();

    if (!jiraConfig?.apiToken || !llmConfig) {
      res.write(`data: ${JSON.stringify({ error: 'Configuration missing' })}\n\n`);
      res.end();
      return;
    }

    // Fetch ticket and extract ALL project context (Links + Attachments)
    const jiraClient = createJiraClient(jiraConfig);
    const ticket = await jiraClient.fetchTicket(ticketId);

    const productSpecs = await extractProjectContext(jiraClient, ticket);
    ticket.productSpecs = productSpecs;
    const template = await dbGet('SELECT content FROM templates WHERE id = ?', [templateId]);

    if (!template || !template.content) {
      res.write(`data: ${JSON.stringify({ error: 'Template not found' })}\n\n`);
      res.end();
      return;
    }

    // Stream based on provider
    const selectedProvider = provider || llmConfig.provider;
    let stream: AsyncGenerator<string>;

    if (selectedProvider === 'groq') {
      const groq = createGroqProvider(llmConfig.groq);
      stream = groq.streamTestPlan(ticket, template.content);
    } else {
      const ollama = createOllamaProvider(llmConfig.ollama || {});
      stream = ollama.streamTestPlan(ticket, template.content);
    }

    // Send chunks
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })}\n\n`);
    res.end();
  }
});

// GET /api/testplan/history - Get generation history
router.get('/history', async (req, res) => {
  try {
    const history = await dbGet(
      `SELECT h.*, t.name as template_name 
       FROM test_plan_history h
       LEFT JOIN templates t ON h.template_id = t.id
       ORDER BY h.created_at DESC LIMIT 20`
    );

    res.json({ success: true, data: history || [] });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/testplan/push - Push test cases to TestRail
router.post('/push', async (req, res) => {
  try {
    const { ticketId, content } = req.body;

    if (!ticketId || !content) {
      return res.status(400).json({ success: false, error: 'ticketId and content are required' });
    }

    // 1. Get TestRail config
    const testrailConfigRow = await dbGet('SELECT value FROM settings WHERE key = ?', ['testrail_config']);
    if (!testrailConfigRow) {
      return res.status(400).json({ success: false, error: 'TestRail not configured' });
    }

    const trConfig = JSON.parse(testrailConfigRow.value);
    trConfig.apiKey = await secureStore.getPassword('testrail-api-key');

    if (!trConfig.apiKey || !trConfig.projectId || !trConfig.suiteId) {
      return res.status(400).json({ success: false, error: 'Incomplete TestRail configuration' });
    }

    // 2. Parse test cases from markdown
    const parsedCases = parseMarkdownTestCases(content);
    if (parsedCases.length === 0) {
      return res.status(400).json({ success: false, error: 'No test cases found in content to push' });
    }

    // 3. Initialize client and push
    const client = createTestRailClient(trConfig);
    const sectionId = await client.getOrCreateSection(trConfig.projectId, trConfig.suiteId, ticketId);

    const results = [];
    for (const pCase of parsedCases) {
      const trCase = mapToTestRail(pCase);
      const result = await client.addCase(sectionId, trCase);
      results.push(result);
    }

    res.json({
      success: true,
      message: `Successfully pushed ${results.length} test cases to TestRail`,
      data: { sectionId, casesAdded: results.length }
    });
  } catch (error) {
    console.error('TestRail push error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/testplan/save - Save test cases to local project database
router.post('/save', async (req, res) => {
  try {
    const { ticketId, content, planId } = req.body;

    if (!ticketId || !content) {
      return res.status(400).json({ success: false, error: 'ticketId and content are required' });
    }

    // 1. Parse test cases from markdown
    const parsedCases = parseMarkdownTestCases(content);
    if (parsedCases.length === 0) {
      return res.status(400).json({ success: false, error: 'No structured test cases found to save' });
    }

    // 2. Clear existing cases for this ticket to avoid duplicates if re-saving
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    if (DB_TYPE === 'postgres') {
      await dbRun('DELETE FROM test_cases WHERE ticket_id = $1', [ticketId]);
    } else {
      await dbRun('DELETE FROM test_cases WHERE ticket_id = ?', [ticketId]);
    }

    // 3. Save to database
    const results = [];
    for (const pCase of parsedCases) {
      const steps = pCase.steps.map(s => s.content).join('\n');
      const expected = pCase.steps.map(s => s.expected).join('\n');
      
      if (DB_TYPE === 'postgres') {
        await dbRun(
          `INSERT INTO test_cases (ticket_id, plan_id, title, steps, expected_result, priority) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [ticketId, planId || null, pCase.title, steps, expected, pCase.priority || 'Medium']
        );
      } else {
        await dbRun(
          `INSERT INTO test_cases (ticket_id, plan_id, title, steps, expected_result, priority) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ticketId, planId || null, pCase.title, steps, expected, pCase.priority || 'Medium']
        );
      }
      results.push(pCase);
    }

    res.json({
      success: true,
      message: `Successfully saved ${results.length} test cases to the project`,
      data: { casesSaved: results.length }
    });
  } catch (error) {
    console.error('Save cases error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/testplan/cases/:ticketId - Get saved test cases for a ticket
router.get('/cases/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    
    let cases;
    if (DB_TYPE === 'postgres') {
      cases = await dbAll('SELECT * FROM test_cases WHERE ticket_id = $1 ORDER BY id ASC', [ticketId]);
    } else {
      cases = await dbAll('SELECT * FROM test_cases WHERE ticket_id = ? ORDER BY id ASC', [ticketId]);
    }

    res.json({ success: true, data: cases || [] });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
