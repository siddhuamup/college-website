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
    if (line.includes('modal-edit-student') || (index > 400 && index < 700 && line.includes('button'))) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  }
}

main().catch(console.error);
