/**
 * Settings Routes - JIRA & LLM Configuration
 */
import { Router } from 'express';
import { secureStore } from '../utils/encryption';
import { dbGet, dbRun } from '../utils/database';
import { createJiraClient } from '../services/jira-client';
import { createGroqProvider } from '../services/llm-providers/groq';
import { createOllamaProvider } from '../services/llm-providers/ollama';

const router = Router();

// Account names for secure storage
const ACCOUNTS = {
  JIRA_TOKEN: 'jira-api-token',
  GROQ_KEY: 'groq-api-key',
  TESTRAIL_KEY: 'testrail-api-key'
};

// GET /api/settings/jira - Get connection status
router.get('/jira', async (req, res) => {
  try {
    const config = await dbGet('SELECT value FROM settings WHERE key = ?', ['jira_config']);
    
    if (!config || !config.value) {
      return res.json({ success: true, data: { configured: false } });
    }

    const parsed = JSON.parse(config.value);
    // Don't return the actual token
    delete parsed.apiToken;
    
    res.json({ 
      success: true, 
      data: { 
        configured: true, 
        config: parsed 
      } 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/settings/jira - Save JIRA credentials
router.post('/jira', async (req, res) => {
  try {
    const { baseUrl, username, apiToken } = req.body;
    const finalBaseUrl = baseUrl || 'https://manoj8759mar26-1773504851382.atlassian.net';

    if (!finalBaseUrl || !username || !apiToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: username, apiToken' 
      });
    }

    // Store encrypted token
    await secureStore.setPassword(ACCOUNTS.JIRA_TOKEN, apiToken);

    const config = { baseUrl: finalBaseUrl, username };
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    if (DB_TYPE === 'postgres') {
      await dbRun(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['jira_config', JSON.stringify({ ...config, hasToken: true })]
      );
    } else {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['jira_config', JSON.stringify({ ...config, hasToken: true })]
      );
    }

    res.json({ success: true, message: 'JIRA configuration saved' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/settings/jira/test - Test JIRA connection
router.post('/jira/test', async (req, res) => {
  try {
    const { baseUrl, username, apiToken } = req.body;

    if (!baseUrl || !username || !apiToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const client = createJiraClient({ baseUrl, username, apiToken });
    const result = await client.testConnection();

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/settings/llm - Get LLM configuration
router.get('/llm', async (req, res) => {
  try {
    const config = await dbGet('SELECT value FROM settings WHERE key = ?', ['llm_config']);
    
    if (!config || !config.value) {
      return res.json({ 
        success: true, 
        data: { 
          provider: 'groq',
          groq: { model: 'llama-3.3-70b-versatile', temperature: 0.7 },
          ollama: { baseUrl: 'http://localhost:11434', model: '' }
        } 
      });
    }

    const parsed = JSON.parse(config.value);
    // Don't return actual API keys
    if (parsed.groq) delete parsed.groq.apiKey;
    
    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/settings/llm - Save LLM configuration
router.post('/llm', async (req, res) => {
  try {
    const { provider, groq, ollama } = req.body;

    // Store Groq API key separately if provided
    if (groq?.apiKey) {
      await secureStore.setPassword(ACCOUNTS.GROQ_KEY, groq.apiKey);
    }

    // Store config
    const config = {
      provider,
      groq: groq ? { model: groq.model, temperature: groq.temperature, hasKey: !!groq.apiKey } : undefined,
      ollama
    };

    const DB_TYPE2 = process.env.DB_TYPE || 'sqlite';
    if (DB_TYPE2 === 'postgres') {
      await dbRun(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['llm_config', JSON.stringify(config)]
      );
    } else {
      await dbRun(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['llm_config', JSON.stringify(config)]
      );
    }

    res.json({ success: true, message: 'LLM configuration saved' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/settings/llm/test - Test LLM connection
router.post('/llm/test', async (req, res) => {
  try {
    const { provider, groq, ollama } = req.body;

    let result;
    if (provider === 'groq') {
      if (!groq?.apiKey) {
        return res.status(400).json({ success: false, message: 'Groq API key required' });
      }
      const groqProvider = createGroqProvider(groq);
      result = await groqProvider.testConnection();
    } else {
      const ollamaProvider = createOllamaProvider(ollama || {});
      result = await ollamaProvider.testConnection();
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/settings/llm/models - List Ollama models
router.get('/llm/models', async (req, res) => {
  try {
    const config = await dbGet('SELECT value FROM settings WHERE key = ?', ['llm_config']);
    const ollamaConfig = (config && config.value) ? JSON.parse(config.value).ollama : { baseUrl: 'http://localhost:11434' };
    
    const provider = createOllamaProvider(ollamaConfig);
    const models = await provider.listModels();
    
    res.json({ success: true, data: models });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/settings/testrail - Get TestRail configuration
router.get('/testrail', async (req, res) => {
  try {
    const config = await dbGet('SELECT value FROM settings WHERE key = ?', ['testrail_config']);
    
    if (!config || !config.value) {
      return res.json({ success: true, data: { configured: false } });
    }

    const parsed = JSON.parse(config.value);
    delete parsed.apiKey; // Don't return actual key
    
    res.json({ success: true, data: { configured: true, ...parsed } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/settings/testrail - Save TestRail configuration
router.post('/testrail', async (req, res) => {
  try {
    const { baseUrl, username, apiKey, projectId, suiteId } = req.body;

    if (apiKey) {
      await secureStore.setPassword(ACCOUNTS.TESTRAIL_KEY, apiKey);
    }

    const config = { baseUrl, username, projectId, suiteId };
    const DB_TYPE = process.env.DB_TYPE || 'sqlite';
    
    const query = DB_TYPE === 'postgres' 
      ? `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`
      : 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';

    await dbRun(query, ['testrail_config', JSON.stringify({ ...config, hasKey: !!apiKey })]);
    res.json({ success: true, message: 'TestRail configuration saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/settings/testrail/test - Test connection
router.post('/testrail/test', async (req, res) => {
  try {
    const { baseUrl, username, apiKey } = req.body;
    const { createTestRailClient } = await import('../services/testrail-client');
    const client = createTestRailClient({ baseUrl, username, apiKey });
    const result = await client.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
