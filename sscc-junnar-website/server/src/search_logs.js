import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    const lower = line.toLowerCase();
    // Look for reports of errors in browser subagent runs
    if (lower.includes('error') && lower.includes('subagent') && (lower.includes('console') || lower.includes('uncaught'))) {
      console.log(`Line ${index} matches:`);
      console.log(line.substring(0, 1500));
      console.log('---');
    }
  }
}

main().catch(console.error);
