import { parseAllSpecsInText } from '../services/link-parser';

async function testLinkParser() {
  console.log('🔍 Testing Link Parser...');
  
  const textWithLinks = `
    Please refer to our PRD here: https://raw.githubusercontent.com/Manoj8759/Project-14-Intelligent-Test-Plan-Generator-Using-JIRA/main/README.md
    And the PDF spec: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
  `;

  try {
    const scrapedContent = await parseAllSpecsInText(textWithLinks);
    console.log('\n--- SCRAPED CONTENT SUMMARY ---\n');
    console.log(scrapedContent.substring(0, 500) + '...');
    console.log('\n-------------------------------\n');

    if (scrapedContent.includes('--- Source:')) {
      console.log('✅ Success: Links were detected and scraped.');
    } else {
      console.log('❌ Failure: No content was scraped from links.');
    }
  } catch (error) {
    console.error('❌ Error during link parsing:', error);
  }
}

testLinkParser();
