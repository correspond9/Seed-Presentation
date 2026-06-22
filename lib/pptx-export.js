import PptxGenJS from 'pptxgenjs';

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
    type: 'line',
    title: 'India Digital Trading Market (₹ Cr)',
    labels: ['2024', '2025', '2026', '2027', '2028'],
    series: [{ name: 'Market (₹ Cr)', values: [4500, 6200, 8900, 12800, 18500], color: '22D3EE' }],
  },
  revenueChart: {
    type: 'bar',
    labels: ['Year 1', 'Year 2', 'Year 3'],
    series: [
      { name: 'Revenue (₹ Cr)', values: [6.2, 31, 96], color: '22D3EE' },
      { name: 'EBITDA (₹ Cr)', values: [0.9, 10.9, 46], color: '10B981' },
    ],
  },
  fundChart: {
    type: 'doughnut',
    labels: ['Compliance 35%', 'Technology 30%', 'Marketing 20%', 'Banking 10%', 'Operations 5%'],
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
    html
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

function cleanBody(html) {
  return html
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<div class="slide-bg">[\s\S]*?<\/div>\s*(?=<div class="content-wrap"|<div class="chapter-number")/gi, '')
    .replace(/<div class="slide-zoom-wrap"[^>]*>/gi, '')
    .replace(/<\/div>\s*<\/section>/gi, '')
    .replace(/\sdata-[a-z-]+="[^"]*"/gi, '')
    .replace(/\scontenteditable="[^"]*"/gi, '')
    .replace(/\sspellcheck="[^"]*"/gi, '');
}

function getContentWrap(body, isChapter) {
  if (isChapter) return body;
  const m = body.match(/<div class="content-wrap"[^>]*>([\s\S]*)$/i);
  return m ? m[1] : body;
}

function extractStatCards(content) {
  const cards = [];
  const re = /<div class="stat-card[^"]*"[^>]*>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const openTag = m[0];
    const start = m.index;
    let depth = 1;
    let i = start + openTag.length;
    while (i < content.length && depth > 0) {
      const nextOpen = content.indexOf('<div', i);
      const nextClose = content.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        i = nextClose + 6;
      }
    }
    const cardHtml = content.slice(start, i);
    cards.push(cardHtml);
  }
  return cards;
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

function getFragmentStep(tagHtml, autoIndex) {
  if (!/class="[^"]*fragment/i.test(tagHtml)) return -1;
  const idx = tagHtml.match(/data-fragment-index="(\d+)"/i);
  if (idx) return parseInt(idx[1], 10);
  return autoIndex.counter++;
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

function parseFundLegend(body) {
  const items = matchAll(body, /<div[^>]*class="[^"]*fund-legend[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
  const block = items[0] || '';
  const lines = matchAll(block, /<div[^>]*>([\s\S]*?)<\/div>/gi).map(stripTags).filter(Boolean);
  const parsed = [];
  lines.forEach((line) => {
    const m = line.match(/(\d+)\s*%[^—\-]*[—\-]\s*(.+)/);
    if (m) parsed.push({ pct: parseInt(m[1], 10), label: m[2].trim() });
  });
  if (parsed.length >= 3) {
    return {
      labels: parsed.map((p) => `${p.label} (${p.pct}%)`),
      values: parsed.map((p) => p.pct),
      colors: ['22D3EE', '3B82F6', '8B5CF6', '10B981', 'FBBF24'].slice(0, parsed.length),
    };
  }
  return null;
}

function parseRevenueFromTable(rows) {
  if (!rows.length) return null;
  const header = rows[0];
  const yearCols = header.slice(1);
  let revRow = rows.find((r) => /revenue/i.test(r[0]) && !/ebitda/i.test(r[0]));
  let ebitdaRow = rows.find((r) => /^ebitda$/i.test(stripTags(r[0])));
  if (!revRow) return null;
  const parseNum = (s) => {
    const n = parseFloat(stripTags(s).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const revenue = revRow.slice(1).map(parseNum);
  const ebitda = ebitdaRow ? ebitdaRow.slice(1).map(parseNum) : null;
  return {
    labels: yearCols.map(stripTags),
    series: [
      { name: 'Revenue (₹ Cr)', values: revenue, color: '22D3EE' },
      ...(ebitda ? [{ name: 'EBITDA (₹ Cr)', values: ebitda, color: '10B981' }] : []),
    ],
  };
}

function parseSlide(section) {
  const body = cleanBody(section.body);
  const isChapter = /class="[^"]*chapter-slide/i.test(section.attrs);
  const content = getContentWrap(body, isChapter);
  const autoFrag = { counter: 0 };

  const eyebrowMatch = content.match(/<div class="eyebrow[^"]*"[^>]*>[\s\S]*?<\/div>/i);
  const h1Match = content.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  const h2Match = content.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);

  const eyebrow = stripTags(eyebrowMatch ? eyebrowMatch[0] : '');
  const h1 = stripTags(h1Match ? h1Match[0] : '');
  const h2 = stripTags(h2Match ? h2Match[0] : '');
  const chapterNum = stripTags(matchAll(content, /<div class="chapter-number"[^>]*>([\s\S]*?)<\/div>/i)[0] || '');

  const headerSteps = {
    eyebrow: eyebrowMatch ? getFragmentStep(eyebrowMatch[0], autoFrag) : -1,
    h1: h1Match ? getFragmentStep(h1Match[0], autoFrag) : -1,
    h2: h2Match ? getFragmentStep(h2Match[0], autoFrag) : -1,
  };

  const blocks = [];

  function pushBlock(type, data, tagHtml) {
    blocks.push({ type, data, step: getFragmentStep(tagHtml || '', autoFrag) });
  }

  matchAll(content, /<div class="fund-legend"[^>]*>([\s\S]*?)<\/div>/gi).forEach((legendHtml) => {
    matchAll(legendHtml, /<div[^>]*>([\s\S]*?)<\/div>/gi).forEach((lineHtml) => {
      const text = stripTags(lineHtml);
      if (text) pushBlock('bullet', { text }, lineHtml);
    });
  });

  extractStatCards(content).forEach((cardHtml) => {
    const value = stripTags(matchAll(cardHtml, /<div class="value[^"]*">([\s\S]*?)<\/div>/i)[0] || '');
    const label = stripTags(matchAll(cardHtml, /<div class="label[^"]*">([\s\S]*?)<\/div>/i)[0] || '');
    const title = stripTags(matchAll(cardHtml, /<h3[^>]*>([\s\S]*?)<\/h3>/i)[0] || '');
    const desc = stripTags(matchAll(cardHtml, /<p[^>]*>([\s\S]*?)<\/p>/i)[0] || '');
    if (value || label || title) {
      pushBlock('stat', { value, label, title, desc }, cardHtml);
    }
  });

  matchAll(content, /<li[^>]*>([\s\S]*?)<\/li>/gi).forEach((liHtml) => {
    pushBlock('bullet', { text: stripTags(liHtml) }, liHtml);
  });

  matchAll(content, /<div class="flow-node"[^>]*>([\s\S]*?)<\/div>/gi).forEach((nodeHtml) => {
    pushBlock('flow', { text: stripTags(nodeHtml) }, nodeHtml);
  });

  matchAll(content, /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi).forEach((itemHtml) => {
    pushBlock('timeline', {
      phase: stripTags(matchAll(itemHtml, /<div class="phase"[^>]*>([\s\S]*?)<\/div>/i)[0] || ''),
      title: stripTags(matchAll(itemHtml, /<div class="title"[^>]*>([\s\S]*?)<\/div>/i)[0] || ''),
      desc: stripTags(matchAll(itemHtml, /<div class="desc"[^>]*>([\s\S]*?)<\/div>/i)[0] || ''),
    }, itemHtml);
  });

  const tableMatch = content.match(/<table class="compare-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch) {
    pushBlock('table', { rows: extractTableRows(tableMatch[0]) }, tableMatch[0]);
  }

  matchAll(content, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).forEach((h3html) => {
    if (!/stat-card/.test(h3html)) {
      pushBlock('h3', { text: stripTags(h3html) }, h3html);
    }
  });

  matchAll(content, /<p[^>]*>([\s\S]*?)<\/p>/gi).forEach((pHtml) => {
    const text = stripTags(pHtml);
    if (!text || /chart-box|fund-legend/.test(pHtml)) return;
    if (/subtitle|contact|font-size:0\.7/i.test(pHtml)) return;
    pushBlock('paragraph', { text }, pHtml);
  });

  const chartIds = [];
  matchAll(content, /<canvas id="([^"]+)"/gi).forEach((id) => chartIds.push(id));

  const fundLegend = parseFundLegend(content);
  const tableRows = tableMatch ? extractTableRows(tableMatch[0]) : [];
  const revenueData = chartIds.includes('revenueChart') ? parseRevenueFromTable(tableRows) : null;

  const title = h1 || h2 || chapterNum || eyebrow || 'Slide';
  const subtitle = h1 && h2 ? h2 : '';

  const fragmentSteps = [
    headerSteps.eyebrow,
    headerSteps.h1,
    headerSteps.h2,
    ...blocks.map((b) => b.step),
  ].filter((s) => s >= 0);
  const maxStep = fragmentSteps.length ? Math.max(...fragmentSteps) : -1;

  return {
    isChapter,
    headerSteps,
    chapterNum,
    eyebrow,
    title,
    subtitle,
    blocks,
    maxStep,
    chartIds,
    fundLegend,
    revenueData,
    hasTwoCol: /class="two-col"/i.test(content),
  };
}

function addBg(slide) {
  slide.background = { color: COLORS.bg };
}

function addHeader(slide, data, yStart, visibleStep) {
  let y = yStart;
  const show = (step) => step < 0 || step <= visibleStep;

  if (data.eyebrow && show(data.headerSteps.eyebrow)) {
    slide.addText(data.eyebrow.toUpperCase(), {
      x: 0.5, y, w: 12, h: 0.3, fontSize: 9, color: COLORS.cyan, bold: true, charSpacing: 2,
    });
    y += 0.38;
  }
  if (data.title && show(data.headerSteps.h1 >= 0 ? data.headerSteps.h1 : data.headerSteps.h2)) {
    slide.addText(data.title, {
      x: 0.5, y, w: 12, h: 0.75, fontSize: data.title.length > 55 ? 22 : 26, bold: true, color: COLORS.white, valign: 'top',
    });
    y += 0.85;
  }
  if (data.subtitle && data.subtitle !== data.title && show(data.headerSteps.h2)) {
    slide.addText(data.subtitle, {
      x: 0.5, y, w: 12, h: 0.45, fontSize: 14, color: COLORS.muted,
    });
    y += 0.5;
  }
  return y;
}

function addStatCards(slide, stats, x, y, w, maxCount) {
  const count = Math.min(stats.length, maxCount || 4);
  if (!count) return y;
  const cardW = (w - (count - 1) * 0.15) / count;
  stats.slice(0, count).forEach((s, i) => {
    const cx = x + i * (cardW + 0.15);
    slide.addShape('roundRect', {
      x: cx, y, w: cardW, h: 1.35, rectRadius: 0.08,
      fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
    });
    const val = s.value || s.title || '';
    slide.addText(val, {
      x: cx, y: y + 0.1, w: cardW, h: 0.45, fontSize: val.length > 8 ? 16 : 22, bold: true,
      color: COLORS.cyan, align: 'center', fontFace: 'Arial',
    });
    const label = s.label || s.desc || '';
    if (label) {
      slide.addText(label, {
        x: cx + 0.05, y: y + 0.58, w: cardW - 0.1, h: 0.7, fontSize: 8, color: COLORS.muted, align: 'center', valign: 'top',
      });
    }
  });
  return y + 1.5;
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
    legendFontSize: 8,
  };

  if (chartId === 'marketChart') {
    const def = DEFAULT_CHARTS.marketChart;
    slide.addChart(pptx.charts.LINE, [{
      name: def.series[0].name,
      labels: def.labels,
      values: def.series[0].values,
    }], {
      ...chartOpts,
      chartColors: [COLORS.cyan],
      lineSize: 2,
      showValue: false,
    });
    return;
  }

  if (chartId === 'revenueChart') {
    const rev = data.revenueData || DEFAULT_CHARTS.revenueChart;
    const chartData = rev.series.map((s) => ({
      name: s.name,
      labels: rev.labels || DEFAULT_CHARTS.revenueChart.labels,
      values: s.values,
    }));
    slide.addChart(pptx.charts.BAR, chartData, {
      ...chartOpts,
      barDir: 'col',
      barGrouping: 'clustered',
      chartColors: rev.series.map((s) => COLORS[s.color.toLowerCase()] || s.color || COLORS.cyan),
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
    }], {
      ...chartOpts,
      chartColors: fund.colors,
      showPercent: true,
      showLegend: true,
      legendPos: 'r',
    });
  }
}

function renderBlocks(slide, pptx, data, visibleStep, layout) {
  const visible = data.blocks.filter((b) => b.step < 0 || b.step <= visibleStep);
  let y = layout.contentY;
  const leftX = layout.leftX || 0.5;
  const leftW = layout.leftW || 12;
  const rightX = layout.rightX || 6.4;
  const rightW = layout.rightW || 6.1;

  const stats = visible.filter((b) => b.type === 'stat').map((b) => b.data);
  const bullets = visible.filter((b) => b.type === 'bullet').map((b) => b.data.text);
  const flows = visible.filter((b) => b.type === 'flow').map((b) => b.data.text);
  const timelines = visible.filter((b) => b.type === 'timeline').map((b) => b.data);
  const tables = visible.filter((b) => b.type === 'table');
  const paragraphs = visible.filter((b) => b.type === 'paragraph').map((b) => b.data.text);
  const h3s = visible.filter((b) => b.type === 'h3').map((b) => b.data.text);

  const hasChart = data.chartIds.length > 0 && visibleStep >= 0;
  const chartOnRight = data.hasTwoCol && data.chartIds.length;

  if (stats.length && !chartOnRight) {
    y = addStatCards(slide, stats, leftX, y, leftW, 4);
  }

  if (flows.length) {
    const nodeW = 2.6;
    flows.slice(0, 4).forEach((text, i) => {
      const nx = leftX + i * (nodeW + 0.35);
      slide.addShape('roundRect', {
        x: nx, y, w: nodeW, h: 1.1, rectRadius: 0.08,
        fill: { color: COLORS.card }, line: { color: COLORS.cyan, width: 1 },
      });
      slide.addText(text, {
        x: nx + 0.05, y: y + 0.1, w: nodeW - 0.1, h: 0.9, fontSize: 9, color: COLORS.white, align: 'center', valign: 'middle',
      });
      if (i < flows.length - 1) {
        slide.addText('→', { x: nx + nodeW, y: y + 0.35, w: 0.35, h: 0.4, fontSize: 14, color: COLORS.cyan, align: 'center' });
      }
    });
    y += 1.25;
  }

  if (timelines.length) {
    const tw = 2.2;
    timelines.slice(0, 5).forEach((t, i) => {
      const tx = leftX + i * (tw + 0.12);
      slide.addShape('roundRect', {
        x: tx, y, w: tw, h: 1.5, rectRadius: 0.06,
        fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
      });
      slide.addText(t.phase, { x: tx + 0.05, y: y + 0.08, w: tw - 0.1, h: 0.25, fontSize: 7, color: COLORS.cyan, bold: true });
      slide.addText(t.title, { x: tx + 0.05, y: y + 0.32, w: tw - 0.1, h: 0.35, fontSize: 9, color: COLORS.white, bold: true });
      slide.addText(t.desc, { x: tx + 0.05, y: y + 0.65, w: tw - 0.1, h: 0.75, fontSize: 7, color: COLORS.muted, valign: 'top' });
    });
    y += 1.65;
  }

  if (chartOnRight) {
    const listBullets = bullets.slice(0, 10);
    if (listBullets.length) {
      slide.addText(listBullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: leftX, y, w: 5.6, h: 4.5, fontSize: 11, color: COLORS.muted, valign: 'top',
      });
    }
    if (h3s.length) {
      let hy = y;
      h3s.forEach((h) => {
        slide.addText(h, { x: leftX, y: hy, w: 5.6, h: 0.3, fontSize: 12, color: COLORS.white, bold: true });
        hy += 0.35;
      });
    }
    data.chartIds.forEach((id) => {
      addChart(slide, pptx, id, data, rightX, layout.contentY, rightW, 3.4);
    });
    slide.addText('India digital trading market growth projection (₹ Crore)', {
      x: rightX, y: layout.contentY + 3.5, w: rightW, h: 0.3, fontSize: 8, color: '64748B', align: 'center',
    });
    return;
  }

  if (tables.length) {
    const rows = tables[tables.length - 1].data.rows;
    if (rows.length) {
      slide.addTable(rows, {
        x: leftX, y, w: leftW,
        fontSize: 9, color: COLORS.muted,
        border: { type: 'solid', color: '1E293B', pt: 1 },
        fill: { color: COLORS.card },
        valign: 'middle',
        autoPage: false,
      });
      if (data.chartIds.includes('revenueChart')) {
        addChart(slide, pptx, 'revenueChart', data, 0.5, 1.2, 5.5, 3.2);
      }
      return;
    }
  }

  if (stats.length) {
    y = addStatCards(slide, stats, leftX, y, leftW, 4);
  }

  if (data.chartIds.includes('fundChart') && visible.some((b) => b.type === 'table' || b.step >= 0)) {
    addChart(slide, pptx, 'fundChart', data, 0.5, y, 5, 3.5);
    const legend = visible.filter((b) => b.type === 'bullet').map((b) => b.data.text);
    if (legend.length) {
      slide.addText(legend.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 6, y: y + 0.2, w: 6.5, h: 3.2, fontSize: 11, color: COLORS.muted, valign: 'top',
      });
    }
    return;
  }

  if (bullets.length) {
    slide.addText(bullets.slice(0, 14).map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
      x: leftX, y, w: leftW, h: 5.5 - y, fontSize: 11, color: COLORS.muted, valign: 'top',
    });
  } else if (paragraphs.length) {
    paragraphs.forEach((p) => {
      const isGold = /solved|₹10|trusted|LTV/i.test(p);
      slide.addText(p, {
        x: leftX, y, w: leftW, h: 0.55, fontSize: isGold ? 13 : 12,
        color: isGold ? COLORS.gold : COLORS.muted, bold: isGold,
      });
      y += 0.6;
    });
  }
}

function renderChapterSlide(slide, data) {
  addBg(slide);
  slide.addText(data.chapterNum || '01', {
    x: 0.5, y: 2, w: 12, h: 1, fontSize: 52, bold: true, color: COLORS.cyan, align: 'center',
  });
  slide.addText(data.title, {
    x: 0.5, y: 3.1, w: 12, h: 0.9, fontSize: 32, bold: true, color: COLORS.white, align: 'center',
  });
  const sub = data.blocks.find((b) => b.type === 'paragraph');
  if (sub) {
    slide.addText(sub.data.text, {
      x: 1.2, y: 4.1, w: 10.5, h: 0.7, fontSize: 13, color: COLORS.muted, align: 'center',
    });
  }
}

function renderSlideBuild(pptx, data, visibleStep, slideIndex) {
  const slide = pptx.addSlide();
  addBg(slide);
  if (data.isChapter) {
    renderChapterSlide(slide, data);
    return;
  }

  const contentY = addHeader(slide, data, 0.35, visibleStep);
  renderBlocks(slide, pptx, data, visibleStep, { contentY });

  if (data.maxStep >= 0 && visibleStep < data.maxStep) {
    slide.addNotes(`Build step ${visibleStep + 1} of ${data.maxStep + 1} — press → for next reveal`);
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
    addBg(slide);
    slide.addText('No slides found', { x: 1, y: 2, fontSize: 24, color: COLORS.white });
  } else {
    sections.forEach((section) => {
      const data = parseSlide(section);
      if (data.isChapter || data.maxStep < 0) {
        renderSlideBuild(pptx, data, data.maxStep, 0);
      } else {
        for (let step = -1; step <= data.maxStep; step++) {
          renderSlideBuild(pptx, data, step, step);
        }
      }
    });
  }

  const base64 = await pptx.write({ outputType: 'base64' });
  return Buffer.from(base64, 'base64');
}

export { htmlToPptxBuffer, parseSections, parseSlide };
