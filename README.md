# P&G Media Spend Optimizer

AI solution 01 of 14 · Marketing · built for **Procter & Gamble**

Prepared by **K Mohan Kumar**.

**Live website:** https://mohankumar3548.github.io/pg-marketing-budget-ai/

## Problem statement

A company is spending heavily across multiple marketing channels, but management cannot determine which campaigns generate profitable customers. Develop an AI-driven system that analyzes campaign, customer, conversion and revenue data to identify inefficient spending, estimate campaign effectiveness, and recommend how the marketing budget could be reallocated.

## Why Procter & Gamble

P&G spends billions a year across TV, digital, retail media and influencers, and it has publicly cut digital spend that was not driving sales. This tool finds which channels pay back and moves money to them.

## Project structure

```
pg-marketing-budget-ai/
├── index.html                 Website entry point (served by GitHub Pages)
├── frontend/
│   ├── css/style.css          Layout, typography, light and dark themes
│   └── js/
│       ├── engine.js          Maths, models, charts, page layout and AI analyst panel
│       └── model.js           Sample data and the algorithm for this problem (browser version)
├── app.py                     Streamlit dashboard (Python version of the website)
├── src/
│   ├── data_generator.py      Builds the sample dataset and saves it to data/
│   ├── model.py               The algorithm in Python (pandas, NumPy, scikit-learn)
│   ├── report.py              Writes results to reports/
│   ├── utils.py               Formatting and forecasting helpers
│   └── meta.json              Problem statement, company and algorithm steps
├── data/                      Sample data as CSV
├── reports/                   Results: results.json, summary.md and CSV tables
├── tests/test_model.py        pytest tests for the data and the model
├── requirements.txt
└── pytest.ini
```

## Algorithm

1. **Collect and align data**: Weekly spend, revenue, conversions and customer value per channel
2. **Adstock transform**: Grid search the carry-over decay for each channel
3. **Marketing Mix Model**: Regression of revenue on transformed spend, with seasonality
4. **Saturation curves**: Hill curve per channel to find diminishing returns
5. **ROI and marginal ROI**: Revenue per $ now, and for the next $
6. **Profitability check**: Weight ROI by the lifetime value of customers each channel brings
7. **Budget optimizer**: Greedy reallocation in 1% steps toward the highest marginal profit
8. **LLM memo**: AI analyst explains the plan below

The same algorithm is implemented twice: in JavaScript (`frontend/js/model.js`) so the website runs in any browser with no server, and in Python (`src/model.py`) for analysis, the Streamlit dashboard and the tests.

## How to run

**Website:** open the live link above, or open `index.html` in a browser.

**Python:**

```bash
pip install -r requirements.txt
python -m src.data_generator     # create the sample data in data/
python -m src.model              # run the algorithm and write reports/
streamlit run app.py             # open the interactive dashboard
pytest                           # run the tests
```

## Data

104 weeks of spend, revenue, conversions and customer value across 6 channels for one P&G category (sample data). Files: `data/channels.csv`, `data/weekly_media.csv`. All figures are illustrative and are not Procter & Gamble's actual numbers.

## Results (default settings, Python run)

| Measure | Value | Note |
|---|---|---|
| Annual spend | $137.9M | 6 channels |
| Blended ROI | 4.93x | Revenue per $ of media |
| Inefficient spend | $23.8M | Moved out of saturated channels |
| Profit uplift | +$32.6M | per year at +0% budget |

### Recommended actions

1. **Cut Influencers by 50%.** Each extra dollar returns $0.00 of revenue (0.00x profit ROI after margin and customer value). It is past its saturation point.
2. **Cut TV by 34%.** Each extra dollar returns $1.08 of revenue (0.90x profit ROI after margin and customer value). It is past its saturation point.
3. **Scale Retail Media by 49%.** Marginal ROI of $5.61 per dollar and its response curve is still rising.
4. **Scale Paid Search by 48%.** Marginal ROI of $5.00 per dollar and its response curve is still rising.
5. **Scale Social Media by 19%.** Marginal ROI of $2.34 per dollar and its response curve is still rising.

Full output: [`reports/summary.md`](reports/summary.md) and [`reports/results.json`](reports/results.json).

## AI analyst panel

The website includes an "Ask the AI analyst" panel that answers questions about the results through Claude. It works when the page is opened as a Claude artifact on claude.ai. On GitHub Pages the models, charts and controls run in full and the panel shows that it is unavailable.
