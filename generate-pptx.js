/**
 * Generates XchangeByte Investor Pitch PowerPoint
 * Run: node generate-pptx.js
 */
const pptxgen = require('pptxgenjs');
const path = require('path');

const COLORS = {
  bg: '030712',
  cyan: '22D3EE',
  blue: '3B82F6',
  violet: '8B5CF6',
  emerald: '10B981',
  gold: 'FBBF24',
  white: 'F8FAFC',
  muted: '94A3B8',
  card: '0F172A',
};

const pptx = new pptxgen();
pptx.author = 'XchangeByte';
pptx.title = 'XchangeByte — Investor Presentation';
pptx.subject = 'India Compliant Crypto & Forex Trading Platform';
pptx.company = 'XchangeByte';
pptx.layout = 'LAYOUT_WIDE';

function addBg(slide) {
  slide.background = { color: COLORS.bg };
}

function addTitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.6, y: opts.y || 0.5, w: 12, h: 1,
    fontSize: opts.size || 32, bold: true, color: opts.color || COLORS.white,
    fontFace: 'Arial',
  });
}

function addEyebrow(slide, text, y = 0.35) {
  slide.addText(text, {
    x: 0.6, y, w: 8, h: 0.35,
    fontSize: 10, color: COLORS.cyan, bold: true, charSpacing: 3,
  });
}

function addBullets(slide, items, y = 1.5) {
  const rows = items.map(t => ({ text: t, options: { bullet: true, breakLine: true } }));
  slide.addText(rows, {
    x: 0.6, y, w: 11.5, h: 5,
    fontSize: 14, color: COLORS.muted, valign: 'top',
  });
}

function addStatCards(slide, stats, y = 2.2) {
  const w = 2.7;
  stats.forEach((s, i) => {
    const x = 0.6 + i * (w + 0.25);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h: 1.6, rectRadius: 0.1,
      fill: { color: COLORS.card }, line: { color: '1E293B', width: 1 },
    });
    slide.addText(s.value, { x, y: y + 0.2, w, h: 0.6, fontSize: 24, bold: true, color: COLORS.cyan, align: 'center' });
    slide.addText(s.label, { x: x + 0.1, y: y + 0.85, w: w - 0.2, h: 0.6, fontSize: 9, color: COLORS.muted, align: 'center' });
  });
}

// 1. Hook
let s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'THE UNTOLD STORY');
addTitle(s, 'Every day, millions of Indians want to trade crypto.', { size: 28 });
s.addText('But almost none can legally move money from their bank account into a trading platform — and back again.', {
  x: 0.6, y: 1.6, w: 11, h: 1, fontSize: 16, color: COLORS.muted,
});
s.addText('What if someone solved that first?', { x: 0.6, y: 3, w: 11, h: 0.6, fontSize: 18, color: COLORS.gold, bold: true });

// 2. Title
s = pptx.addSlide(); addBg(s);
s.addText('XchangeByte', { x: 0.6, y: 1.2, w: 12, h: 1.2, fontSize: 48, bold: true, color: COLORS.cyan });
s.addText("India's Compliant Crypto & Forex Trading Platform", { x: 0.6, y: 2.4, w: 11, h: 0.6, fontSize: 18, color: COLORS.muted });
addStatCards(s, [
  { value: '₹2.5T+', label: 'Global Crypto Market' },
  { value: '10 Cr+', label: 'Indian Crypto Users' },
  { value: '1st', label: 'Legal Bank Pay-In/Out' },
  { value: '₹10 Cr', label: 'Seed Round' },
], 3.5);

// 3. Problem
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 01 · THE PROBLEM');
addTitle(s, 'Indian traders face a broken money flow');
addBullets(s, [
  'Most global crypto brokers do NOT accept INR from Indian bank accounts',
  'Traders resort to risky P2P transfers — slow and legally grey',
  'Banks frequently freeze accounts linked to unofficial crypto flows',
  'No single platform offers crypto + forex with full Indian compliance',
  '~95% of Indian crypto traders cannot legally pay-in from whitelisted bank accounts',
]);

// 4. Solution flow
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'OUR UNIQUE ADVANTAGE');
addTitle(s, 'Legal bank pay-in & pay-out — our core USP');
addBullets(s, [
  '🏦 Indian Bank Account (Whitelisted) → 💳 Pay-In (UPI/NEFT/RTGS)',
  '→ 📈 Trade Crypto & Forex → 💰 Pay-Out back to same bank account',
  'XchangeByte will be one of the very few platforms to offer this',
  'Fully compliant with FIU-IND, PMLA, and all Indian regulations',
]);

// 5. Market
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 02 · MARKET OPPORTUNITY');
addTitle(s, 'The Crypto Opportunity');
addStatCards(s, [
  { value: '$2.2-2.5T', label: 'Global Market Cap' },
  { value: '$75-120B', label: 'Daily Volume' },
  { value: '9-12 Cr', label: 'Indian Crypto Users' },
  { value: 'Top 3', label: 'Global Adoption Rank' },
]);
s.addText('India has massive crypto demand but very few fully compliant platforms focused on trust and regulation.', {
  x: 0.6, y: 4.2, w: 11, h: 0.8, fontSize: 14, color: COLORS.muted,
});

// 6. Competitive
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'WHY WE WIN');
addTitle(s, 'Competitive advantage');
const compRows = [
  ['Feature', 'Global Brokers', 'Indian Exchanges', 'XchangeByte'],
  ['Legal INR bank pay-in', '✗ Rare', '✓ Some', '✓ YES'],
  ['Legal INR bank pay-out', '✗ Rare', '✓ Some', '✓ YES'],
  ['Crypto + Forex', '✓ Some', '✗ No', '✓ YES'],
  ['Whitelisted bank flow', '✗ Almost none', '✗ Limited', '✓ CORE USP'],
];
s.addTable(compRows, {
  x: 0.6, y: 1.5, w: 11.5, colW: [3, 2.5, 2.5, 2.5],
  fontSize: 11, color: COLORS.muted, border: { type: 'solid', color: '1E293B', pt: 1 },
  fill: { color: COLORS.card },
  align: 'left', valign: 'middle',
});

// 7. Compliance
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 04 · COMPLIANCE');
addTitle(s, 'Built for India\'s regulatory framework');
addBullets(s, [
  'FIU-IND Registration as Reporting Entity under PMLA',
  'AML/CFT policies, Principal Officer, Compliance Officer',
  'KYC: PAN, Aadhaar, address verification, risk profiling',
  'Transaction monitoring, STR filing, sanctions screening',
  '30% VDA tax compliance, 1% TDS, GST considerations',
  'Travel Rule compliance for cross-border transfers',
]);

// 8. Technology
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 05 · TECHNOLOGY');
addTitle(s, 'Platform architecture');
addBullets(s, [
  'High-performance matching engine (sub-millisecond latency)',
  'Multi-chain wallets: ERC-20, TRC-20, BEP-20',
  'Cold + hot wallet architecture (95%+ cold storage)',
  'Banking integration: UPI, NEFT, RTGS with reconciliation',
  'Real-time risk engine, trade surveillance, fraud monitoring',
  'Web app + iOS/Android mobile apps + API for advanced traders',
]);

// 9. Progress
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'DEVELOPMENT STATUS');
addTitle(s, 'Where we are today');
addBullets(s, [
  '✓ DONE: VPS secured, domain registered, architecture designed',
  '● IN PROGRESS: Web app, blockchain integration, wallet systems',
  '→ NEXT: Banking rails, FIU registration, payment gateway',
  'Q3 2026: Closed beta with 1,000 users',
  'Q4 2026: Public launch with mobile apps',
]);

// 10. Business Model
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 06 · REVENUE');
addTitle(s, 'Three revenue engines');
addStatCards(s, [
  { value: '60%', label: 'Brokerage Fees (0.10-0.25% per trade)' },
  { value: '25%', label: 'Spread Income (bid-ask)' },
  { value: '15%', label: 'Premium Subscriptions (₹499-1,999/mo)' },
]);
s.addText('High operating leverage — revenue grows faster than costs once platform is live.', {
  x: 0.6, y: 4.2, w: 11, h: 0.5, fontSize: 14, color: COLORS.emerald, bold: true,
});

// 11. Unit Economics
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'UNIT ECONOMICS');
addTitle(s, 'Every active trader is highly profitable');
addStatCards(s, [
  { value: '₹2.5L', label: 'Avg monthly volume/user' },
  { value: '₹375', label: 'Monthly revenue/user' },
  { value: '₹4,500', label: 'Annual revenue/user' },
  { value: '5.6x', label: 'LTV/CAC ratio' },
]);

// 12. Financials
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 07 · FINANCIAL PROJECTIONS');
addTitle(s, '3-year revenue projection (conservative)');
const finRows = [
  ['Metric', 'Year 1', 'Year 2', 'Year 3'],
  ['Registered Users', '25,000', '1,00,000', '3,00,000'],
  ['Active Traders', '8,000', '35,000', '1,00,000'],
  ['Annual Volume', '₹1,920 Cr', '₹12,600 Cr', '₹48,000 Cr'],
  ['Total Revenue', '₹6.2 Cr', '₹31 Cr', '₹96 Cr'],
  ['EBITDA', '₹0.9 Cr', '₹10.9 Cr', '₹46 Cr'],
];
s.addTable(finRows, {
  x: 0.6, y: 1.5, w: 11.5, colW: [3.5, 2.5, 2.5, 2.5],
  fontSize: 12, color: COLORS.muted, border: { type: 'solid', color: '1E293B', pt: 1 },
  fill: { color: COLORS.card },
});

// 13. Investor Returns
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'INVESTOR RETURNS');
addTitle(s, 'Path to strong returns in 24-36 months');
addStatCards(s, [
  { value: '8-12x', label: 'Revenue multiple by Year 3' },
  { value: '18-24mo', label: 'Break-even timeline' },
  { value: 'Series A', label: '₹300-500 Cr valuation target' },
  { value: 'IPO/M&A', label: 'Long-term exit path' },
]);

// 14. GTM
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'GO-TO-MARKET');
addTitle(s, 'How we acquire 100,000 users');
addBullets(s, [
  'Phase 1: Stealth beta — 1,000 hand-picked traders, referral-only',
  'Phase 2: Influencer partnerships — YouTube, Telegram, Twitter/X',
  'Phase 3: Paid acquisition — Google, Meta, app store optimization',
  'Phase 4: B2B — white-label API, affiliate program for financial advisors',
]);

// 15. Team
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 09 · TEAM');
addTitle(s, 'About us');
addBullets(s, [
  '10+ years in financial markets — equities, derivatives, commodities, digital assets',
  'SEBI-registered research professionals on leadership team',
  'Deep expertise in risk management, investment analysis, trading strategies',
  'Mission: Bridge conventional finance and digital assets for India',
]);

// 16. The Ask
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'CHAPTER 10 · THE ASK');
addTitle(s, 'Seed Round: ₹10 Crore', { color: COLORS.gold });
addBullets(s, [
  '35% — Licensing & Compliance (₹3.5 Cr)',
  '30% — Technology Development (₹3.0 Cr)',
  '20% — Marketing & User Acquisition (₹2.0 Cr)',
  '10% — Banking Integration (₹1.0 Cr)',
  '5% — Operations & Legal (₹0.5 Cr)',
  '18-month runway to public launch + 6 months operations',
]);

// 17. Milestones
s = pptx.addSlide(); addBg(s);
addEyebrow(s, 'MILESTONE MAP');
addTitle(s, '18-month execution plan');
addBullets(s, [
  'Month 1-3: FIU registration, company structuring, legal framework',
  'Month 4-6: Bank partnerships, payment gateway, whitelisting',
  'Month 7-9: Core exchange live, wallet integration, security audits',
  'Month 10-12: 1,000-user closed beta, mobile apps, forex module',
  'Month 13-18: Public launch, marketing push, 25K users target',
]);

// 18. CTA
s = pptx.addSlide(); addBg(s);
s.addText('XchangeByte', { x: 0.6, y: 1.5, w: 12, h: 1, fontSize: 44, bold: true, color: COLORS.cyan, align: 'center' });
s.addText("Let's Build India's Most Trusted Digital Asset Gateway", {
  x: 0.6, y: 2.5, w: 12, h: 0.6, fontSize: 18, color: COLORS.muted, align: 'center',
});
s.addText('Raising ₹10 Crore Seed Round', { x: 0.6, y: 3.5, w: 12, h: 0.6, fontSize: 22, color: COLORS.gold, bold: true, align: 'center' });
s.addText('contact@xchangebyte.com  |  www.xchangebyte.com', {
  x: 0.6, y: 4.5, w: 12, h: 0.5, fontSize: 14, color: COLORS.cyan, align: 'center',
});
s.addText('Confidential — For prospective investors only', {
  x: 0.6, y: 5.2, w: 12, h: 0.4, fontSize: 10, color: '64748B', align: 'center',
});

const outPath = path.join(__dirname, 'XchangeByte-Investor-Pitch.pptx');
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log('Created:', outPath);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
