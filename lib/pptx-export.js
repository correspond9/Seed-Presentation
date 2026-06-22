import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pptxgen = PptxGenJS.default || PptxGenJS;

const COLORS = {
  bg: '030712',
  cyan: '22D3EE',
  gold: 'FBBF24',
  white: 'F8FAFC',
  muted: '94A3B8',
  card: '0F172A',
  emerald: '10B981',
  violet: '8B5CF6',
  blue: '3B82F6',
};

const DEFAULT_CHARTS = {
  marketChart: {
    labels: ['2024', '2025', '2026', '2027', '2028'],
    values: [4500, 6200, 8900, 12800, 18500],
  },
  revenueChart: {
    labels: ['Year 1', 'Year 2', 'Year 3'],
    series: [
      { name: 'Revenue (₹ Cr)', values: [6.2, 31, 96], color: '22D3EE' },
      { name: 'EBITDA (₹ Cr)', values: [0.9, 10.9, 46], color: '10B981' },
    ],
  },
  fundChart: {
    labels: ['Compliance', 'Technology', 'Marketing', 'Banking', 'Operations'],
    values: [35, 30, 20, 10, 5],
    colors: ['22D3EE', '3B82F6', '8B5CF6', '10B981', 'FBBF24'],
  },
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
    String(html || '')
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

function extractDivsByClass(html, className) {
  const results = [];
  const re = new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'gi');
  let m;
  while ((m = re.exec(html)) !== null) {
    const openTag = m[0];
    const start = m.index;
    let depth = 1;
    let i = start + openTag.length;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        i = nextClose + 6;
      }
    }
    results.push(html.slice(start, i));
  }
  return results;
}

function firstInner(html, className) {
  const m = html.match(new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
  return m ? stripTags(m[1]) : '';
}

function cleanBody(html) {
  return html
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<div class="slide-bg">[\s\S]*?<\/div>\s*(?=<div class="content-wrap"|<div class="chapter-number")/gi, '')
    .replace(/<div class="slide-zoom-wrap"[^>]*>/gi, '')
    .replace(/<\/div>\s*<\/section>/gi, '')
    .replace(/\scontenteditable="[^"]*"/gi, '')
    .replace(/\sspellcheck="[^"]*"/gi, '');
}

function getContentWrap(body, isChapter) {
  if (isChapter) return body;
  const m = body.match(/<div class="content-wrap"[^>]*>([\s\S]*)$/i);
  return m ? m[1] : body;
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

function extractTableRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells = matchAll(rowMatch[1], /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi).map(stripTags);
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseFundLegend(content) {
  const blocks = extractDivsByClass(content, 'fund-legend');
  if (!blocks.length) return null;
  const lines = extractDivsByClass(blocks[0], '').length
    ? matchAll(blocks[0], /<div[^>]*>([\s\S]*?)<\/div>/gi).map(stripTags).filter(Boolean)
    : [];
  const parsed = [];
  lines.forEach((line) => {
    const m = line.match(/(\d+)\s*%?\s*[—\-]?\s*(.+)/);
    if (m) parsed.push({ pct: parseInt(m[1], 10), label: m[2].trim() });
  });
  if (parsed.length < 3) return null;
  return {
    labels: parsed.map((p) => `${p.pct}% ${p.label}`),
    values: parsed.map((p) => p.pct),
    colors: DEFAULT_CHARTS.fundChart.colors.slice(0, parsed.length),
  };
}

function parseRevenueFromTable(rows) {
  if (!rows.length) return null;
  const header = rows[0];
  const revRow = rows.find((r) => /total revenue|revenue/i.test(stripTags(r[0])) && !/ebitda/i.test(stripTags(r[0])));
  const ebitdaRow = rows.find((r) => /^ebitda$/i.test(stripTags(r[0])));
  if (!revRow) return null;
  const parseNum = (s) => {
    const n = parseFloat(stripTags(s).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    labels: header.slice(1).map(stripTags),
    series: [
      { name: 'Revenue (₹ Cr)', values: revRow.slice(1).map(parseNum), color: '22D3EE' },
      ...(ebitdaRow ? [{ name: 'EBITDA (₹ Cr)', values: ebitdaRow.slice(1).map(parseNum), color: '10B981' }] : []),
    ],
  };
}

function parseSlide(section) {
  const body = cleanBody(section.body);
  const isChapter = /class="[^"]*chapter-slide/i.test(section.attrs);
  const content = getContentWrap(body, isChapter);

  const eyebrow = stripTags(matchAll(content, /<div class="eyebrow[^"]*"[^>]*>([\s\S]*?)<\/div>/i)[0] || '');
  const h1 = stripTags(matchAll(content, /<h1[^>]*>([\s\S]*?)<\/h1>/i)[0] || '');
  const h2 = stripTags(matchAll(content, /<h2[^>]*>([\s\S]*?)<\/h2>/i)[0] || '');
  const chapterNum = stripTags(matchAll(content, /<div class="chapter-number"[^>]*>([\s\S]*?)<\/div>/i)[0] || '');

  const stats = extractDivsByClass(content, 'stat-card').map((card) => ({
    value: firstInner(card, 'value'),
    label: firstInner(card, 'label'),
    title: stripTags(matchAll(card, /<h3[^>]*>([\s\S]*?)<\/h3>/i)[0] || ''),
    desc: stripTags(matchAll(card, /<p[^>]*>([\s\S]*?)<\/p>/i)[0] || ''),
  })).filter((s) => s.value || s.label || s.title || s.desc);

  const bullets = matchAll(content, /<li[^>]*>([\s\S]*?)<\/li>/gi).map(stripTags).filter(Boolean);

  const flows = extractDivsByClass(content, 'flow-node').map(stripTags).filter(Boolean);

  const timelines = extractDivsByClass(content, 'timeline-item').map((item) => ({
    phase: firstInner(item, 'phase'),
    title: firstInner(item, 'title'),
    desc: firstInner(item, 'desc'),
  })).filter((t) => t.phase || t.title || t.desc);

  const tableMatch = content.match(/<table class="compare-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  const tableRows = tableMatch ? extractTableRows(tableMatch[0]) : [];

  const h3Sections = [];
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let h3m;
  while ((h3m = h3Re.exec(content)) !== null) {
    const title = stripTags(h3m[1]);
    const after = content.slice(h3m.index + h3m[0].length, h3m.index + h3m[0].length + 600);
    const listItems = matchAll(after, /<li[^>]*>([\s\S]*?)<\/li>/gi).map(stripTags).filter(Boolean);
    if (title && listItems.length) h3Sections.push({ title, items: listItems });
  }

  const paragraphs = matchAll(content, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter((t) => t && !/^India digital trading/i.test(t));

  const chartIds = matchAll(content, /<canvas id="([^"]+)"/gi);
  const fundLegend = parseFundLegend(content);
  const revenueData = chartIds.includes('revenueChart') ? parseRevenueFromTable(tableRows) : null;
  const fundBullets = extractDivsByClass(content, 'fund-legend').length
    ? matchAll(extractDivsByClass(content, 'fund-legend')[0], /<div[^>]*>([\s\S]*?)<\/div>/gi).map(stripTags).filter(Boolean)
    : [];

  return {
    isChapter,
    chapterNum,
    eyebrow,
    title: h1 || h2 || chapterNum || eyebrow || 'Slide',
    subtitle: h1 && h2 ? h2 : '',
    stats,
    bullets,
    flows,
    timelines,
    tableRows,
    h3Sections,
    paragraphs,
    chartIds,
    fundLegend,
    revenueData,
    fundBullets,
    hasTwoCol: /class="two-col"/i.test(content),
    layout: detectLayout({ stats, bullets, flows, timelines, tableRows, chartIds, h3Sections, fundBullets, isChapter }),
  };
}

function isSlideDataEmpty(d) {
  if (d.isChapter) return false;
  const hasText = d.paragraphs.some((p) => p && p.trim());
  return !d.stats.length && !d.bullets.length && !d.timelines.length && !d.flows.length
    && !d.tableRows.length && !d.chartIds.length && !d.h3Sections.length && !hasText;
}

function loadMasterSections() {
  try {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const html = fs.readFileSync(path.join(root, 'presentation-view.html'), 'utf8');
    const start = html.indexOf('<div class="slides">');
    if (start === -1) return [];
    const innerStart = start + '<div class="slides">'.length;
    const end = html.indexOf('\n    </div>\n  </div>\n\n  <script', innerStart);
    return parseSections(html.slice(innerStart, end === -1 ? undefined : end));
  } catch {
    return [];
  }
}

function mergeWithMaster(liveData, masterData) {
  if (!masterData || !isSlideDataEmpty(liveData)) return { ...liveData, usedFallback: false };
  const merged = parseSlide(masterData);
  return { ...merged, usedFallback: true, fallbackReason: 'Live slide had no saved content' };
}

function detectLayout(data) {
  if (data.isChapter) return 'chapter';
  if (data.timelines.length) return 'timeline';
  if (data.flows.length) return 'flow';
  if (data.chartIds.includes('revenueChart') && data.tableRows.length) return 'chart-table';
  if (data.chartIds.includes('fundChart')) return 'fund-chart';
  if (data.hasTwoCol && data.chartIds.includes('marketChart')) return 'two-col-chart';
  if (data.tableRows.length && !data.chartIds.length) return 'table';
  if (data.stats.length >= 3 && !data.bullets.length) return 'stats';
  if (data.h3Sections.length) return 'two-col-lists';
  if (data.bullets.length && data.stats.length) return 'mixed';
  if (data.stats.length) return 'stats';
  if (data.bullets.length) return 'bullets';
  return 'text';
}

function addBg(slide) {
  slide.background = { color: COLORS.bg };
}

function addHeader(slide, data, yStart) {
  let y = yStart;
  if (data.eyebrow) {
    slide.addText(data.eyebrow.toUpperCase(), {
      x: 0.5, y, w: 12, h: 0.32, fontSize: 10, color: COLORS.cyan, bold: true, charSpacing: 2,
    });
    y += 0.42;
  }
  slide.addText(data.title, {
    x: 0.5, y, w: 12, h: 0.85, fontSize: data.title.length > 55 ? 22 : 28, bold: true, color: COLORS.white, valign: 'top',
  });
  y += 0.95;
  if (data.subtitle && data.subtitle !== data.title) {
    slide.addText(data.subtitle, {
      x: 0.5, y, w: 12, h: 0.5, fontSize: 15, color: COLORS.muted,
    });
    y += 0.55;
  }
  return y;
}

function addStatCards(slide, stats, x, y, totalW, maxCount) {
  const count = Math.min(stats.length, maxCount || 4);
  if (!count) return y;
  const cardW = (totalW - (count - 1) * 0.18) / count;
  stats.slice(0, count).forEach((s, i) => {
    const cx = x + i * (cardW + 0.18);
    slide.addShape('roundRect', {
      x: cx, y, w: cardW, h: 1.55, rectRadius: 0.08,
      fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
    });
    const val = s.value || s.title || '';
    if (val) {
      slide.addText(val, {
        x: cx, y: y + 0.12, w: cardW, h: 0.55, fontSize: val.length > 6 ? 18 : 24, bold: true,
        color: COLORS.cyan, align: 'center', fontFace: 'Arial',
      });
    }
    const label = s.label || s.desc || '';
    if (label) {
      slide.addText(label, {
        x: cx + 0.08, y: y + 0.68, w: cardW - 0.16, h: 0.78, fontSize: 9, color: COLORS.muted, align: 'center', valign: 'top',
      });
    }
  });
  return y + 1.7;
}

function addChart(slide, pptx, chartId, data, x, y, w, h) {
  const chartOpts = {
    x, y, w, h,
    chartArea: { fill: { color: COLORS.card } },
    catAxisLabelColor: COLORS.muted,
    valAxisLabelColor: COLORS.muted,
    valGridLine: { color: '1E293B', style: 'solid' },
    catGridLine: { color: '1E293B', style: 'solid' },
    showLegend: true,
    legendPos: 'b',
    legendColor: COLORS.muted,
    legendFontSize: 9,
  };

  if (chartId === 'marketChart') {
    const def = DEFAULT_CHARTS.marketChart;
    slide.addChart(pptx.charts.LINE, [{
      name: 'India Digital Trading Market (₹ Cr)',
      labels: def.labels,
      values: def.values,
    }], { ...chartOpts, chartColors: [COLORS.cyan], lineSize: 2 });
    return;
  }

  if (chartId === 'revenueChart') {
    const rev = data.revenueData || { labels: DEFAULT_CHARTS.revenueChart.labels, series: DEFAULT_CHARTS.revenueChart.series };
    slide.addChart(pptx.charts.BAR, rev.series.map((s) => ({
      name: s.name,
      labels: rev.labels,
      values: s.values,
    })), {
      ...chartOpts,
      barDir: 'col',
      barGrouping: 'clustered',
      chartColors: [COLORS.cyan, COLORS.emerald],
    });
    return;
  }

  if (chartId === 'fundChart') {
    const fund = data.fundLegend || {
      labels: DEFAULT_CHARTS.fundChart.labels,
      values: DEFAULT_CHARTS.fundChart.values,
      colors: DEFAULT_CHARTS.fundChart.colors,
    };
    slide.addChart(pptx.charts.DOUGHNUT, [{
      name: 'Allocation',
      labels: fund.labels,
      values: fund.values,
    }], { ...chartOpts, chartColors: fund.colors, showPercent: true, legendPos: 'r' });
  }
}

function renderTimeline(slide, data, y) {
  const items = data.timelines;
  const count = items.length;
  const tw = (12 - 0.5 - (count - 1) * 0.1) / count;
  items.forEach((t, i) => {
    const tx = 0.5 + i * (tw + 0.1);
    slide.addShape('roundRect', {
      x: tx, y, w: tw, h: 2.2, rectRadius: 0.08,
      fill: { color: COLORS.card },
      line: { color: /done|progress/i.test(t.phase) ? COLORS.cyan : '1E293B', width: 1 },
    });
    if (t.phase) {
      slide.addText(t.phase, {
        x: tx + 0.08, y: y + 0.12, w: tw - 0.16, h: 0.35, fontSize: 10, color: COLORS.cyan, bold: true,
      });
    }
    if (t.title) {
      slide.addText(t.title, {
        x: tx + 0.08, y: y + 0.48, w: tw - 0.16, h: 0.4, fontSize: 12, color: COLORS.white, bold: true,
      });
    }
    if (t.desc) {
      slide.addText(t.desc, {
        x: tx + 0.08, y: y + 0.9, w: tw - 0.16, h: 1.15, fontSize: 9, color: COLORS.muted, valign: 'top',
      });
    }
  });
}

function renderFlow(slide, data, y) {
  const nodeW = 2.55;
  data.flows.slice(0, 4).forEach((text, i) => {
    const nx = 0.5 + i * (nodeW + 0.45);
    slide.addShape('roundRect', {
      x: nx, y, w: nodeW, h: 1.35, rectRadius: 0.08,
      fill: { color: COLORS.card }, line: { color: COLORS.cyan, width: 1 },
    });
    slide.addText(text, {
      x: nx + 0.06, y: y + 0.1, w: nodeW - 0.12, h: 1.1, fontSize: 10, color: COLORS.white, align: 'center', valign: 'middle',
    });
    if (i < data.flows.length - 1) {
      slide.addText('→', { x: nx + nodeW + 0.05, y: y + 0.45, w: 0.35, h: 0.4, fontSize: 16, color: COLORS.cyan, align: 'center' });
    }
  });
}

function renderSlide(pptx, data) {
  const slide = pptx.addSlide();
  addBg(slide);

  if (data.layout === 'chapter') {
    slide.addText(data.chapterNum || '01', {
      x: 0.5, y: 2, w: 12, h: 1, fontSize: 52, bold: true, color: COLORS.cyan, align: 'center',
    });
    slide.addText(data.title, {
      x: 0.5, y: 3.1, w: 12, h: 0.9, fontSize: 32, bold: true, color: COLORS.white, align: 'center',
    });
    const sub = data.paragraphs[0] || '';
    if (sub) {
      slide.addText(sub, { x: 1, y: 4.1, w: 11, h: 0.8, fontSize: 14, color: COLORS.muted, align: 'center' });
    }
    return slide;
  }

  let y = addHeader(slide, data, 0.35);

  switch (data.layout) {
    case 'timeline':
      renderTimeline(slide, data, y);
      break;
    case 'flow':
      renderFlow(slide, data, y);
      if (data.paragraphs[0]) {
        slide.addText(data.paragraphs[0], {
          x: 0.5, y: y + 1.55, w: 12, h: 0.6, fontSize: 13, color: COLORS.cyan, bold: true, align: 'center',
        });
      }
      break;
    case 'two-col-chart': {
      let ly = y;
      data.h3Sections.forEach((sec) => {
        slide.addText(sec.title, { x: 0.5, y: ly, w: 5.8, h: 0.35, fontSize: 13, color: COLORS.white, bold: true });
        ly += 0.38;
        slide.addText(sec.items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
          x: 0.5, y: ly, w: 5.8, h: 1.2, fontSize: 10, color: COLORS.muted, valign: 'top',
        });
        ly += 1.25;
      });
      if (!data.h3Sections.length && data.bullets.length) {
        slide.addText(data.bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
          x: 0.5, y, w: 5.8, h: 4.5, fontSize: 10, color: COLORS.muted, valign: 'top',
        });
      }
      addChart(slide, pptx, 'marketChart', data, 6.6, y, 6, 3.5);
      slide.addText('India digital trading market growth projection (₹ Crore)', {
        x: 6.6, y: y + 3.55, w: 6, h: 0.3, fontSize: 8, color: '64748B', align: 'center',
      });
      break;
    }
    case 'chart-table': {
      addChart(slide, pptx, 'revenueChart', data, 0.5, y, 5.8, 3.4);
      if (data.tableRows.length) {
        slide.addTable(data.tableRows, {
          x: 6.5, y, w: 6.2,
          fontSize: 9, color: COLORS.muted,
          border: { type: 'solid', color: '1E293B', pt: 1 },
          fill: { color: COLORS.card },
          valign: 'middle',
        });
      }
      break;
    }
    case 'fund-chart': {
      addChart(slide, pptx, 'fundChart', data, 0.5, y, 5.5, 3.8);
      const legend = data.fundBullets.length ? data.fundBullets : data.bullets;
      if (legend.length) {
        slide.addText(legend.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
          x: 6.3, y: y + 0.2, w: 6.2, h: 3.5, fontSize: 12, color: COLORS.muted, valign: 'top',
        });
      }
      const stat = data.stats.find((s) => s.value);
      if (stat) {
        slide.addShape('roundRect', {
          x: 6.3, y: y + 3.0, w: 3, h: 1.2, rectRadius: 0.08,
          fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
        });
        slide.addText(stat.value, { x: 6.3, y: y + 3.1, w: 3, h: 0.5, fontSize: 22, bold: true, color: COLORS.cyan, align: 'center' });
        slide.addText(stat.label, { x: 6.35, y: y + 3.55, w: 2.9, h: 0.55, fontSize: 9, color: COLORS.muted, align: 'center' });
      }
      break;
    }
    case 'table':
      slide.addTable(data.tableRows, {
        x: 0.5, y, w: 12,
        fontSize: 10, color: COLORS.muted,
        border: { type: 'solid', color: '1E293B', pt: 1 },
        fill: { color: COLORS.card },
        valign: 'middle',
      });
      break;
    case 'two-col-lists': {
      const mid = Math.ceil(data.h3Sections.length / 2);
      let leftY = y;
      let rightY = y;
      data.h3Sections.forEach((sec, i) => {
        const isLeft = i < mid;
        const sx = isLeft ? 0.5 : 6.5;
        let sy = isLeft ? leftY : rightY;
        slide.addText(sec.title, { x: sx, y: sy, w: 5.8, h: 0.35, fontSize: 12, color: COLORS.white, bold: true });
        sy += 0.38;
        slide.addText(sec.items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
          x: sx, y: sy, w: 5.8, h: 2, fontSize: 10, color: COLORS.muted, valign: 'top',
        });
        sy += 2.1;
        if (isLeft) leftY = sy; else rightY = sy;
      });
      break;
    }
    case 'stats':
      addStatCards(slide, data.stats, 0.5, y, 12, data.stats.length);
      data.paragraphs.forEach((p, i) => {
        slide.addText(p, {
          x: 0.5, y: y + 1.85 + i * 0.55, w: 12, h: 0.5, fontSize: 12,
          color: /leverage|LTV|comparable/i.test(p) ? COLORS.emerald : COLORS.muted,
          bold: /leverage|LTV/i.test(p),
          align: /comparable/i.test(p) ? 'center' : 'left',
        });
      });
      break;
    case 'mixed': {
      addStatCards(slide, data.stats.slice(0, 2), 6.5, y, 6, 2);
      slide.addText(data.bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 0.5, y, w: 5.8, h: 4.8, fontSize: 11, color: COLORS.muted, valign: 'top',
      });
      break;
    }
    case 'bullets':
      slide.addText(data.bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 0.5, y, w: 12, h: 5.2, fontSize: 12, color: COLORS.muted, valign: 'top',
      });
      break;
    default:
      data.paragraphs.forEach((p, i) => {
        const gold = /solved|₹10|trusted|Press →/i.test(p);
        slide.addText(p, {
          x: 0.5, y: y + i * 0.65, w: 12, h: 0.6, fontSize: gold ? 14 : 13,
          color: gold ? COLORS.gold : COLORS.muted, bold: gold,
          align: /Press →|contact@/i.test(p) ? 'center' : 'left',
        });
      });
      if (data.stats.length) addStatCards(slide, data.stats, 0.5, y + 1.5, 12, 4);
  }

  return slide;
}

async function htmlToPptxBuffer(html) {
  const pptx = new pptxgen();
  pptx.author = 'XchangeByte';
  pptx.title = 'XchangeByte — Investor Presentation';
  pptx.subject = 'India Compliant Crypto & Forex Trading Platform';
  pptx.company = 'XchangeByte';
  pptx.layout = 'LAYOUT_WIDE';

  const sections = parseSections(html);
  const masterSections = loadMasterSections();

  if (!sections.length) {
    const slide = pptx.addSlide();
    addBg(slide);
    slide.addText('No slides found', { x: 1, y: 2, fontSize: 24, color: COLORS.white });
  } else {
    sections.forEach((section, i) => {
      const liveData = parseSlide(section);
      const data = mergeWithMaster(liveData, masterSections[i]);
      renderSlide(pptx, data);
    });
  }

  const base64 = await pptx.write({ outputType: 'base64' });
  return Buffer.from(base64, 'base64');
}

function auditSlides(html) {
  const sections = parseSections(html);
  const masterSections = loadMasterSections();
  return sections.map((section, i) => {
    const live = parseSlide(section);
    const d = mergeWithMaster(live, masterSections[i]);
    return {
      index: i + 1,
      title: d.title,
      layout: d.layout,
      stats: d.stats.length,
      bullets: d.bullets.length,
      timelines: d.timelines.length,
      flows: d.flows.length,
      charts: d.chartIds.length,
      tableRows: d.tableRows.length,
      paragraphs: d.paragraphs.length,
      timelineSample: d.timelines[0] || null,
      empty: isSlideDataEmpty(d),
      usedFallback: !!d.usedFallback,
    };
  });
}

export { htmlToPptxBuffer, parseSections, parseSlide, auditSlides };
