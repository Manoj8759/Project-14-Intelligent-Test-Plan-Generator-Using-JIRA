/**
 * Test Case Parser
 * Extracts structured test cases from LLM-generated markdown
 */
import { TestRailCase } from './testrail-client';

export interface ParsedCase {
  id?: string;
  title: string;
  steps: Array<{
    content: string;
    expected: string;
  }>;
  priority?: string;
}

export function parseMarkdownTestCases(markdown: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  // 1. Try to find a markdown table
  // Typical format: | ID | Description | Steps | Expected Result | Priority |
  const tableRegex = /\|?\s*(?:ID|Id)\s*\|?\s*(?:Title|Description|Summary)\s*\|?\s*(?:Steps?|Actions?)\s*\|?\s*(?:Expected Result|Results?)\s*\|?\s*(?:Priority|Sev)\s*\|?/i;
  const tableMatch = markdown.match(tableRegex);

  if (tableMatch) {
    const lines = markdown.split('\n');
    let inTable = false;
    let tableStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(tableRegex)) {
        inTable = true;
        tableStartLine = i;
        continue;
      }
      
      if (inTable) {
        // Skip separator line |---|---|...
        if (lines[i].includes('---')) continue;
        
        const cells = lines[i].split('|').map(c => c.trim()).filter((c, idx) => idx > 0 || lines[i].startsWith('|') ? c !== '' : true);
        
        // Basic validation: at least 3 cells (Title, Steps, Expected)
        if (cells.length >= 3) {
          cases.push({
            id: cells[0],
            title: cells[1],
            steps: [{
              content: cells[2],
              expected: cells[3] || ''
            }],
            priority: cells[4] || 'Medium'
          });
        } else if (lines[i].trim() === '') {
          // Table ended
          if (cases.length > 0) break;
        }
      }
    }
  }

  // 2. Fallback: Parse bulleted list if no table found
  if (cases.length === 0) {
    // Look for "Test Case X:" or "Scenario X:"
    const caseBlocks = markdown.split(/###?\s*(?:Test Case|Scenario|Case)\s*\d*:?/i);
    
    // Skip the first split as it's usually the intro
    for (let i = 1; i < caseBlocks.length; i++) {
      const block = caseBlocks[i];
      const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
      
      const title = lines[0] || 'Untitled Test Case';
      let stepsStr = '';
      let expectedStr = '';
      
      let inSteps = false;
      let inExpected = false;

      for (const line of lines) {
        if (line.match(/Steps?:/i)) {
          inSteps = true;
          inExpected = false;
          continue;
        }
        if (line.match(/Expected Result:?/i)) {
          inSteps = false;
          inExpected = true;
          continue;
        }

        if (inSteps) stepsStr += (line.replace(/^[-*]\s*/, '') + '\n');
        if (inExpected) expectedStr += (line.replace(/^[-*]\s*/, '') + '\n');
      }

      cases.push({
        title,
        steps: [{
          content: stepsStr.trim() || 'Refer to description',
          expected: expectedStr.trim() || 'Success'
        }]
      });
    }
  }

  return cases;
}

/**
 * Maps a parsed case to TestRail API format
 */
export function mapToTestRail(parsedCase: ParsedCase): TestRailCase {
  return {
    title: parsedCase.title,
    refs: parsedCase.id,
    custom_steps_separated: parsedCase.steps.map(s => ({
      content: s.content,
      expected: s.expected
    }))
  };
}
