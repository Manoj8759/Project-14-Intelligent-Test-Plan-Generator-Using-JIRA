// Standalone JIRA connection test
require('dotenv').config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USERNAME = process.env.JIRA_USERNAME;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

console.log('🔍 JIRA Configuration Test\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Base URL :', JIRA_BASE_URL || '❌ NOT SET');
console.log('Username :', JIRA_USERNAME || '❌ NOT SET');
console.log('API Token:', JIRA_API_TOKEN ? '✅ SET (' + JIRA_API_TOKEN.substring(0, 20) + '...)' : '❌ NOT SET');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (!JIRA_BASE_URL || !JIRA_USERNAME || !JIRA_API_TOKEN) {
  console.log('❌ Missing required JIRA configuration!');
  console.log('Please check your backend/.env file.\n');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('⏳ Testing connection to JIRA...\n');
    
    const auth = Buffer.from(`${JIRA_USERNAME}:${JIRA_API_TOKEN}`).toString('base64');
    const url = `${JIRA_BASE_URL.replace(/\/$/, '')}/rest/api/3/myself`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ JIRA Connection Successful!\n');
      console.log('User Details:');
      console.log('  Display Name :', data.displayName || 'N/A');
      console.log('  Email        :', data.emailAddress || 'N/A');
      console.log('  Account ID   :', data.accountId || 'N/A');
      console.log('');
      
      // Try fetching a test ticket
      console.log('⏳ Testing ticket fetch (VWO-1)...');
      const ticketUrl = `${JIRA_BASE_URL.replace(/\/$/, '')}/rest/api/3/issue/VWO-1`;
      const ticketResponse = await fetch(ticketUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (ticketResponse.ok) {
        const ticket = await ticketResponse.json();
        console.log('✅ Ticket VWO-1 fetched successfully!\n');
        console.log('Ticket Details:');
        console.log('  Key      :', ticket.key);
        console.log('  Summary  :', ticket.fields?.summary || 'N/A');
        console.log('  Priority :', ticket.fields?.priority?.name || 'N/A');
        console.log('  Status   :', ticket.fields?.status?.name || 'N/A');
      } else {
        console.log('⚠️ Could not fetch ticket VWO-1:', ticketResponse.status, ticketResponse.statusText);
      }
      
      console.log('\n✅ JIRA is fully configured and working!');
    } else {
      const errorText = await response.text();
      console.log('❌ Connection failed!');
      console.log('Status:', response.status);
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testConnection();
