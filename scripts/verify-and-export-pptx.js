import { auditSlides, htmlToPptxBuffer } from '../lib/pptx-export.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function checkSlide(a) {
  if (a.empty) return ['EMPTY - no content extracted'];
  const issues = [];

  if (/development progress|milestone/i.test(a.title) && a.timelines < 3) {
    issues.push(`timeline items=${a.timelines} (expected 5)`);
  }
  if (/simple\. legal|bank account/i.test(a.title) && a.flows < 3) {
    issues.push(`flow steps=${a.flows} (expected 4)`);
  }
  if (/crypto \+ forex|dual market/i.test(a.title) && a.charts < 1) {
    issues.push('missing market chart');
  }
  if (/3-year revenue|revenue projection/i.test(a.title) && (a.charts < 1 || a.tableRows < 4)) {
    issues.push('missing revenue chart or table');
  }
  if (/cost breakdown|seed round/i.test(a.title) && a.charts < 1) {
    issues.push('missing fund chart');
  }
  if (/competitive landscape/i.test(a.title) && a.tableRows < 5) {
    issues.push(`comparison table rows=${a.tableRows}`);
  }
  if (/investor returns|strong returns/i.test(a.title) && a.stats < 4) {
    issues.push(`stat cards=${a.stats} (expected 4)`);
  }
  if (/profitable|unit economics/i.test(a.title) && a.stats < 4) {
    issues.push(`stat cards=${a.stats}`);
  }
  if (/compliant by design|platform/i.test(a.title) && /design/i.test(a.title) && a.stats < 4) {
    issues.push(`platform stat cards=${a.stats}`);
  }

  return issues;
}

async function main() {
  const res = await fetch('https://seed-presentation.vercel.app/api/content');
  const { html } = await res.json();
  const audit = auditSlides(html);

  console.log('=== SLIDE-BY-SLIDE CHECK (live site content) ===\n');
  let issues = 0;
  const fallbacks = [];

  audit.forEach((a) => {
    const flags = checkSlide(a);
    if (a.usedFallback) fallbacks.push(`Slide ${a.index}: ${a.title}`);
    if (flags.length) {
      issues++;
      console.log(`Slide ${a.index}: ${a.title}`);
      console.log(`  layout=${a.layout} | stats=${a.stats} bullets=${a.bullets} timelines=${a.timelines} charts=${a.charts}`);
      console.log(`  PROBLEM: ${flags.join('; ')}`);
      if (a.timelineSample) console.log(`  sample:`, a.timelineSample);
      console.log('');
    }
  });

  console.log(`Total slides: ${audit.length}`);
  console.log(`Slides with problems: ${issues}`);
  if (fallbacks.length) {
    console.log('\nSlides restored from original backup (were blank on live save):');
    fallbacks.forEach((f) => console.log(' -', f));
  }

  if (issues > 0) {
    console.log('\nStopped — fix the problems above before creating the file.');
    process.exit(1);
  }

  console.log('\nAll slides passed. Creating PowerPoint...');
  const buffer = await htmlToPptxBuffer(html);
  const desktop = path.join(process.env.USERPROFILE || '', 'Desktop', 'XchangeByte-Investor-Pitch-FINAL.pptx');
  fs.writeFileSync(desktop, buffer);
  fs.writeFileSync(path.join(root, 'XchangeByte-Investor-Pitch-FULL.pptx'), buffer);
  console.log('Saved:', desktop);
  console.log('Slides in file:', audit.length);
  console.log('File size:', (buffer.length / 1024).toFixed(1), 'KB');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
