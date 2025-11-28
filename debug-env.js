// debug-env.js
const fs = require('fs');
const path = require('path');

console.log("1. Current Directory:", process.cwd());

const envPath = path.join(process.cwd(), '.env.local');
console.log("2. Looking for .env.local at:", envPath);

try {
  if (fs.existsSync(envPath)) {
    console.log("3. File FOUND ✅");
    const content = fs.readFileSync(envPath, 'utf8');
    console.log("4. First 10 chars of content:", content.substring(0, 10)); // Don't log full keys!
  } else {
    console.log("3. File NOT FOUND ❌");
  }
} catch (err) {
  console.error("3. Error accessing file:", err.message);
}
