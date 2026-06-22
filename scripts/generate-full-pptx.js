import { htmlToPptxBuffer } from '../lib/pptx-export.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function fetchLiveHtml() {
  const res = await fetch('https://seed-presentation.vercel.app/api/content');
  const data = await res.json();
  if (!data.html) throw new Error('No saved HTML on live site');
  return data.html;
}

async function main() {
  const outName = 'XchangeByte-Investor-Pitch-FULL.pptx';
  const desktop = path.join(process.env.USERPROFILE || '', 'Desktop', outName);
  const projectOut = path.join(root, outName);

  console.log('Fetching live presentation content...');
  const html = await fetchLiveHtml();
  const sectionCount = (html.match(/<section/gi) || []).length;
  console.log('Slides found:', sectionCount);

  console.log('Building PowerPoint (charts, icons, click builds)...');
  const buffer = await htmlToPptxBuffer(html);

  fs.writeFileSync(projectOut, buffer);
  fs.writeFileSync(desktop, buffer);
  const finalDesktop = path.join(process.env.USERPROFILE || '', 'Desktop', 'XchangeByte-Investor-Pitch-FINAL.pptx');
  fs.writeFileSync(finalDesktop, buffer);
  console.log('Saved:', projectOut);
  console.log('Saved:', finalDesktop);
  console.log('Size:', (buffer.length / 1024).toFixed(1), 'KB');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
