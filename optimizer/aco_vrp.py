"""Ant Colony Optimization (MAX-MIN Ant System) solver for the Capacitated VRP.

Coordinates use the project convention ``x`` = longitude, ``y`` = latitude and
location 0 is always the depot.  Distances are great-circle (haversine) km.

Compared with a plain Ant System this solver adds:
  * pheromone bounds + iteration-best / global-best deposits (MMAS)
  * 2-opt local search on every route of the iteration-best solution
  * explicit handling of unservable stops (reported, never silently dropped)
  * duplicate-coordinate safety (no NaN probabilities, no infinite loops)
  * a wall-clock budget and a reproducible seed
  * a baseline plan computed with the *same* metric and constraints, so the
    "improvement" figure is an apples-to-apples comparison
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

EARTH_RADIUS_KM = 6371.0088
EPS = 1e-9

DEFAULT_CAPACITY = 100.0
DEFAULT_DEMAND = 10.0
DEFAULT_SPEED_KMH = 40.0

MAX_LOCATIONS = 200
MAX_VEHICLES = 50


@dataclass(frozen=True)
class ACOParams:
    alpha: float = 1.0        # pheromone influence
    beta: float = 4.0         # heuristic (1/distance) influence
    evaporation: float = 0.1  # rho
    ants: int = 20
    iterations: int = 80
    time_limit_s: float = 5.0  # hard wall-clock budget
    seed: Optional[int] = None


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #
def haversine_matrix(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    """Vectorised pairwise great-circle distance matrix in km."""
    lon = np.radians(lons)[:, None]
    lat = np.radians(lats)[:, None]
    dlat = lat - lat.T
    dlon = lon - lon.T
    a = np.sin(dlat / 2) ** 2 + np.cos(lat) * np.cos(lat.T) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))


def distance(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """Distance in km between two ``{x: lon, y: lat}`` points (kept for API compat)."""
    m = haversine_matrix(np.array([p1["x"], p2["x"]]), np.array([p1["y"], p2["y"]]))
    return float(m[0, 1])


def create_distance_matrix(locations: Sequence[Dict[str, float]]) -> np.ndarray:
    return haversine_matrix(
        np.array([l["x"] for l in locations], dtype=float),
        np.array([l["y"] for l in locations], dtype=float),
    )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def route_length(route: Sequence[int], dist: np.ndarray) -> float:
    return float(sum(dist[route[i], route[i + 1]] for i in range(len(route) - 1)))


def two_opt(route: List[int], dist: np.ndarray) -> List[int]:
    """Intra-route 2-opt. ``route`` starts and ends at the depot (kept fixed)."""
    best = route[:]
    improved = True
    while improved:
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best) - 1):
                a, b, c, d = best[i - 1], best[i], best[j], best[j + 1]
                if dist[a, c] + dist[b, d] < dist[a, b] + dist[c, d] - EPS:
                    best[i : j + 1] = best[i : j + 1][::-1]
                    improved = True
    return best


def _normalise_capacities(capacity: Any, vehicles: int) -> List[float]:
    if isinstance(capacity, (list, tuple)):
        caps = [float(c) for c in capacity]
        if len(caps) != vehicles:
            raise ValueError("'capacities' must contain exactly one value per vehicle")
    else:
        caps = [float(capacity)] * vehicles
    if any(c <= 0 for c in caps):
        raise ValueError("vehicle capacity must be greater than zero")
    return caps


def naive_baseline(demands: np.ndarray, capacities: List[float], dist: np.ndarray) -> List[List[int]]:
    """What an un-optimised dispatcher would do: take stops in the order they were
    entered and fill vehicle 1, then vehicle 2, ... until capacity runs out."""
    routes: List[List[int]] = []
    v, load, current = 0, 0.0, [0]
    for stop in range(1, len(demands)):
        d = demands[stop]
        if d > max(capacities) + EPS:
            continue  # nobody can carry it
        while v < len(capacities) and load + d > capacities[v] + EPS:
            if len(current) > 1:
                routes.append(current + [0])
            v, load, current = v + 1, 0.0, [0]
        if v >= len(capacities):
            break
        current.append(stop)
        load += d
    if len(current) > 1:
        routes.append(current + [0])
    return routes


# --------------------------------------------------------------------------- #
# Solver
# --------------------------------------------------------------------------- #
class ACOSolver:
    def __init__(self, dist: np.ndarray, demands: np.ndarray, capacities: List[float], params: ACOParams):
        self.dist = dist
        self.demands = demands
        self.capacities = capacities
        self.p = params
        self.n = len(demands)
        self.rng = np.random.default_rng(params.seed)

        # Stops no vehicle can ever carry are excluded up-front and reported.
        max_cap = max(capacities)
        self.unservable = [i for i in range(1, self.n) if demands[i] > max_cap + EPS]
        self.servable = np.array([i for i in range(1, self.n) if demands[i] <= max_cap + EPS], dtype=int)

        # 1/d with a floor so coincident points are "very attractive" but finite.
        self.heuristic = (1.0 / np.maximum(dist, 1e-3)) ** params.beta

    # -- construction ------------------------------------------------------- #
    def _construct(self, tau_alpha: np.ndarray) -> List[List[int]]:
        unvisited = np.zeros(self.n, dtype=bool)
        unvisited[self.servable] = True
        routes: List[List[int]] = []
        for cap in self.capacities:
            if not unvisited.any():
                break
            load, current, route = 0.0, 0, [0]
            while True:
                feasible = unvisited & (self.demands <= cap - load + EPS)
                idx = np.flatnonzero(feasible)
                if idx.size == 0:
                    break
                w = tau_alpha[current, idx] * self.heuristic[current, idx]
                total = w.sum()
                if not np.isfinite(total) or total <= 0:
                    nxt = int(self.rng.choice(idx))  # degenerate weights: uniform
                else:
                    cum = np.cumsum(w)
                    k = int(np.searchsorted(cum, self.rng.random() * total, side="right"))
                    nxt = int(idx[min(k, idx.size - 1)])
                route.append(nxt)
                unvisited[nxt] = False
                load += self.demands[nxt]
                current = nxt
            if len(route) > 1:
                routes.append(route + [0])
        return routes

    def _score(self, routes: List[List[int]]):
        served = {s for r in routes for s in r[1:-1]}
        n_unserved = len(self.servable) - len(served)
        cost = sum(route_length(r, self.dist) for r in routes)
        return (n_unserved, cost)

    # -- main loop ---------------------------------------------------------- #
    def solve(self):
        n, p = self.n, self.p
        start = time.perf_counter()

        # Initial pheromone from a nearest-neighbour tour length (standard MMAS seed).
        nn_len = self._nearest_neighbour_length()
        tau_max = 1.0 / (p.evaporation * max(nn_len, EPS))
        tau_min = tau_max / (2.0 * n)
        tau = np.full((n, n), tau_max)

        best_routes: List[List[int]] = []
        best_score = (len(self.servable) + 1, float("inf"))
        history: List[float] = []
        done = 0

        for it in range(p.iterations):
            tau_alpha = tau ** p.alpha
            it_routes, it_score = None, (10**9, float("inf"))
            for _ in range(p.ants):
                routes = self._construct(tau_alpha)
                s = self._score(routes)
                if s < it_score:
                    it_routes, it_score = routes, s

            # Local search on the iteration-best solution only (cheap, effective).
            it_routes = [two_opt(r, self.dist) for r in it_routes]
            it_score = self._score(it_routes)
            if it_score < best_score:
                best_routes, best_score = it_routes, it_score

            tau *= 1.0 - p.evaporation
            for routes, score in ((it_routes, it_score), (best_routes, best_score)):
                amount = 1.0 / (score[1] + EPS)
                for r in routes:
                    for a, b in zip(r[:-1], r[1:]):
                        tau[a, b] += amount
                        tau[b, a] += amount
            tau_max = 1.0 / (p.evaporation * max(best_score[1], EPS))
            tau_min = tau_max / (2.0 * n)
            np.clip(tau, tau_min, tau_max, out=tau)

            history.append(round(best_score[1], 3))
            done = it + 1
            if time.perf_counter() - start > p.time_limit_s:
                break

        return best_routes, history, done

    def _nearest_neighbour_length(self) -> float:
        if len(self.servable) == 0:
            return 1.0
        remaining = set(self.servable.tolist())
        cur, total = 0, 0.0
        while remaining:
            nxt = min(remaining, key=lambda j: self.dist[cur, j])
            total += self.dist[cur, nxt]
            remaining.discard(nxt)
            cur = nxt
        return float(total + self.dist[cur, 0])


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def validate_problem(locations: Any, vehicles: Any, capacity: Any = DEFAULT_CAPACITY) -> None:
    if not isinstance(locations, list) or len(locations) < 1:
        raise ValueError("'locations' must be a non-empty list (first item is the depot)")
    if len(locations) > MAX_LOCATIONS:
        raise ValueError(f"at most {MAX_LOCATIONS} locations are supported")
    if isinstance(vehicles, bool) or not isinstance(vehicles, int) or not 1 <= vehicles <= MAX_VEHICLES:
        raise ValueError(f"'vehicles' must be an integer between 1 and {MAX_VEHICLES}")
    for i, loc in enumerate(locations):
        if not isinstance(loc, dict):
            raise ValueError(f"location {i} must be an object")
        for key, lo, hi in (("x", -180, 180), ("y", -90, 90)):
            v = loc.get(key)
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= v <= hi:
                label = "longitude (x)" if key == "x" else "latitude (y)"
                raise ValueError(f"location {i}: {label} must be a number between {lo} and {hi}")
        d = loc.get("demand", DEFAULT_DEMAND if i else 0)
        if isinstance(d, bool) or not isinstance(d, (int, float)) or d < 0:
            raise ValueError(f"location {i}: demand must be a number >= 0")
    _normalise_capacities(capacity, vehicles)


def solve_vrp(
    locations: List[Dict[str, Any]],
    vehicles: int,
    capacity: Any = DEFAULT_CAPACITY,
    avg_speed_kmh: float = DEFAULT_SPEED_KMH,
    service_minutes: float = 0.0,
    params: Optional[ACOParams] = None,
) -> Dict[str, Any]:
    """Solve a capacitated VRP. ``capacity`` is a number or a per-vehicle list."""
    validate_problem(locations, vehicles, capacity)
    if not avg_speed_kmh or avg_speed_kmh <= 0:
        raise ValueError("'avg_speed_kmh' must be greater than zero")
    params = params or ACOParams()
    t0 = time.perf_counter()

    dist = create_distance_matrix(locations)
    demands = np.array(
        [float(l.get("demand", DEFAULT_DEMAND if i else 0)) for i, l in enumerate(locations)]
    )
    demands[0] = 0.0
    capacities = _normalise_capacities(capacity, vehicles)

    solver = ACOSolver(dist, demands, capacities, params)
    routes, history, iterations_run = solver.solve() if len(locations) > 1 else ([], [], 0)

    baseline_routes = naive_baseline(demands, capacities, dist) if len(locations) > 1 else []

    def summarise(rs: List[List[int]]) -> Dict[str, Any]:
        km = sum(route_length(r, dist) for r in rs)
        stops = sum(len(r) - 2 for r in rs)
        hours = km / avg_speed_kmh + stops * service_minutes / 60.0
        return {"routes": rs, "distance_km": round(km, 2), "eta_hours": round(hours, 2)}

    result = summarise(routes)
    base = summarise(baseline_routes)
    # The naive plan can strand stops too (first-fit packing wastes capacity). Report it, so the
    # comparison is never read as "same work, fewer km" when the baseline actually skipped stops.
    base_served = {s for r in baseline_routes for s in r[1:-1]}
    base["unserved"] = sorted(set(range(1, len(locations))) - base_served)

    route_stats = []
    for k, r in enumerate(routes):
        km = route_length(r, dist)
        route_stats.append(
            {
                "vehicle": k + 1,
                "stops": len(r) - 2,
                "load": float(sum(demands[s] for s in r[1:-1])),
                "capacity": capacities[min(k, len(capacities) - 1)],
                "distance_km": round(km, 2),
                "eta_minutes": round(km / avg_speed_kmh * 60 + (len(r) - 2) * service_minutes),
            }
        )

    served = {s for r in routes for s in r[1:-1]}
    unserved = sorted(set(range(1, len(locations))) - served)
    saved = base["distance_km"] - result["distance_km"]
    pct = (saved / base["distance_km"] * 100) if base["distance_km"] > 0 else 0.0

    result.update(
        {
            "eta_minutes": round(result["eta_hours"] * 60),
            "makespan_minutes": max((s["eta_minutes"] for s in route_stats), default=0),
            "route_stats": route_stats,
            "unserved": unserved,
            "baseline": base,
            "distance_saved_km": round(saved, 2),
            "improvement_pct": round(pct, 1),
            "convergence": history,
            "iterations_run": iterations_run,
            "runtime_ms": round((time.perf_counter() - t0) * 1000),
            "params": {**asdict(params), "avg_speed_kmh": avg_speed_kmh, "service_minutes": service_minutes},
        }
    )
    return result
