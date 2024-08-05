const fs = require('fs');

const hash = new Date().getTime();

const environmentPath = 'src/environments/environment.ts';
const environmentProdPath = 'src/environments/environment.prod.ts';

function updateEnvironmentFile(filePath, hash) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, { encoding: 'utf8' });

    // Find existing buildHash and replace it, or add it if not present
    const buildHashRegex = /buildHash\s*:\s*'[^']*'/;
    if (buildHashRegex.test(content)) {
      content = content.replace(buildHashRegex, `buildHash: '${hash}'`);
    } else {
      const lastBraceIndex = content.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        content = content.slice(0, lastBraceIndex) + `, buildHash: '${hash}'` + content.slice(lastBraceIndex);
      }
    }

    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    console.log(`Updated buildHash in ${filePath}`);
  } else {
    console.error(`File ${filePath} not found`);
  }
}

updateEnvironmentFile(environmentPath, hash);
updateEnvironmentFile(environmentProdPath, hash);

console.log(`Build hash generated: ${hash}`);
