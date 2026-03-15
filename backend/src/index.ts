/**
 * Main Express Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Import database
import { initDatabase } from './utils/database';

// Import routes
import settingsRoutes from './routes/settings';
import jiraRoutes from './routes/jira';
import templatesRoutes from './routes/templates';
import testplanRoutes from './routes/testplan';
import downloadRoutes from './routes/download';

const app = express();
const PORT = process.env.PORT || 3001;

// Database initialized flag
let isDbInitialized = false;

// Middleware to ensure DB is initialized in serverless context
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await initDatabase();
      isDbInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database in middleware:', error);
    }
  }
  next();
});

// Middleware
const isProduction = process.env.NODE_ENV === 'production';

// CORS - allow frontend origin
app.use(cors({
  origin: isProduction ? true : 'http://localhost:5173',
  credentials: true
}));

// Body parsers with increased limits for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (!isProduction) {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/settings', settingsRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/testplan', testplanRoutes);
app.use('/api/download', downloadRoutes);

// API Root - List all available endpoints
app.get('/api', (req, res) => {
  res.json({
    message: 'Intelligent Test Plan Generator API',
    version: '1.0.0',
    endpoints: {
      'GET  /api/health': 'Health check',
      'GET  /api/settings/jira': 'Get JIRA config',
      'POST /api/settings/jira': 'Save JIRA config',
      'POST /api/settings/jira/test': 'Test JIRA connection',
      'GET  /api/settings/llm': 'Get LLM config',
      'POST /api/settings/llm': 'Save LLM config',
      'POST /api/settings/llm/test': 'Test LLM connection',
      'GET  /api/settings/llm/models': 'List Ollama models',
      'POST /api/jira/fetch': 'Fetch JIRA ticket',
      'GET  /api/jira/recent': 'Get recent tickets',
      'GET  /api/templates': 'List templates',
      'GET  /api/templates/:id': 'Get template by ID',
      'POST /api/templates/upload': 'Upload PDF template',
      'DELETE /api/templates/:id': 'Delete template',
      'POST /api/testplan/generate': 'Generate test plan',
      'GET  /api/testplan/history': 'Get generation history',
      'POST /api/download/docx': 'Download as DOCX',
      'POST /api/download/pdf': 'Download as PDF'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await initDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// For Vercel Serverless
export default app;

// Start server locally
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}
