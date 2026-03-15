const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT value FROM settings WHERE key = 'jira_config'", (err, row) => {
  if (err) {
    console.log('Error:', err.message);
  } else if (row) {
    const cfg = JSON.parse(row.value);
    console.log('✅ JIRA Config found in database:');
    console.log('   Base URL:', cfg.baseUrl);
    console.log('   Username:', cfg.username);
    console.log('   API Token: [stored securely]');
  } else {
    console.log('❌ No JIRA config found in database');
  }
  db.close();
});
