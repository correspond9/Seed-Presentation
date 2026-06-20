const fs = require('fs');
const path = require('path');

const API_URL = process.env.RESTORE_API_URL || 'https://seed-presentation.vercel.app/api/content';
const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'presentation-view.html');
const backupsDir = path.join(root, 'backups');

function extractSlidesHtml(html) {
  const start = html.indexOf('<div class="slides">');
  if (start === -1) throw new Error('Could not find slides container in presentation-view.html');
  const innerStart = start + '<div class="slides">'.length;
  const end = html.indexOf('\n    </div>\n  </div>\n\n  <script', innerStart);
  if (end === -1) throw new Error('Could not find end of slides container');
  return html.slice(innerStart, end);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(backupsDir, { recursive: true });

  console.log('Fetching current live content...');
  const currentRes = await fetch(API_URL);
  const current = await currentRes.json();
  const backupPath = path.join(backupsDir, `pitch-content-before-restore-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(current, null, 2), 'utf8');
  console.log('Backup saved:', backupPath);

  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const slidesHtml = extractSlidesHtml(sourceHtml);
  const slideCount = (slidesHtml.match(/<section/g) || []).length;
  console.log('Restoring', slideCount, 'slides from presentation-view.html');

  const restoreRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: slidesHtml,
      zoom: null,
      mediaLibrary: [],
      globalLogo: null,
    }),
  });

  const result = await restoreRes.json();
  if (!restoreRes.ok || !result.ok) {
    throw new Error(result.error || `Restore failed (${restoreRes.status})`);
  }

  console.log('Restore complete at', result.updatedAt);
  console.log('Previous version backed up to', backupPath);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
