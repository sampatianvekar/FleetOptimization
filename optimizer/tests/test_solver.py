import random

import numpy as np
import pytest

from aco_vrp import ACOParams, haversine_matrix, naive_baseline, solve_vrp, two_opt, route_length

FAST = ACOParams(ants=10, iterations=30, seed=7)


def make_instance(n, demand=10, seed=1):
    rnd = random.Random(seed)
    depot = {"name": "Depot", "x": 77.6, "y": 12.9, "demand": 0}
    return [depot] + [
        {"name": f"S{i}", "x": 77.5 + rnd.random() * 0.25, "y": 12.85 + rnd.random() * 0.25, "demand": demand}
        for i in range(1, n + 1)
    ]


def served_stops(result):
    return [s for r in result["routes"] for s in r[1:-1]]


def test_haversine_one_degree_of_longitude_at_equator():
    m = haversine_matrix(np.array([0.0, 1.0]), np.array([0.0, 0.0]))
    assert m[0, 1] == pytest.approx(111.195, abs=0.01)
    assert m[0, 0] == 0 and m[0, 1] == m[1, 0]


def test_every_stop_served_exactly_once_and_capacity_respected():
    locs = make_instance(25)
    res = solve_vrp(locs, 4, capacity=100, params=FAST)
    stops = served_stops(res)
    assert sorted(stops) == list(range(1, 26))
    assert res["unserved"] == []
    for r in res["routes"]:
        assert r[0] == 0 and r[-1] == 0
        assert sum(locs[s]["demand"] for s in r[1:-1]) <= 100
    for st in res["route_stats"]:
        assert st["load"] <= st["capacity"]


def test_beats_naive_baseline_and_reports_same_metric():
    locs = make_instance(20)
    res = solve_vrp(locs, 3, params=FAST)
    assert res["distance_km"] < res["baseline"]["distance_km"]
    assert res["improvement_pct"] > 0
    assert res["distance_saved_km"] == pytest.approx(res["baseline"]["distance_km"] - res["distance_km"], abs=0.01)
    assert len(res["convergence"]) == res["iterations_run"]
    # convergence is monotonically non-increasing
    assert all(a >= b for a, b in zip(res["convergence"], res["convergence"][1:]))


def test_seed_makes_runs_reproducible():
    locs = make_instance(15)
    a = solve_vrp(locs, 2, params=ACOParams(ants=8, iterations=20, seed=42))
    b = solve_vrp(locs, 2, params=ACOParams(ants=8, iterations=20, seed=42))
    assert a["routes"] == b["routes"] and a["distance_km"] == b["distance_km"]


def test_duplicate_coordinates_and_stop_on_depot_do_not_hang():
    # Regression: the original solver looped forever on these inputs (NaN probabilities).
    locs = [
        {"x": 77.6, "y": 12.9, "demand": 0},
        {"x": 77.62, "y": 12.92, "demand": 10},
        {"x": 77.62, "y": 12.92, "demand": 10},
        {"x": 77.6, "y": 12.9, "demand": 10},  # exactly on the depot
    ]
    res = solve_vrp(locs, 1, params=FAST)
    assert sorted(served_stops(res)) == [1, 2, 3]


def test_unservable_and_overflow_stops_are_reported_not_dropped_silently():
    locs = make_instance(5)
    locs[3]["demand"] = 500  # bigger than any vehicle
    res = solve_vrp(locs, 2, capacity=100, params=FAST)
    assert 3 in res["unserved"]
    assert 3 not in served_stops(res)

    # 3 vehicles x 100 capacity cannot carry 40 x 10 units: exactly 10 stops must be unserved
    res = solve_vrp(make_instance(40), 3, params=ACOParams(ants=10, iterations=30, seed=3))
    assert len(res["unserved"]) == 10
    assert len(served_stops(res)) == 30


def test_per_vehicle_capacities():
    locs = make_instance(8, demand=10)
    res = solve_vrp(locs, 2, capacity=[30, 60], params=FAST)
    loads = sorted(s["load"] for s in res["route_stats"])
    assert max(loads) <= 60 and sum(loads) == 80 - 10 * len(res["unserved"])
    assert all(s["load"] <= 60 for s in res["route_stats"])


def test_depot_only_returns_empty_plan():
    res = solve_vrp([{"x": 77.6, "y": 12.9}], 2, params=FAST)
    assert res["routes"] == [] and res["distance_km"] == 0 and res["unserved"] == []


def test_zero_demand_stops_are_allowed():
    locs = make_instance(4)
    for l in locs[1:]:
        l["demand"] = 0
    res = solve_vrp(locs, 1, params=FAST)
    assert sorted(served_stops(res)) == [1, 2, 3, 4]


def test_service_time_increases_eta():
    locs = make_instance(6)
    a = solve_vrp(locs, 2, params=ACOParams(ants=5, iterations=10, seed=1))
    b = solve_vrp(locs, 2, service_minutes=10, params=ACOParams(ants=5, iterations=10, seed=1))
    assert b["eta_hours"] > a["eta_hours"]


def test_two_opt_removes_a_crossing():
    # square corners visited in a crossing order: 0 -> (1,1) -> (0,1) -> (1,0) -> 0
    xs = np.array([0.0, 0.02, 0.0, 0.02])
    ys = np.array([0.0, 0.02, 0.02, 0.0])
    dist = haversine_matrix(xs, ys)
    crossed = [0, 1, 2, 3, 0]
    fixed = two_opt(crossed, dist)
    assert route_length(fixed, dist) < route_length(crossed, dist)
    assert fixed[0] == 0 and fixed[-1] == 0 and sorted(fixed[1:-1]) == [1, 2, 3]


def test_naive_baseline_fills_vehicles_in_input_order():
    demands = np.array([0, 40, 40, 40, 40.0])
    dist = np.zeros((5, 5))
    assert naive_baseline(demands, [100, 100], dist) == [[0, 1, 2, 0], [0, 3, 4, 0]]


@pytest.mark.parametrize(
    "locations,vehicles,capacity,msg",
    [
        ([], 1, 100, "non-empty"),
        ([{"x": 0, "y": 0}], 0, 100, "vehicles"),
        ([{"x": 0, "y": 0}], 1.5, 100, "vehicles"),
        ([{"x": 200, "y": 0}], 1, 100, "longitude"),
        ([{"x": 0, "y": 95}], 1, 100, "latitude"),
        ([{"x": 0, "y": 0}, {"x": 1, "y": 1, "demand": -5}], 1, 100, "demand"),
        ([{"x": "a", "y": 0}], 1, 100, "longitude"),
        ([{"x": 0, "y": 0}], 2, [100], "one value per vehicle"),
        ([{"x": 0, "y": 0}], 1, 0, "capacity"),
    ],
)
def test_validation_errors(locations, vehicles, capacity, msg):
    with pytest.raises(ValueError, match=msg):
        solve_vrp(locations, vehicles, capacity=capacity, params=FAST)


def test_baseline_reports_stops_it_strands():
    # 3 x 70 capacity = 210 >= 195 demand, but first-fit in input order strands the last stop.
    stops = [("a", 20), ("b", 15), ("c", 25), ("d", 30), ("e", 10), ("f", 15), ("g", 20), ("h", 15), ("i", 20), ("j", 25)]
    locs = [{"x": 77.6, "y": 12.9, "demand": 0}] + [
        {"x": 77.5 + 0.02 * i, "y": 12.9 + 0.01 * i, "demand": d} for i, (_, d) in enumerate(stops)
    ]
    res = solve_vrp(locs, 3, capacity=70, params=FAST)
    assert res["baseline"]["unserved"] == [10]
    assert res["unserved"] == []  # the optimizer packs everyone
    assert res["baseline"]["unserved"] != res["unserved"]
