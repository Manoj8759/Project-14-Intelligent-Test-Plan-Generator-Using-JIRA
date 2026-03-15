import dotenv from 'dotenv';
import path from 'path';
import { JiraClient } from '../services/jira-client';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyJira() {
  console.log('🚀 Starting JIRA Verification...');

  const config = {
    baseUrl: process.env.JIRA_BASE_URL || '',
    username: process.env.JIRA_USERNAME || '',
    apiToken: process.env.JIRA_API_TOKEN || ''
  };

  if (!config.baseUrl || !config.username || !config.apiToken) {
    console.error('❌ Missing JIRA configuration in .env');
    process.exit(1);
  }

  console.log(`🔗 Target: ${config.baseUrl}`);
  console.log(`👤 User: ${config.username}`);

  const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');
  console.log(`🔑 Auth Header: Basic ${auth.substring(0, 10)}... (redacted)`);

  const client = new JiraClient(config);

  try {
    console.log('⏳ Testing connection...');
    const result = await client.testConnection();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      
      // Try to fetch a sample ticket
      const ticketId = 'SCRUM-1'; 
      console.log(`⏳ Attempting to fetch ticket: ${ticketId}...`);
      try {
        const ticket = await client.fetchTicket(ticketId);
        console.log('✅ Ticket fetched successfully!');
        console.log(`Summary: ${ticket.summary}`);
        console.log(`Status: ${ticket.status}`);
      } catch (e: any) {
        console.warn(`⚠️ Could not fetch ticket ${ticketId}: ${e.message}`);
        
        console.log('⏳ Attempting to search for any recent issues...');
        try {
          // Use search (JQL) to find some issues
          const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/rest/api/3/search?jql=order+by+created+DESC&maxResults=5`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const searchData: any = await response.json();
            if (searchData.issues && searchData.issues.length > 0) {
              console.log(`✅ Found ${searchData.issues.length} recent issues:`);
              searchData.issues.forEach((issue: any) => {
                console.log(` - ${issue.key}: ${issue.fields.summary}`);
              });
            } else {
              console.log('ℹ️ No issues found in this JIRA instance.');
            }
          } else {
            console.warn(`⚠️ Failed to search issues: ${response.status}`);
            
            console.log('⏳ Attempting to list projects...');
            const projResponse = await fetch(`${config.baseUrl.replace(/\/$/, '')}/rest/api/3/project`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            });
            
            if (projResponse.ok) {
              const projects: any = await projResponse.json();
              if (Array.isArray(projects) && projects.length > 0) {
                console.log(`✅ Found ${projects.length} projects:`);
                projects.forEach((p: any) => {
                  console.log(` - ${p.key}: ${p.name}`);
                });
              } else {
                console.log('ℹ️ No projects found.');
              }
            } else {
              console.warn(`⚠️ Failed to list projects: ${projResponse.status}`);
            }
          }
        } catch (searchError: any) {
          console.error(`❌ Error searching issues: ${searchError.message}`);
        }
      }
    } else {
      console.error(`❌ ${result.message}`);
    }
  } catch (error: any) {
    console.error(`❌ Unexpected error: ${error.message}`);
  }
}

verifyJira();
