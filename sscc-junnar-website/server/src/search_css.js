import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:\\Users\\Siddhu\\Downloads\\sscc-junnar-website\\sscc-junnar-website\\css\\styles.css');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    if (line.includes('transition') || line.includes('animation') || line.includes('@keyframes') || line.includes('transform:')) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  }
}

main().catch(console.error);
