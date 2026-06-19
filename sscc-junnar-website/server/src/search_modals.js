import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:\\Users\\Siddhu\\Downloads\\sscc-junnar-website\\sscc-junnar-website\\admin\\index.html');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    if (line.includes('modal-overlay') || line.includes('modal-container')) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  }
}

main().catch(console.error);
