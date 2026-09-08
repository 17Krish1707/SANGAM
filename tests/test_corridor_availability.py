from datetime import datetime, timedelta
from backend.services.corridor_availability import compute_candidate_windows, compute_window_risk_score


class MockTrain:
    def __init__(self, entry_time, exit_time, train_type="Passenger", forecast_confidence=1.0):
        self.entry_time = entry_time
        self.exit_time = exit_time
        self.train_type = train_type
        self.forecast_confidence = forecast_confidence


def test_compute_candidate_windows_hand_constructed():
    # Day range: 08:00 to 16:00
    start_date = datetime(2026, 9, 7, 8, 0, 0)
    end_date = datetime(2026, 9, 7, 16, 0, 0)

    # 3 trains with known gaps
    trains = [
        MockTrain(
            entry_time=datetime(2026, 9, 7, 9, 0, 0),
            exit_time=datetime(2026, 9, 7, 9, 30, 0),
            train_type="Passenger",
        ),
        MockTrain(
            entry_time=datetime(2026, 9, 7, 11, 0, 0),
            exit_time=datetime(2026, 9, 7, 11, 30, 0),
            train_type="Passenger",
        ),
        MockTrain(
            entry_time=datetime(2026, 9, 7, 13, 30, 0),
            exit_time=datetime(2026, 9, 7, 14, 0, 0),
            train_type="Passenger",
        ),
    ]

    windows = compute_candidate_windows(
        db=None,
        section_id="sec-test-01",
        start_date=start_date,
        end_date=end_date,
        min_buffer_minutes=10,
        train_movements=trains,
    )

    # We expect 4 candidate windows:
    # 1. 08:10 to 08:50 -> 40 min
    # 2. 09:40 to 10:50 -> 70 min
    # 3. 11:40 to 13:20 -> 100 min
    # 4. 14:10 to 15:50 -> 100 min
    assert len(windows) == 4

    assert windows[0]["window_start"] == datetime(2026, 9, 7, 8, 10, 0)
    assert windows[0]["window_end"] == datetime(2026, 9, 7, 8, 50, 0)
    assert windows[0]["duration_min"] == 40

    assert windows[1]["window_start"] == datetime(2026, 9, 7, 9, 40, 0)
    assert windows[1]["window_end"] == datetime(2026, 9, 7, 10, 50, 0)
    assert windows[1]["duration_min"] == 70

    assert windows[2]["window_start"] == datetime(2026, 9, 7, 11, 40, 0)
    assert windows[2]["window_end"] == datetime(2026, 9, 7, 13, 20, 0)
    assert windows[2]["duration_min"] == 100

    assert windows[3]["window_start"] == datetime(2026, 9, 7, 14, 10, 0)
    assert windows[3]["window_end"] == datetime(2026, 9, 7, 15, 50, 0)
    assert windows[3]["duration_min"] == 100


def test_short_gaps_are_discarded():
    start_date = datetime(2026, 9, 7, 8, 0, 0)
    end_date = datetime(2026, 9, 7, 10, 0, 0)

    # Train gap is only 30 minutes total (from 08:30 to 09:00).
    # With 10 min buffer on both sides, usable window would be 10 minutes (< 20 min threshold).
    trains = [
        MockTrain(datetime(2026, 9, 7, 8, 0, 0), datetime(2026, 9, 7, 8, 30, 0)),
        MockTrain(datetime(2026, 9, 7, 9, 0, 0), datetime(2026, 9, 7, 10, 0, 0)),
    ]

    windows = compute_candidate_windows(
        db=None,
        section_id="sec-test-02",
        start_date=start_date,
        end_date=end_date,
        min_buffer_minutes=10,
        train_movements=trains,
    )

    # The 10-minute net gap is discarded, no windows should be returned
    assert len(windows) == 0


def test_window_risk_score_calculation():
    # Window overlapping peak hours (06:00 - 10:00) with nearby goods train
    window = {
        "window_start": datetime(2026, 9, 7, 8, 0, 0),
        "window_end": datetime(2026, 9, 7, 9, 0, 0),
    }

    trains = [
        MockTrain(datetime(2026, 9, 7, 7, 30, 0), datetime(2026, 9, 7, 7, 50, 0), train_type="Passenger"),
        MockTrain(datetime(2026, 9, 7, 9, 10, 0), datetime(2026, 9, 7, 9, 45, 0), train_type="Goods", forecast_confidence=0.7),
    ]

    score = compute_window_risk_score(db=None, window=window, section_id="sec-01", train_movements=trains)
    # TrainDensity: 2 trains / 6 = 0.333
    # FreightUncertainty: 1 - 0.7 = 0.3
    # PeakHourPenalty: +0.3 (overlaps 8-9am)
    # DelayPropagationRisk: +0.2 (passenger train at 7:50 is 10 min before 8:00)
    # Total ~ 0.333 + 0.3 + 0.3 + 0.2 = 1.133
    assert score > 0.8
    assert isinstance(score, float)
