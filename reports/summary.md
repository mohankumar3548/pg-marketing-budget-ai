# P&G Media Spend Optimizer: results

Built for Procter & Gamble. Prepared by K Mohan Kumar.

## Key figures

- **Annual spend:** $137.9M (6 channels)
- **Blended ROI:** 4.93x (Revenue per $ of media)
- **Inefficient spend:** $23.8M (Moved out of saturated channels)
- **Profit uplift:** +$32.6M (per year at +0% budget)

## Algorithm, as it ran

1. **Collect and align data**: 104 weeks x 6 channels, $275.8M total spend
2. **Adstock transform**: Decay: TV 0.7, Paid 0.2, Social 0.4, Retail 0.4, Influencers 0.7, Programmatic 0.7
3. **Marketing Mix Model**: R² = 0.970
4. **Saturation curves**: Half-saturation: TV $3.1M, Paid $397K, Social $673K, Retail $612K, Influencers $911K, Programmatic $1.1M
5. **ROI and marginal ROI**: Blended ROI 4.93x; lowest Influencers
6. **Profitability check**: Profit ROI below 1x: TV, Influencers
7. **Budget optimizer**: Weekly profit $3.1M -> $3.7M
8. **LLM memo**: Ready

## Recommended actions

1. **Cut Influencers by 50%.** Each extra dollar returns $0.00 of revenue (0.00x profit ROI after margin and customer value). It is past its saturation point. *Impact: -$7.1M/yr*
2. **Cut TV by 34%.** Each extra dollar returns $1.08 of revenue (0.90x profit ROI after margin and customer value). It is past its saturation point. *Impact: -$16.7M/yr*
3. **Scale Retail Media by 49%.** Marginal ROI of $5.61 per dollar and its response curve is still rising. *Impact: +$9.4M/yr*
4. **Scale Paid Search by 48%.** Marginal ROI of $5.00 per dollar and its response curve is still rising. *Impact: +$8.1M/yr*
5. **Scale Social Media by 19%.** Marginal ROI of $2.34 per dollar and its response curve is still rising. *Impact: +$4.2M/yr*
6. **Scale Programmatic Display by 13%.** Marginal ROI of $2.74 per dollar and its response curve is still rising. *Impact: +$2.1M/yr*
7. **Test before moving the full amount.** Run 6 to 8 week geo holdout tests on the two biggest changes and feed the measured lift back into the model. *Impact: 6-8 weeks*

_Generated from sample data. Figures are illustrative._
