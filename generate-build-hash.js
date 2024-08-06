const environmentPath = 'src/environments/environment.ts';
const environmentProdPath = 'src/environments/environment.prod.ts';
const packagePath = 'package.json';

const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

const packageJsonPath = path.join(__dirname, packagePath);
const packageJson = require(packageJsonPath);

// Split the version into its components
const versionParts = packageJson.version.split('.');
const major = parseInt(versionParts[0]);
const minor = parseInt(versionParts[1]);
let patch = parseInt(versionParts[2]);
// Increment the patch version
patch += 1;
// Update the version string
const hashVersion = `${major}.${minor}.${patch}-${uuid.v4().replace(/-/g, '')}`;
packageJson.version = hashVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
console.log(`Version updated to ${packageJson.version}`);

function updateEnvironmentFile(filePath, version)
{
    if (fs.existsSync(filePath))
    {
        let content = fs.readFileSync(filePath, { encoding: 'utf8' });

        // Find existing buildHash and replace it, or add it if not present
        const buildHashRegex = /version\s*:\s*'[^']*'/;
        if (buildHashRegex.test(content))
        {
            content = content.replace(buildHashRegex, `version: '${version}'`);
        } else
        {
            const lastBraceIndex = content.lastIndexOf('}');
            if (lastBraceIndex !== -1)
            {
                content = content.slice(0, lastBraceIndex) + `, version: '${version}'` + content.slice(lastBraceIndex);
            }
        }

        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
        console.log(`Updated version in ${filePath}`);
    } else
    {
        console.error(`File ${filePath} not found`);
    }
}

updateEnvironmentFile(environmentPath, hashVersion);
updateEnvironmentFile(environmentProdPath, hashVersion);



console.log(`Build hash generated: ${hashVersion}`);


