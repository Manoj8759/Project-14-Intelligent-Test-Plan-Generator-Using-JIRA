import { dbRun, dbAll } from '../backend/src/utils/database';

async function migrate() {
  try {
    // Check if jira_task_id exists
    const columns = await dbAll("PRAGMA table_info(test_cases)");
    const hasJiraTaskId = columns.some((col: any) => col.name === 'jira_task_id');
    
    if (!hasJiraTaskId) {
      console.log('Adding jira_task_id column to test_cases table...');
      await dbRun("ALTER TABLE test_cases ADD COLUMN jira_task_id TEXT");
      console.log('✅ Column added successfully.');
    } else {
      console.log('✅ Column jira_task_id already exists.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
