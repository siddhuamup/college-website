
import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:\\Users\\Siddhu\\Downloads\\sscc-junnar-website\\sscc-junnar-website\\server\\src\\routes\\admin.js');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    if (line.includes('settings') || line.includes('Settings') || line.includes('Setting')) {
      console.log(`Line ${index}: ${line.trim().substring(0, 150)}`);
    }
  }
}

main().catch(console.error);
