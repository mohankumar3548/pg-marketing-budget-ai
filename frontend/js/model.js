/* P&G Media Spend Optimizer: sample data generator and algorithm for Procter & Gamble. */
const TOOL = {
  num: 1, area: "Marketing", product: "Budget Optimizer", seed: 21,
  title: "P&G Media Spend Optimizer", company: "Procter & Gamble",
  why: "P&G spends billions a year across TV, digital, retail media and influencers, and it has publicly cut digital spend that was not driving sales. This tool finds which channels pay back and moves money to them.",
  statement: "A company is spending heavily across multiple marketing channels, but management cannot determine which campaigns generate profitable customers. Develop an AI-driven system that analyzes campaign, customer, conversion and revenue data to identify inefficient spending, estimate campaign effectiveness, and recommend how the marketing budget could be reallocated.",
  dataNote: "104 weeks of spend, revenue, conversions and customer value across 6 channels for one P&G category (sample data).",
  steps: [
    ["Collect and align data", "Weekly spend, revenue, conversions and customer value per channel"],
    ["Adstock transform", "Grid search the carry-over decay for each channel"],
    ["Marketing Mix Model", "Regression of revenue on transformed spend, with seasonality"],
    ["Saturation curves", "Hill curve per channel to find diminishing returns"],
    ["ROI and marginal ROI", "Revenue per $ now, and for the next $"],
    ["Profitability check", "Weight ROI by the lifetime value of customers each channel brings"],
    ["Budget optimizer", "Greedy reallocation in 1% steps toward the highest marginal profit"],
    ["LLM memo", "AI analyst explains the plan below"]
  ],
  params: [
    { id: "budget", label: "Total budget change", min: -30, max: 30, step: 5, value: 0, fmt: v => (v > 0 ? "+" : "") + v + "%" },
    { id: "cap", label: "Max shift per channel", min: 10, max: 100, step: 10, value: 50, fmt: v => "±" + v + "%" }
  ],
  questions: ["Which channel is wasting the most money?", "Why should we cut TV if its ROI looks fine?", "What happens if we cut the budget by 20%?", "How confident should we be in this model?"],
  generate(r) {
    const ch = [
      { name: "TV", base: 900, decay: 0.7, beta: 2.1e3, half: 900, clv: 1.0 },
      { name: "Paid Search", base: 320, decay: 0.2, beta: 1.6e3, half: 260, clv: 1.15 },
      { name: "Social Media", base: 420, decay: 0.4, beta: 0.9e3, half: 300, clv: 0.8 },
      { name: "Retail Media", base: 360, decay: 0.3, beta: 1.75e3, half: 420, clv: 1.2 },
      { name: "Influencers", base: 260, decay: 0.5, beta: 0.5e3, half: 280, clv: 0.7 },
      { name: "Programmatic Display", base: 300, decay: 0.3, beta: 0.35e3, half: 260, clv: 0.65 }
    ];
    const W = 104, weeks = [];
    const ad = ch.map(() => 0);
    for (let w = 0; w < W; w++) {
      const season = 1 + 0.12 * Math.sin(2 * Math.PI * (w + 8) / 52) + (w % 52 > 45 ? 0.15 : 0);
      const spend = ch.map(c => Math.max(20, c.base * (0.6 + 0.8 * r()) * (w % 52 > 44 ? 1.3 : 1)));
      let rev = 9000 * season + w * 6;
      ch.forEach((c, i) => { ad[i] = spend[i] + c.decay * ad[i]; rev += c.beta * ad[i] / (ad[i] + c.half) * 4; });
      rev += r.n(0, 260);
      const conv = Math.round(rev * 1000 / 38 * (0.95 + 0.1 * r()));
      weeks.push({ w, spend, rev, conv, season });
    }
    return { ch, weeks };
  },
  analyze(D, P, r) {
    const ch = D.ch, n = D.weeks.length, k = ch.length; const decays = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const adstock = (x, d) => { let a = 0; return x.map(v => a = v + d * a); };
    const hill = (x, h) => x / (x + h);
    const spendCol = i => D.weeks.map(w => w.spend[i]);
    const y = D.weeks.map(w => w.rev), season = D.weeks.map(w => w.season), trend = D.weeks.map(w => w.w);
    // grid search decay per channel (coordinate descent)
    const dec = ch.map(() => 0.4);
    const halfs = ch.map((_, i) => S.quantile(spendCol(i), 0.5) / (1 - 0.4));
    const build = d => D.weeks.map((_, t) => [season[t], trend[t], ...ch.map((_, i) => hill(adstock(spendCol(i), d[i])[t], halfs[i] * (1 - 0.4) / (1 - d[i])))]);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < k; i++) { let best = -1, bd = dec[i]; for (const d of decays) { const dd = dec.slice(); dd[i] = d; const m = M.ols(build(dd), y, 1e-4); if (m.r2 > best) { best = m.r2; bd = d; } } dec[i] = bd; }
    const X = build(dec), model = M.ols(X, y, 1e-4);
    const H = i => halfs[i] * (1 - 0.4) / (1 - dec[i]);
    const b = i => model.beta[3 + i];
    // weekly response at average spend (steady state adstock = s/(1-d))
    const avgS = ch.map((_, i) => S.mean(spendCol(i)));
    const resp = (i, s) => Math.max(0, b(i)) * hill(s / (1 - dec[i]), H(i));
    const contrib = ch.map((_, i) => S.sum(X.map(row => row[2 + i] * Math.max(0, b(i)))));
    const spendTot = ch.map((_, i) => S.sum(spendCol(i)));
    const roi = ch.map((_, i) => contrib[i] / spendTot[i]);
    const mroi = ch.map((_, i) => (resp(i, avgS[i] * 1.01) - resp(i, avgS[i])) / (avgS[i] * 0.01));
    const margin = 0.42; // gross margin
    const pw = ch.map(c => c.clv); // value of customers acquired, relative
    const profRoi = ch.map((_, i) => roi[i] * margin * pw[i]);
    // optimizer: greedy in 1% steps of total
    const total = S.sum(avgS) * (1 + P.budget / 100), cap = P.cap / 100;
    const lo = avgS.map(s => s * (1 - cap)), hi = avgS.map(s => s * (1 + cap));
    let alloc = lo.slice(); if (S.sum(alloc) > total) alloc = alloc.map(a => a * total / S.sum(lo));
    let left = total - S.sum(alloc); const stp = total / 400; let guard = 0;
    while (left > stp * 0.5 && guard++ < 2000) { let bi = -1, bv = -Infinity; for (let i = 0; i < k; i++) { if (alloc[i] + stp > hi[i]) continue; const g = (resp(i, alloc[i] + stp) - resp(i, alloc[i])) * margin * pw[i]; if (g > bv) { bv = g; bi = i; } } if (bi < 0) break; alloc[bi] += stp; left -= stp; }
    if (left > 0) { const room = alloc.map((a, i) => hi[i] - a); const tr = S.sum(room); alloc = alloc.map((a, i) => a + left * room[i] / (tr || 1)); }
    const wkRev = a => S.sum(a.map((s, i) => resp(i, s)));
    const curRev = wkRev(avgS), newRev = wkRev(alloc), curProfit = S.sum(avgS.map((s, i) => resp(i, s) * margin * pw[i] - s)), newProfit = S.sum(alloc.map((s, i) => resp(i, s) * margin * pw[i] - s));
    const K = 1000, yr = 52;
    const order = S.range(k).sort((a, b2) => profRoi[a] - profRoi[b2]);
    const waste = S.sum(alloc.map((a, i) => Math.max(0, avgS[i] * (1 + P.budget / 100) - a))) * yr * K;
    const rows = S.range(k).map(i => ({ i, name: ch[i].name, spend: avgS[i] * yr * K, rev: contrib[i] / n * yr * K, roi: roi[i], m: mroi[i], p: profRoi[i], cur: avgS[i] / S.sum(avgS), rec: alloc[i] / total, delta: alloc[i] / avgS[i] - 1 }));
    const sorted = [...rows].sort((a, b2) => b2.p - a.p);
    const tone = v => v >= 1 ? "good" : v >= 0.7 ? "warn" : "bad";
    const recs = [];
    const cuts = rows.filter(x => x.delta < -0.05).sort((a, b2) => a.delta - b2.delta), adds = rows.filter(x => x.delta > 0.05).sort((a, b2) => b2.delta - a.delta);
    cuts.forEach(x => recs.push({ title: `Cut ${x.name} by ${Math.round(-x.delta * 100)}%`, body: `Each extra dollar here returns only ${F.money(x.m, "$", 2)} of revenue (${F.x(x.p)} profit ROI after margin and customer value). It sits past its saturation point, so the cut costs little sales.`, impact: F.money(x.spend * x.delta, "$") + "/yr", tone: "bad" }));
    adds.forEach(x => recs.push({ title: `Scale ${x.name} by ${Math.round(x.delta * 100)}%`, body: `Marginal ROI of ${F.money(x.m, "$", 2)} per dollar and customers with ${x.i === 3 || x.i === 1 ? "above" : "average"} lifetime value. The curve is still rising at current spend.`, impact: "+" + F.money(x.spend * x.delta, "$") + "/yr", tone: "good" }));
    recs.push({ title: "Test before you move the full amount", body: "Run geo holdout tests on the two channels with the largest change for 6 to 8 weeks. Feed the measured lift back into the model as a prior before the next planning cycle.", impact: "6-8 weeks", tone: "" });
    return {
      steps: [
        `${n} weeks × ${k} channels, ${F.money(S.sum(spendTot) * K)} total spend`,
        "Decay: " + ch.map((c, i) => c.name.split(" ")[0] + " " + dec[i]).join(", "),
        `R² = ${model.r2.toFixed(3)} on ${n} weeks`,
        "Half-saturation: " + ch.map((c, i) => c.name.split(" ")[0] + " " + F.money(H(i) * K)).join(", ") + "/wk",
        `Blended ROI ${F.x(S.sum(contrib) / S.sum(spendTot))}; lowest ${sorted[k - 1].name}`,
        `Profit ROI below 1x: ${rows.filter(x => x.p < 1).map(x => x.name).join(", ") || "none"}`,
        `Weekly profit ${F.money(curProfit * K)} → ${F.money(newProfit * K)}`,
        "Ready"
      ],
      kpis: [
        { label: "Annual spend", value: F.money(S.sum(avgS) * yr * K), note: "6 channels" },
        { label: "Blended ROI", value: F.x(S.sum(contrib) / S.sum(spendTot)), note: "Revenue per $ of media" },
        { label: "Inefficient spend", value: F.money(waste), note: "Money the optimizer moves out of saturated channels", tone: "bad" },
        { label: "Profit uplift", value: F.sgn((newProfit - curProfit) * yr * K, v => F.money(v)), note: `per year at ${P.budget >= 0 ? "+" : ""}${P.budget}% budget`, tone: newProfit >= curProfit ? "good" : "bad" }
      ],
      sections: [
        { pair: [
          { title: "Profit ROI by channel", note: "Revenue per dollar × 42% margin × customer value. The dashed line is break-even.", chart: C.bar(sorted.map(x => ({ label: x.name, value: x.p, tone: tone(x.p) })), { fmt: v => F.x(v, 1), ref: 1 }) },
          { title: "Current vs recommended split", note: "Share of the total budget after the optimizer runs.", chart: C.grouped(rows.map(x => x.name), [{ name: "Current", values: rows.map(x => x.cur), tone: "c2" }, { name: "Recommended", values: rows.map(x => x.rec), tone: "c1" }], { fmt: v => F.pct(v, 0) }) + C.legend([{ label: "Current", tone: "c2" }, { label: "Recommended", tone: "c1" }]) }
        ] },
        { title: "Saturation curves", note: "Weekly revenue each channel drives as spend rises. Dots mark current average spend. Flat curves mean extra money buys little.", chart: (() => { const xs = S.range(25).map(j => j / 24 * 2.2); const lbl = xs.map(x => F.pct(x, 0)); return C.line(lbl, S.range(k).map(i => ({ name: ch[i].name, values: xs.map(x => resp(i, avgS[i] * x) * K), tone: "c" + (i + 1) })), { fmt: v => F.money(v), every: 4 }) + C.legend(ch.map((c, i) => ({ label: c.name, tone: "c" + (i + 1) }))) + `<p class="small">X axis: spend as % of today's average weekly spend.</p>`; })() },
        { title: "Channel scorecard", html: T.table(["Channel", "Annual spend", "Attributed revenue", "ROI", "Marginal ROI", "Profit ROI", "Change"], sorted.map(x => [x.name, F.money(x.spend), F.money(x.rev), F.x(x.roi), F.money(x.m, "$", 2), T.pill(F.x(x.p), tone(x.p)), T.pill((x.delta > 0 ? "+" : "") + Math.round(x.delta * 100) + "%", x.delta > 0.05 ? "good" : x.delta < -0.05 ? "bad" : "mut")]), { right: [1, 2, 3, 4] }) }
      ],
      recs,
      context: { model_r2: model.r2, gross_margin: margin, channels: rows.map(x => ({ channel: x.name, annual_spend: Math.round(x.spend), attributed_revenue: Math.round(x.rev), roi: +x.roi.toFixed(2), marginal_roi: +x.m.toFixed(2), profit_roi: +x.p.toFixed(2), current_share: +x.cur.toFixed(3), recommended_share: +x.rec.toFixed(3), recommended_change_pct: Math.round(x.delta * 100) })), weekly_revenue_current: Math.round(curRev * K), weekly_revenue_after: Math.round(newRev * K), annual_profit_change: Math.round((newProfit - curProfit) * yr * K) }
    };
  }
};
