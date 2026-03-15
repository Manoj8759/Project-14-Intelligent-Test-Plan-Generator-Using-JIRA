// Quick test script for JIRA connection
const { JiraClient } = require('./dist/services/jira-client');

const config = {
  baseUrl: process.env.JIRA_BASE_URL || 'https://vwo.atlassian.net',
  username: process.env.JIRA_USERNAME || 'manoj8759+mar26@gmail.com',
  apiToken: process.env.JIRA_API_TOKEN || ''
};

async function testConnection() {
  console.log('🔍 Testing JIRA Connection...\n');
  console.log('Base URL:', config.baseUrl);
  console.log('Username:', config.username);
  console.log('API Token:', config.apiToken ? '[SET]' : '[MISSING]');
  console.log('');

  if (!config.apiToken) {
    console.log('❌ JIRA_API_TOKEN not found in environment');
    process.exit(1);
  }

  const client = new JiraClient(config);
  
  try {
    // Test connection
    console.log('⏳ Testing connection to JIRA...');
    const result = await client.testConnection();
    
    if (result.success) {
      console.log('✅ Connection Successful!');
      console.log('   Message:', result.message);
      
      // Try fetching a test ticket
      console.log('\n⏳ Fetching test ticket (VWO-1)...');
      const ticket = await client.fetchTicket('VWO-1');
      console.log('✅ Ticket fetched successfully!');
      console.log('   Key:', ticket.key);
      console.log('   Summary:', ticket.summary);
      console.log('   Priority:', ticket.priority);
      console.log('   Status:', ticket.status);
    } else {
      console.log('❌ Connection Failed!');
      console.log('   Error:', result.message);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testConnection();
