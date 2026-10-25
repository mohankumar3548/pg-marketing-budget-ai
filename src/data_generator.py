"""Sample data for P&G: weekly media spend and revenue by channel (104 weeks)."""
from pathlib import Path

import numpy as np
import pandas as pd

CHANNELS = [
    # name, avg weekly spend ($K), carry-over decay, max weekly revenue effect ($K), half-saturation ($K), customer value index
    ("TV", 900, 0.7, 8400, 900, 1.00),
    ("Paid Search", 320, 0.2, 6400, 260, 1.15),
    ("Social Media", 420, 0.4, 3600, 300, 0.80),
    ("Retail Media", 360, 0.3, 7000, 420, 1.20),
    ("Influencers", 260, 0.5, 2000, 280, 0.70),
    ("Programmatic Display", 300, 0.3, 1400, 260, 0.65),
]


def generate(seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    weeks = 104
    rows, carry = [], np.zeros(len(CHANNELS))
    for w in range(weeks):
        season = 1 + 0.12 * np.sin(2 * np.pi * (w + 8) / 52) + (0.15 if w % 52 > 45 else 0)
        promo = 1.3 if w % 52 > 44 else 1.0
        spend = np.array([max(20, c[1] * (0.6 + 0.8 * rng.random()) * promo) for c in CHANNELS])
        revenue = 9000 * season + 6 * w
        for i, c in enumerate(CHANNELS):
            carry[i] = spend[i] + c[2] * carry[i]
            revenue += c[3] * carry[i] / (carry[i] + c[4])
        revenue += rng.normal(0, 260)
        row = {"week": w + 1, "season_index": round(season, 4), "revenue_k": round(revenue, 1),
               "conversions": int(revenue * 1000 / 38 * (0.95 + 0.1 * rng.random()))}
        for i, c in enumerate(CHANNELS):
            row[f"spend_{c[0].lower().replace(' ', '_')}_k"] = round(spend[i], 1)
        rows.append(row)
    channels = pd.DataFrame([{"channel": c[0], "customer_value_index": c[5]} for c in CHANNELS])
    return {"weekly_media": pd.DataFrame(rows), "channels": channels}


# ---------------------------------------------------------------------------
# Save and load helpers
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def save(data: dict, folder: Path = DATA_DIR) -> None:
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, df in data.items():
        df.to_csv(folder / f"{name}.csv", index=False)


def load_or_generate(folder: Path = DATA_DIR, seed: int = 42) -> dict:
    """Read the CSVs in data/ if they exist, otherwise generate fresh sample data."""
    folder = Path(folder)
    names = list(generate(seed).keys())
    if all((folder / f"{n}.csv").exists() for n in names):
        return {n: pd.read_csv(folder / f"{n}.csv") for n in names}
    return generate(seed)


if __name__ == "__main__":
    d = generate(42)
    save(d)
    for n, df in d.items():
        print(f"data/{n}.csv  {len(df):,} rows x {df.shape[1]} columns")
