"""Marketing Mix Model and budget optimizer for P&G.

Steps: adstock transform (grid search of carry-over decay per channel), Hill
saturation, regression of revenue on transformed spend, ROI and marginal ROI,
profit weighting by customer value, and a greedy budget reallocation.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from src.utils import bar, kpi, line, money, pct, rec, signed, table

META = json.loads(Path(__file__).with_name("meta.json").read_text())
PARAMS = [
    {"name": "budget_change", "label": "Total budget change (%)", "min": -30, "max": 30, "step": 5, "default": 0},
    {"name": "max_shift", "label": "Max shift per channel (%)", "min": 10, "max": 100, "step": 10, "default": 50},
]
MARGIN = 0.42
DECAYS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]


def adstock(x, d):
    out, a = np.zeros(len(x)), 0.0
    for i, v in enumerate(x):
        a = v + d * a
        out[i] = a
    return out


def hill(x, half):
    return x / (x + half)


def run(data, budget_change=0, max_shift=50):
    df, chans = data["weekly_media"], data["channels"]
    names = list(chans["channel"])
    cols = [f"spend_{n.lower().replace(' ', '_')}_k" for n in names]
    S = df[cols].to_numpy(float)
    y = df["revenue_k"].to_numpy(float)
    base_cols = df[["season_index", "week"]].to_numpy(float)
    k = len(names)
    half0 = np.median(S, axis=0)  # half-saturation at median weekly spend

    def features(decays):
        X = [hill(adstock(S[:, i], decays[i]), half0[i] / (1 - decays[i])) for i in range(k)]
        return np.column_stack([base_cols] + X)

    # 1) grid search decay per channel, two passes of coordinate descent
    dec = [0.4] * k
    for _ in range(2):
        for i in range(k):
            best = (-1, dec[i])
            for d in DECAYS:
                trial = dec.copy(); trial[i] = d
                r2 = LinearRegression(positive=True).fit(features(trial), y).score(features(trial), y)
                if r2 > best[0]:
                    best = (r2, d)
            dec[i] = best[1]
    X = features(dec)
    mdl = LinearRegression(positive=True).fit(X, y)
    r2 = mdl.score(X, y)
    beta = mdl.coef_[2:]
    half = half0 / (1 - np.array(dec))

    avg = S.mean(axis=0)
    resp = lambda i, s: beta[i] * hill(s / (1 - dec[i]), half[i])  # steady-state weekly revenue from spend s
    contrib = np.array([(X[:, 2 + i] * beta[i]).sum() for i in range(k)])
    roi = contrib / S.sum(axis=0)
    mroi = np.array([(resp(i, avg[i] * 1.01) - resp(i, avg[i])) / (avg[i] * 0.01) for i in range(k)])
    cv = chans["customer_value_index"].to_numpy(float)
    profit_roi = roi * MARGIN * cv

    # 2) greedy reallocation in 0.25% steps
    total = avg.sum() * (1 + budget_change / 100)
    lo, hi = avg * (1 - max_shift / 100), avg * (1 + max_shift / 100)
    alloc = lo * min(1, total / lo.sum()) if lo.sum() > 0 else lo.copy()
    step = total / 400
    while total - alloc.sum() > step / 2:
        gains = [(resp(i, alloc[i] + step) - resp(i, alloc[i])) * MARGIN * cv[i] if alloc[i] + step <= hi[i] else -np.inf for i in range(k)]
        j = int(np.argmax(gains))
        if gains[j] == -np.inf:
            break
        alloc[j] += step
    profit = lambda a: sum(resp(i, a[i]) * MARGIN * cv[i] - a[i] for i in range(k))
    uplift = (profit(alloc) - profit(avg)) * 52 * 1000
    delta = alloc / avg - 1
    moved = np.clip(avg * (1 + budget_change / 100) - alloc, 0, None).sum() * 52 * 1000

    sc = pd.DataFrame({
        "channel": names, "annual_spend": (avg * 52 * 1000).round(0), "attributed_revenue": (contrib / len(df) * 52 * 1000).round(0),
        "roi": roi.round(2), "marginal_roi": mroi.round(2), "profit_roi": profit_roi.round(2), "decay": dec,
        "current_share": (avg / avg.sum()).round(3), "recommended_share": (alloc / total).round(3), "change_pct": (delta * 100).round(0),
    }).sort_values("profit_roi", ascending=False)

    curve = pd.DataFrame({"spend_vs_today": [f"{int(m * 100)}%" for m in np.linspace(0, 2.2, 12)]})
    for i, n in enumerate(names):
        curve[n] = [resp(i, avg[i] * m) * 1000 for m in np.linspace(0, 2.2, 12)]

    recs = []
    for _, r in sc[sc.change_pct < -5].sort_values("change_pct").iterrows():
        recs.append(rec(f"Cut {r.channel} by {-r.change_pct:.0f}%", f"Each extra dollar returns ${r.marginal_roi:.2f} of revenue ({r.profit_roi:.2f}x profit ROI after margin and customer value). It is past its saturation point.", money(r.annual_spend * r.change_pct / 100) + "/yr"))
    for _, r in sc[sc.change_pct > 5].sort_values("change_pct", ascending=False).iterrows():
        recs.append(rec(f"Scale {r.channel} by {r.change_pct:.0f}%", f"Marginal ROI of ${r.marginal_roi:.2f} per dollar and its response curve is still rising.", "+" + money(r.annual_spend * r.change_pct / 100) + "/yr"))
    recs.append(rec("Test before moving the full amount", "Run 6 to 8 week geo holdout tests on the two biggest changes and feed the measured lift back into the model.", "6-8 weeks"))

    return {
        "steps": [
            f"{len(df)} weeks x {k} channels, {money(S.sum() * 1000)} total spend",
            "Decay: " + ", ".join(f"{n.split()[0]} {d}" for n, d in zip(names, dec)),
            f"R² = {r2:.3f}",
            "Half-saturation: " + ", ".join(f"{n.split()[0]} {money(h * 1000)}" for n, h in zip(names, half)),
            f"Blended ROI {contrib.sum() / S.sum():.2f}x; lowest {sc.iloc[-1].channel}",
            "Profit ROI below 1x: " + (", ".join(sc[sc.profit_roi < 1].channel) or "none"),
            f"Weekly profit {money(profit(avg) * 1000)} -> {money(profit(alloc) * 1000)}",
            "Ready",
        ],
        "kpis": [
            kpi("Annual spend", money(avg.sum() * 52 * 1000), f"{k} channels"),
            kpi("Blended ROI", f"{contrib.sum() / S.sum():.2f}x", "Revenue per $ of media"),
            kpi("Inefficient spend", money(moved), "Moved out of saturated channels"),
            kpi("Profit uplift", signed(uplift, money), f"per year at {budget_change:+d}% budget"),
        ],
        "charts": [
            bar("Profit ROI by channel", sc[["channel", "profit_roi"]], "channel", "profit_roi", "Revenue per $ x 42% margin x customer value. Below 1.0 loses money."),
            bar("Current vs recommended budget share", sc[["channel", "current_share", "recommended_share"]], "channel", ["current_share", "recommended_share"]),
            line("Saturation curves", curve, "spend_vs_today", names, "Weekly revenue each channel drives as spend rises from 0% to 220% of today."),
        ],
        "tables": [table("Channel scorecard", sc)],
        "recs": recs,
    }


if __name__ == "__main__":
    from src.data_generator import load_or_generate
    from src.report import write_reports

    out = run(load_or_generate(), **{p["name"]: p["default"] for p in PARAMS})
    for k in out["kpis"]:
        print(f"{k['label']}: {k['value']}  {k['note']}")
    print("Reports written to", write_reports(out, META, Path(__file__).resolve().parent.parent / "reports"))
