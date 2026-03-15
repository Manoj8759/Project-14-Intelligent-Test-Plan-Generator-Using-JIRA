/**
 * Check if GROQ key is in secure store
 */
import { secureStore } from '../backend/src/utils/encryption';
import { dbGet } from '../backend/src/utils/database';

async function checkLLM() {
  const llmConfigRow = await dbGet("SELECT value FROM settings WHERE key = 'llm_config'");
  let llmConfig = null;
  if(llmConfigRow) {
    llmConfig = JSON.parse(llmConfigRow.value);
    console.log("DB LLM Config found:", llmConfig);
  } else {
    console.log("No DB LLM Config found.");
  }
  
  const groqKey = await secureStore.getPassword('groq-api-key');
  if(groqKey) {
    console.log("✅ Groq API Key found in secureStore!");
    console.log(`Key length: ${groqKey.length}, starts with: ${groqKey.substring(0, 4)}...`);
  } else {
    console.log("⚠️ No Groq API Key found in secureStore.");
  }
}

checkLLM();
