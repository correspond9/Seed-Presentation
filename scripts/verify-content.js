fetch('https://seed-presentation.vercel.app/api/content?t=' + Date.now())
  .then((r) => r.json())
  .then((j) => {
    console.log('updatedAt', j.updatedAt);
    console.log('hasZoomWrap', j.html.includes('slide-zoom-wrap'));
    console.log('hasContentEditable', j.html.includes('contenteditable'));
    console.log('marketChartClean', j.html.includes('<canvas id="marketChart"></canvas>'));
    console.log('slideCount', (j.html.match(/<section/g) || []).length);
  });
