/**
 * Quick test script to verify live JIRA connection
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { jiraManager } from './jira-manager';

async function testJira() {
  console.log('🔌 Testing JIRA Connection...');
  console.log(`   Base URL: ${process.env.JIRA_BASE_URL}`);
  console.log(`   Username: ${process.env.JIRA_USERNAME}`);
  console.log(`   Project:  ${process.env.JIRA_PROJECT_KEY}`);
  console.log('');

  await jiraManager.initialize();
  const connected = await jiraManager.testConnection();

  if (!connected) {
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Ensure the API token is valid');
    console.log('   2. Check that the email matches your Atlassian account');
    console.log('   3. Verify the base URL is correct');
    process.exit(1);
  }

  console.log('\n🎉 JIRA is live and ready!');
}

testJira();
