"""
freeze_demo_dataset.py — Reproducible demo dataset freeze for SANGAM.

Runs the synthetic data generator with FIXED seed=26027 so every restart of
the demo environment produces the exact same dataset.

Run inside Docker:
    docker compose exec backend python backend/scripts/freeze_demo_dataset.py

Run locally:
    python backend/scripts/freeze_demo_dataset.py
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.scripts.generate_synthetic_data import generate_synthetic_data
from backend.scripts.seed_departments import seed_departments

DEMO_SEED = 26027


def main():
    print("=" * 60)
    print("SANGAM — Demo Dataset Freeze")
    print(f"  Seed: {DEMO_SEED} (fixed, reproducible)")
    print("=" * 60)

    print("\n[1/2] Seeding departments (Engineering, TRD, S&T)...")
    seed_departments()

    print("\n[2/2] Generating synthetic dataset...")
    generate_synthetic_data(seed=DEMO_SEED)

    print("\n" + "=" * 60)
    print("Demo dataset frozen successfully.")
    print("The same data will be produced on every run with this seed.")
    print("=" * 60)


if __name__ == "__main__":
    main()
