/**
 * Download Routes - Generate DOCX and PDF from test plan content
 */
import { Router } from 'express';
import { marked } from 'marked';
import HTMLtoDOCX from 'html-to-docx';
import puppeteer from 'puppeteer';

const router = Router();

// HTML template for PDF generation
const getPdfTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 2.5cm;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      font-size: 20pt;
      color: #1a1a1a;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 16pt;
      color: #2563eb;
      margin-top: 25px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 13pt;
      color: #374151;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    h4 {
      font-size: 12pt;
      color: #4b5563;
      margin-top: 15px;
      margin-bottom: 8px;
    }
    p {
      margin-bottom: 10px;
      text-align: justify;
    }
    ul, ol {
      margin-bottom: 12px;
      padding-left: 25px;
    }
    li {
      margin-bottom: 5px;
    }
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      font-size: 10pt;
      color: #dc2626;
    }
    pre {
      background-color: #f9fafb;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      overflow-x: auto;
      margin-bottom: 15px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      color: #374151;
    }
    blockquote {
      border-left: 4px solid #2563eb;
      margin: 15px 0;
      padding: 10px 20px;
      background-color: #f8fafc;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    strong {
      font-weight: 600;
      color: #1f2937;
    }
    em {
      font-style: italic;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
`;

// POST /api/download/docx - Generate DOCX from markdown
router.post('/docx', async (req, res) => {
  try {
    const { content, filename } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Convert markdown to HTML
    const htmlContent = await marked.parse(content, {
      gfm: true,
      breaks: true
    });

    // Wrap in proper HTML structure for DOCX
    const fullHtml = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
            h1 { font-size: 18pt; color: #1a1a1a; }
            h2 { font-size: 14pt; color: #2563eb; }
            h3 { font-size: 12pt; color: #374151; }
            code { background-color: #f3f4f6; padding: 2px 4px; font-family: 'Consolas', monospace; }
            pre { background-color: #f9fafb; padding: 10px; border-radius: 4px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 8px; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    // Generate DOCX buffer
    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    // Set response headers
    const downloadFilename = filename ? `${filename}.docx` : 'test-plan.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);
  } catch (error) {
    console.error('DOCX generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate DOCX'
    });
  }
});

// POST /api/download/pdf - Generate PDF from markdown
router.post('/pdf', async (req, res) => {
  let browser;
  try {
    const { content, filename } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Convert markdown to HTML
    const htmlContent = await marked.parse(content, {
      gfm: true,
      breaks: true
    });

    // Generate full HTML with styling
    const title = filename || 'Test Plan';
    const fullHtml = getPdfTemplate(title, htmlContent);

    // Launch puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2.5cm',
        right: '2.5cm',
        bottom: '2.5cm',
        left: '2.5cm'
      }
    });

    await browser.close();

    // Set response headers
    const downloadFilename = filename ? `${filename}.pdf` : 'test-plan.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    if (browser) await browser.close();
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF'
    });
  }
});

export default router;
