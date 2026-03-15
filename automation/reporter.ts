import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { trSync } from './sync-manager';
import { jiraManager } from './jira-manager';
import { dbGet } from '../backend/src/utils/database';
import path from 'path';
import fs from 'fs';

class TestRailJiraReporter implements Reporter {
  async onBegin() {
    console.log('📊 Starting Automated Execution Reporting...');
    await trSync.initialize();
    await jiraManager.initialize();
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    // Robust parsing for formatted titles: "Test Case Scenario: {Title} | Test Case ID: TC-{ID}"
    let cleanTitle = test.title;
    if (test.title.includes('| Test Case ID:')) {
      // Extract part between "Scenario: " and " |"
      const match = test.title.match(/Scenario: (.*) \|/);
      if (match) cleanTitle = match[1].trim();
    } else {
      cleanTitle = test.title.replace('[VWO Platform] ', '').trim();
    }
    
    // Find local DB entry
    const localCase = await dbGet('SELECT * FROM test_cases WHERE title = ?', [cleanTitle]);
    if (!localCase) {
      console.warn(`⚠️ No local entry found for test: ${test.title}. Skipping reporting.`);
      return;
    }

    const trId = localCase.testrail_id;
    const statusId = result.status === 'passed' ? 1 : 5; // 1=Passed, 5=Failed
    const comment = result.error ? `Error: ${result.error.message}\nStack: ${result.error.stack}` : 'Test executed successfully via automation.';

    console.log(`📡 Reporting ${test.title} (C${trId}) - Status: ${result.status}`);

    let bugId: string | undefined = undefined;

    // Update test execution state
    if (localCase.jira_task_id) {
      const execStatus = result.status === 'passed' ? 'PASSED' : 'FAILED';
      await jiraManager.updateTestIssueStatus(localCase.jira_task_id, execStatus, result.duration, result.error?.message);
    }

    if (result.status !== 'passed') {
      // Create Jira Bug
      bugId = await jiraManager.createBug({
        trId: trId,
        title: cleanTitle,
        error: result.error?.message || 'Unknown error',
        steps: localCase.steps,
        expected: localCase.expected_result,
        priority: localCase.priority
      }) || undefined;

      // Attach evidence if exists
      const screenshot = result.attachments.find(a => a.name === 'screenshot');
      if (screenshot && screenshot.path) {
        if (bugId) await jiraManager.attachScreenshot(bugId, screenshot.path);
        if (localCase.jira_task_id) await jiraManager.attachScreenshot(localCase.jira_task_id, screenshot.path);
      }

      // Link bug to test case blocking relationship
      if (bugId && localCase.jira_task_id) {
        await jiraManager.linkBugToTest(bugId, localCase.jira_task_id);
      }
    }

    // Update TestRail
    const trResultId = await trSync.addResult(trId, statusId, comment, bugId);
    
    // Upload screenshot to TR
    if (trResultId) {
      const screenshot = result.attachments.find(a => a.name === 'screenshot');
      if (screenshot && screenshot.path) {
        await trSync.addAttachmentToResult(trResultId, screenshot.path);
      }
    }
  }

  async onEnd() {
    console.log('✅ Automated Execution & Reporting Sequence Complete.');
  }
}

export default TestRailJiraReporter;
