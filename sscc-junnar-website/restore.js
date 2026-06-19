const fs = require('fs');
const path = 'C:/Users/Siddhu/.gemini/antigravity-ide/brain/0b66d80b-9122-4539-a4a1-991d2a048f97/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let diffOutput = '';
for (let line of lines) {
  if (line.includes('@@ -1,501 +1,3 @@')) {
    const data = JSON.parse(line);
    // Find where the output is.
    if (data.content) {
       diffOutput = data.content;
    } else if (data.output) {
       diffOutput = data.output;
    } else {
       diffOutput = JSON.stringify(data); // Fallback to see what it is
    }
  }
}

let textToParse = diffOutput;
if (textToParse.includes('\\n')) {
  // It might be JSON stringified twice, but let's assume it's just raw text.
}
const outputLines = textToParse.split('\n');
let inDiff = false;
let restored = [];
for (let line of outputLines) {
  // In the JSON string, newlines are actual \n characters if split('\n') works.
  if (line.includes('@@ -1,501 +1,3 @@')) {
    inDiff = true;
    continue;
  }
  if (line.includes('[diff_block_end]')) {
    inDiff = false;
  }
  if (inDiff) {
    if (line.startsWith('-')) {
      restored.push(line.substring(1));
    } else if (line.startsWith(' ') || line === '') {
      restored.push(line.length > 0 ? line.substring(1) : line);
    }
  }
}
fs.writeFileSync('C:/Users/Siddhu/Downloads/sscc-junnar-website/sscc-junnar-website/student/index.html', restored.join('\n') + '\n');
console.log('Restored lines count: ' + restored.length);
