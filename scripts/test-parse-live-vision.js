import { parseSlide, parseSections } from '../lib/pptx-export.js';

const { html } = await (await fetch('https://seed-presentation.vercel.app/api/content')).json();
const sections = parseSections(html);
[31, 32].forEach((i) => {
  const d = parseSlide(sections[i]);
  console.log(i + 1, JSON.stringify({ title: d.title, paragraphs: d.paragraphs, layout: d.layout }));
});
