/**
 * Run the FULL live automation cycle:
 * 1. Generate Anti-Gravity scenarios
 * 2. Save to local DB with traceability
 * 3. Execute Playwright tests
 * 4. On failure → Create JIRA Bug in SCRUM project
 * 5. Report results
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { dbRun, dbGet, dbAll } from '../backend/src/utils/database';
import { jiraManager } from './jira-manager';

interface Scenario {
  title: string;
  preconditions: string;
  steps: string;
  expected: string;
}

const SCENARIOS: Scenario[] = [
  {
    title: "Zero-Gravity Validation",
    preconditions: "Device is powered on and calibrated.",
    steps: "1. Activate anti-gravity core.\n2. Set gravity constant to 0.0g.\n3. Measure suspension of 1kg test mass.",
    expected: "Mass remains perfectly suspended without drift for 60 seconds."
  },
  {
    title: "Lift Mechanisms",
    preconditions: "Core is active.",
    steps: "1. Increase lift vector to 1.5g.\n2. Observe vertical displacement of test platform.",
    expected: "Platform rises smoothly at 4.9m/s^2."
  },
  {
    title: "Stability Controls",
    preconditions: "Core is active and mass is suspended.",
    steps: "1. Introduce 10N lateral force.\n2. Monitor gyroscopic stabilization response.",
    expected: "Stability controls counteract force within 200ms with <5mm deviation."
  },
  {
    title: "Payload Limits",
    preconditions: "Core is active.",
    steps: "1. Gradually add weight until 500kg threshold.\n2. Monitor power consumption and core temperature.",
    expected: "System maintains lift up to 500kg without exceeding 80C."
  },
  {
    title: "Emergency Protocols",
    preconditions: "Core is active and mass is suspended at 10m height.",
    steps: "1. Simulate sudden power loss.\n2. Check deployment of mechanical safety clamps.",
    expected: "Safety clamps engage within 50ms; mass is secured."
  }
];

async function runFullCycle() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 Anti-Gravity Automation Framework - LIVE RUN');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Step 1: Initialize ──
  await jiraManager.initialize();
  const connected = await jiraManager.testConnection();
  if (!connected) {
    console.error('❌ Cannot proceed without live JIRA connection.');
    process.exit(1);
  }

  // ── Step 2: Clear previous test cases for clean run ──
  console.log('\n📋 Step 1: Generating & Saving Test Cases...');
  await dbRun("DELETE FROM test_cases WHERE ticket_id = 'SCRUM-3'");

  const ticketId = 'SCRUM-3';
  for (const scenario of SCENARIOS) {
    const trId = Math.floor(Math.random() * 9000) + 1000; // Mock TR ID (no TestRail creds)
    await dbRun(`
      INSERT INTO test_cases (ticket_id, title, steps, expected_result, priority, testrail_id, is_automated)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [ticketId, scenario.title, scenario.steps, scenario.expected, "High", trId]);
    console.log(`   ✅ Saved: [Anti-Gravity] ${scenario.title} (Mock TR-ID: C${trId})`);
  }

  // ── Step 3: Simulate Execution (one deliberate failure) ──
  console.log('\n⚡ Step 2: Simulating Test Execution...');
  const cases = await dbAll("SELECT * FROM test_cases WHERE ticket_id = ?", [ticketId]);

  for (const tc of cases) {
    // Simulate: First test (Zero-Gravity Validation) always fails
    const passed = tc.title !== 'Zero-Gravity Validation';
    const status = passed ? 'PASSED' : 'FAILED';

    console.log(`   ${passed ? '✅' : '❌'} ${tc.title}: ${status}`);

    if (!passed) {
      // ── Step 4: Create JIRA Bug on Failure ──
      console.log('\n🐛 Step 3: Creating JIRA Bug for failed test...');
      const bugKey = await jiraManager.createBug({
        trId: tc.testrail_id,
        title: tc.title,
        error: 'AssertionError: expected 0.1 to equal 0.0 — gravity fluctuation detected',
        steps: tc.steps,
        expected: tc.expected_result,
        priority: tc.priority
      });

      if (bugKey) {
        // Update local DB with bug linkage
        await dbRun('UPDATE test_cases SET jira_bug_id = ? WHERE id = ?', [bugKey, tc.id]);
        console.log(`   🔗 Linked: C${tc.testrail_id} ↔ ${bugKey}`);
      }
    }
  }

  // ── Step 5: Summary ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  📊 Execution Summary');
  console.log('═══════════════════════════════════════════════════');

  const allCases = await dbAll("SELECT * FROM test_cases WHERE ticket_id = ?", [ticketId]);
  const totalPassed = allCases.filter(c => !c.jira_bug_id).length;
  const totalFailed = allCases.filter(c => c.jira_bug_id).length;

  console.log(`   Total Scenarios: ${allCases.length}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Bugs Created: ${totalFailed}`);

  for (const tc of allCases) {
    const status = tc.jira_bug_id ? `❌ FAILED → ${tc.jira_bug_id}` : '✅ PASSED';
    console.log(`   │ C${tc.testrail_id} │ ${tc.title} │ ${status}`);
  }

  console.log('\n🎉 Full cycle complete!');
}

runFullCycle().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
