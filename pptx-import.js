/* Convert .pptx files into Reveal.js slide HTML (runs in the browser) */
(function () {
  const CANVAS_W = 1280;
  const CANVAS_H = 720;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emuToPx(value, slideEmu, canvasPx) {
    if (!slideEmu) return 0;
    return Math.round((Number(value) / slideEmu) * canvasPx);
  }

  function parseXml(xml) {
    return new DOMParser().parseFromString(xml, 'application/xml');
  }

  function getText(node, tag) {
    const el = node.getElementsByTagName(tag)[0];
    return el ? el.textContent : '';
  }

  function getAttr(node, attr) {
    return node.getAttribute(attr) || node.getAttribute(attr.split(':')[1]) || '';
  }

  function parseColor(fillNode) {
    if (!fillNode) return null;
    const solid = fillNode.getElementsByTagName('a:solidFill')[0]
      || fillNode.getElementsByTagName('solidFill')[0];
    if (!solid) return null;
    const srgb = solid.getElementsByTagName('a:srgbClr')[0]
      || solid.getElementsByTagName('srgbClr')[0];
    if (srgb) return '#' + getAttr(srgb, 'val');
    return null;
  }

  function parseSlideSize(presentationXml) {
    const doc = parseXml(presentationXml);
    const sldSz = doc.getElementsByTagName('p:sldSz')[0]
      || doc.getElementsByTagName('sldSz')[0];
    if (!sldSz) return { width: 12192000, height: 6858000 };
    const cx = getAttr(sldSz, 'cx') || '12192000';
    const cy = getAttr(sldSz, 'cy') || '6858000';
    return { width: Number(cx), height: Number(cy) };
  }

  function parseRels(relsXml) {
    const map = {};
    if (!relsXml) return map;
    const doc = parseXml(relsXml);
    const rels = doc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i];
      map[getAttr(rel, 'Id')] = getAttr(rel, 'Target');
    }
    return map;
  }

  function getXfrm(node) {
    const spPr = node.getElementsByTagName('p:spPr')[0]
      || node.getElementsByTagName('spPr')[0]
      || node.getElementsByTagName('p:grpSpPr')[0]
      || node.getElementsByTagName('grpSpPr')[0];
    if (!spPr) return null;
    const xfrm = spPr.getElementsByTagName('a:xfrm')[0]
      || spPr.getElementsByTagName('xfrm')[0];
    if (!xfrm) return null;
    const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
    const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
    if (!off || !ext) return null;
    return {
      x: getAttr(off, 'x') || '0',
      y: getAttr(off, 'y') || '0',
      cx: getAttr(ext, 'cx') || '0',
      cy: getAttr(ext, 'cy') || '0',
    };
  }

  function collectParagraphText(txBody) {
    const paragraphs = txBody.getElementsByTagName('a:p');
    const lines = [];
    for (let p = 0; p < paragraphs.length; p++) {
      const para = paragraphs[p];
      const runs = para.getElementsByTagName('a:r');
      let line = '';
      let fontSize = 18;
      let bold = false;
      let color = '#f8fafc';
      for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        const t = run.getElementsByTagName('a:t')[0];
        if (t && t.textContent) line += t.textContent;
        const rPr = run.getElementsByTagName('a:rPr')[0];
        if (rPr) {
          const sz = getAttr(rPr, 'sz');
          if (sz) fontSize = Math.round(Number(sz) / 100);
          if (getAttr(rPr, 'b') === '1') bold = true;
          const c = parseColor(rPr);
          if (c) color = c;
        }
      }
      if (line.trim()) lines.push({ text: line.trim(), fontSize, bold, color });
    }
    return lines;
  }

  function extractTextShapes(slideDoc) {
    const items = [];
    const shapes = slideDoc.getElementsByTagName('p:sp');
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      const txBody = shape.getElementsByTagName('p:txBody')[0]
        || shape.getElementsByTagName('txBody')[0];
      if (!txBody) continue;
      const xfrm = getXfrm(shape);
      if (!xfrm) continue;
      const lines = collectParagraphText(txBody);
      if (!lines.length) continue;
      items.push({ type: 'text', xfrm, lines });
    }
    return items;
  }

  async function blobToDataUrl(zip, target) {
    const normalized = target.replace(/^\.\.\//, 'ppt/');
    const file = zip.file(normalized) || zip.file(target.replace(/^\.\.\//, ''));
    if (!file) return null;
    const base64 = await file.async('base64');
    const ext = normalized.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : ext === 'svg' ? 'image/svg+xml'
      : 'application/octet-stream';
    return 'data:' + mime + ';base64,' + base64;
  }

  async function extractImages(slideDoc, rels, zip) {
    const items = [];
    const pics = slideDoc.getElementsByTagName('p:pic');
    for (let i = 0; i < pics.length; i++) {
      const pic = pics[i];
      const xfrm = getXfrm(pic);
      if (!xfrm) continue;
      const blip = pic.getElementsByTagName('a:blip')[0]
        || pic.getElementsByTagName('blip')[0];
      if (!blip) continue;
      const embed = getAttr(blip, 'r:embed') || getAttr(blip, 'embed');
      const target = rels[embed];
      if (!target) continue;
      const src = await blobToDataUrl(zip, target);
      if (!src) continue;
      items.push({ type: 'image', xfrm, src });
    }
    return items;
  }

  function parseBackground(slideDoc) {
    const bgPr = slideDoc.getElementsByTagName('p:bgPr')[0]
      || slideDoc.getElementsByTagName('bgPr')[0];
    return parseColor(bgPr) || '#030712';
  }

  function renderElement(item, slideSize) {
    const left = emuToPx(item.xfrm.x, slideSize.width, CANVAS_W);
    const top = emuToPx(item.xfrm.y, slideSize.height, CANVAS_H);
    const width = emuToPx(item.xfrm.cx, slideSize.width, CANVAS_W);
    const height = emuToPx(item.xfrm.cy, slideSize.height, CANVAS_H);
    const style = 'position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;';

    if (item.type === 'image') {
      return '<img class="imported-ppt-image" src="' + item.src + '" alt="" style="' + style + 'max-height:' + height + 'px;object-fit:contain;" draggable="false">';
    }

    const parts = item.lines.map((line) => {
      const tag = line.fontSize >= 32 ? 'h1' : line.fontSize >= 24 ? 'h2' : line.fontSize >= 18 ? 'h3' : 'p';
      const weight = line.bold ? 'font-weight:700;' : '';
      return '<' + tag + ' style="margin:0 0 0.35em;color:' + line.color + ';font-size:' + line.fontSize + 'px;' + weight + '">' + escapeHtml(line.text) + '</' + tag + '>';
    }).join('');
    return '<div class="imported-ppt-text" style="' + style + '">' + parts + '</div>';
  }

  function buildSectionHtml(elements, bgColor, slideSize) {
    const body = elements
      .sort((a, b) => Number(a.xfrm.y) - Number(b.xfrm.y))
      .map((el) => renderElement(el, slideSize))
      .join('\n');

    return (
      '<section class="imported-slide" data-background-color="' + bgColor + '">' +
      '<div class="slide-bg" style="background:' + bgColor + ';"></div>' +
      '<div class="slide-zoom-wrap">' +
      '<div class="imported-ppt-canvas" style="position:relative;width:' + CANVAS_W + 'px;min-height:' + CANVAS_H + 'px;margin:0 auto;">' +
      body +
      '</div></div></section>'
    );
  }

  async function convertPptx(arrayBuffer) {
    if (!window.JSZip) throw new Error('File reader not ready. Please refresh the page and try again.');

    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const slidePaths = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10));

    if (!slidePaths.length) throw new Error('No slides found in that file.');

    let presentationXml = '';
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) presentationXml = await presFile.async('string');
    const slideSize = parseSlideSize(presentationXml);

    let title = 'Imported Presentation';
    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
      const coreXml = await coreFile.async('string');
      const coreDoc = parseXml(coreXml);
      const titleNode = coreDoc.getElementsByTagName('dc:title')[0];
      if (titleNode && titleNode.textContent.trim()) title = titleNode.textContent.trim();
    }

    const sections = [];
    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideXml = await zip.file(slidePath).async('string');
      const slideDoc = parseXml(slideXml);
      const relsPath = slidePath.replace('slides/slide', 'slides/_rels/slide').replace('.xml', '.xml.rels');
      let rels = {};
      const relsFile = zip.file(relsPath);
      if (relsFile) rels = parseRels(await relsFile.async('string'));

      const bgColor = parseBackground(slideDoc);
      const texts = extractTextShapes(slideDoc);
      const images = await extractImages(slideDoc, rels, zip);
      const elements = texts.concat(images);

      const sectionHtml = buildSectionHtml(elements, bgColor, slideSize);
      sections.push(sectionHtml);
    }

    return {
      html: sections.join('\n'),
      slideCount: sections.length,
      title,
    };
  }

  window.__pptxImport = { convert: convertPptx };
})();
