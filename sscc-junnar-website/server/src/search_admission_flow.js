import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:\\Users\\Siddhu\\Downloads\\sscc-junnar-website\\sscc-junnar-website\\js\\admin-app.js');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    if (line.includes('admission') || line.includes('Admission') || line.includes('Approve') || line.includes('approve') || line.includes('reject') || line.includes('Reject')) {
      console.log(`Line ${index}: ${line.trim().substring(0, 150)}`);
    }
  }
}

main().catch(console.error);
