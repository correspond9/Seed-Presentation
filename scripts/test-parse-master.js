import { parseSlide, parseSections } from '../lib/pptx-export.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'presentation-view.html'), 'utf8');
const start = html.indexOf('<div class="slides">') + 20;
const end = html.indexOf('\n    </div>\n  </div>\n\n  <script');
const sections = parseSections(html.slice(start, end));
[21, 22, 29, 30, 31, 32].forEach((i) => {
  const d = parseSlide(sections[i]);
  console.log(i + 1, d.title, d.layout, 'stats', d.stats.length, 'tl', d.timelines.length, 'p', d.paragraphs.length);
});
