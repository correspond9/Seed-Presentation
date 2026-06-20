/* Chart.js setup for presentation slides — safe to re-run after slide HTML reload */
(function () {
  const chartInstances = {};

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.08)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
  };

  function destroyCharts() {
    Object.keys(chartInstances).forEach((key) => {
      if (chartInstances[key]) {
        chartInstances[key].destroy();
        delete chartInstances[key];
      }
    });
  }

  function initPresentationCharts(force) {
    if (typeof Chart === 'undefined') return;

    const marketEl = document.getElementById('marketChart');
    const revenueEl = document.getElementById('revenueChart');
    const fundEl = document.getElementById('fundChart');

    if (!force) {
      const alreadyRendered = [marketEl, revenueEl, fundEl].some((el) => el && Chart.getChart(el));
      if (alreadyRendered) return;
    }

    destroyCharts();

    const marketEl = document.getElementById('marketChart');
    const revenueEl = document.getElementById('revenueChart');
    const fundEl = document.getElementById('fundChart');

    if (marketEl) {
      chartInstances.market = new Chart(marketEl, {
        type: 'line',
        data: {
          labels: ['2024', '2025', '2026', '2027', '2028'],
          datasets: [{
            label: 'India Digital Trading Market (₹ Cr)',
            data: [4500, 6200, 8900, 12800, 18500],
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: chartDefaults,
      });
    }

    if (revenueEl) {
      chartInstances.revenue = new Chart(revenueEl, {
        type: 'bar',
        data: {
          labels: ['Year 1', 'Year 2', 'Year 3'],
          datasets: [
            {
              label: 'Revenue (₹ Cr)',
              data: [6.2, 31, 96],
              backgroundColor: ['rgba(34,211,238,0.7)', 'rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)'],
              borderRadius: 8,
            },
            {
              label: 'EBITDA (₹ Cr)',
              data: [0.9, 10.9, 46],
              backgroundColor: ['rgba(16,185,129,0.5)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.8)'],
              borderRadius: 8,
            },
          ],
        },
        options: {
          ...chartDefaults,
          scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, beginAtZero: true } },
        },
      });
    }

    if (fundEl) {
      chartInstances.fund = new Chart(fundEl, {
        type: 'doughnut',
        data: {
          labels: ['Compliance 35%', 'Technology 30%', 'Marketing 20%', 'Banking 10%', 'Operations 5%'],
          datasets: [{
            data: [35, 30, 20, 10, 5],
            backgroundColor: ['#22d3ee', '#3b82f6', '#8b5cf6', '#10b981', '#fbbf24'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } },
        },
      });
    }
  }

  window.initPresentationCharts = initPresentationCharts;

  if (typeof Reveal !== 'undefined') {
    Reveal.on('ready', () => initPresentationCharts(false));
    Reveal.on('slidechanged', () => initPresentationCharts(false));
  }
})();
