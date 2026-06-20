const pptxgen = require('pptxgenjs');

const COLORS = {
  bg: '030712',
  cyan: '22D3EE',
  gold: 'FBBF24',
  white: 'F8FAFC',
  muted: '94A3B8',
  card: '0F172A',
  emerald: '10B981',
};

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

function matchAll(html, regex) {
  const results = [];
  let flags = regex.flags || '';
  if (!flags.includes('g')) flags += 'g';
  const re = new RegExp(regex.source, flags);
  let m;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1] !== undefined ? m[1] : m[0]);
  }
  return results;
}

function parseSections(html) {
  const sections = [];
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    sections.push({ attrs: m[1] || '', body: m[2] });
  }
  return sections;
}

function parseSlide(section) {
  const body = section.body.replace(/<aside[\s\S]*?<\/aside>/gi, '');
  const isChapter = /class="[^"]*chapter-slide/i.test(section.attrs);

  const eyebrow = matchAll(body, /<div class="eyebrow[^"]*">([\s\S]*?)<\/div>/i)[0];
  const h1 = matchAll(body, /<h1[^>]*>([\s\S]*?)<\/h1>/i)[0];
  const h2 = matchAll(body, /<h2[^>]*>([\s\S]*?)<\/h2>/i)[0];
  const h3list = matchAll(body, /<h3[^>]*>([\s\S]*?)<\/h3>/gi);
  const paragraphs = matchAll(body, /<p[^>]*>([\s\S]*?)<\/p>/gi).map(stripTags).filter(Boolean);
  const listItems = matchAll(body, /<li[^>]*>([\s\S]*?)<\/li>/gi).map(stripTags).filter(Boolean);
  const values = matchAll(body, /<div class="value[^"]*">([\s\S]*?)<\/div>/gi).map(stripTags).filter(Boolean);
  const labels = matchAll(body, /<div class="label[^"]*">([\s\S]*?)<\/div>/gi).map(stripTags).filter(Boolean);

  const tableRows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(body)) !== null) {
    const cells = matchAll(rowMatch[1], /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi).map(stripTags);
    if (cells.length) tableRows.push(cells);
  }

  const title = stripTags(h1 || h2 || h3list[0] || eyebrow || 'Slide');
  const subtitle = stripTags(h2 && h1 ? h2 : '');

  return {
    isChapter,
    eyebrow: eyebrow ? stripTags(eyebrow) : '',
    title,
    subtitle,
    h3list: h3list.map(stripTags),
    paragraphs,
    listItems,
    stats: values.map((v, i) => ({ value: v, label: labels[i] || '' })).filter((s) => s.value),
    tableRows,
  };
}

function addSlideContent(pptx, slide, data, index) {
  slide.background = { color: COLORS.bg };

  if (data.isChapter) {
    slide.addText(String(index + 1).padStart(2, '0'), {
      x: 0.6, y: 1.8, w: 12, h: 1.2, fontSize: 56, bold: true, color: COLORS.cyan, align: 'center',
    });
    slide.addText(data.title, {
      x: 0.6, y: 3, w: 12, h: 1, fontSize: 36, bold: true, color: COLORS.white, align: 'center',
    });
    if (data.paragraphs[0]) {
      slide.addText(data.paragraphs[0], {
        x: 1.5, y: 4, w: 10, h: 0.8, fontSize: 14, color: COLORS.muted, align: 'center',
      });
    }
    return;
  }

  let y = 0.35;

  if (data.eyebrow) {
    slide.addText(data.eyebrow.toUpperCase(), {
      x: 0.6, y, w: 11, h: 0.35, fontSize: 10, color: COLORS.cyan, bold: true, charSpacing: 2,
    });
    y += 0.45;
  }

  slide.addText(data.title, {
    x: 0.6, y, w: 11.5, h: 0.9, fontSize: data.title.length > 60 ? 22 : 28, bold: true, color: COLORS.white, valign: 'top',
  });
  y += 1;

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.6, y, w: 11.5, h: 0.5, fontSize: 16, color: COLORS.muted,
    });
    y += 0.55;
  }

  if (data.stats.length) {
    const w = Math.min(2.7, 11 / Math.max(data.stats.length, 1));
    data.stats.slice(0, 4).forEach((s, i) => {
      const x = 0.6 + i * (w + 0.2);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w, h: 1.4, rectRadius: 0.1,
        fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
      });
      slide.addText(s.value, { x, y: y + 0.15, w, h: 0.5, fontSize: 20, bold: true, color: COLORS.cyan, align: 'center' });
      slide.addText(s.label, { x: x + 0.05, y: y + 0.7, w: w - 0.1, h: 0.55, fontSize: 8, color: COLORS.muted, align: 'center' });
    });
    y += 1.6;
  }

  if (data.tableRows.length) {
    slide.addTable(data.tableRows, {
      x: 0.6, y, w: 11.5,
      fontSize: 9, color: COLORS.muted,
      border: { type: 'solid', color: '1E293B', pt: 1 },
      fill: { color: COLORS.card },
      valign: 'middle',
    });
    return;
  }

  const bullets = data.listItems.length ? data.listItems : data.paragraphs;
  if (bullets.length) {
    const rows = bullets.slice(0, 12).map((t) => ({
      text: t,
      options: { bullet: true, breakLine: true },
    }));
    slide.addText(rows, {
      x: 0.6, y, w: 11.5, h: 5.2 - y, fontSize: 12, color: COLORS.muted, valign: 'top',
    });
  } else if (data.h3list.length) {
    slide.addText(data.h3list.join('\n'), {
      x: 0.6, y, w: 11.5, h: 4, fontSize: 14, color: COLORS.muted,
    });
  }
}

async function htmlToPptxBuffer(html) {
  const pptx = new pptxgen();
  pptx.author = 'XchangeByte';
  pptx.title = 'XchangeByte — Investor Presentation';
  pptx.subject = 'India Compliant Crypto & Forex Trading Platform';
  pptx.company = 'XchangeByte';
  pptx.layout = 'LAYOUT_WIDE';

  const sections = parseSections(html);
  if (!sections.length) {
    const slide = pptx.addSlide();
    slide.addText('No slides found', { x: 1, y: 2, fontSize: 24, color: COLORS.white });
  } else {
    sections.forEach((section, i) => {
      const data = parseSlide(section);
      addSlideContent(pptx, pptx.addSlide(), data, i);
    });
  }

  const base64 = await pptx.write({ outputType: 'base64' });
  return Buffer.from(base64, 'base64');
}

module.exports = { htmlToPptxBuffer, parseSections, parseSlide };
