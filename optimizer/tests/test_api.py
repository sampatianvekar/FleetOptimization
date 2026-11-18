import pytest

from app import app


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


BODY = {
    "vehicles": 2,
    "capacity": 50,
    "seed": 5,
    "iterations": 10,
    "ants": 5,
    "locations": [
        {"name": "Depot", "x": 77.6, "y": 12.9, "demand": 0},
        {"name": "A", "x": 77.62, "y": 12.95, "demand": 20},
        {"name": "B", "x": 77.70, "y": 12.99, "demand": 20},
        {"name": "C", "x": 77.55, "y": 12.85, "demand": 20},
    ],
}


def test_health(client):
    assert client.get("/health").get_json()["status"] == "ok"


def test_optimize_happy_path(client):
    res = client.post("/optimize", json=BODY)
    assert res.status_code == 200
    data = res.get_json()
    for key in ("routes", "distance_km", "eta_hours", "baseline", "unserved", "route_stats", "convergence"):
        assert key in data
    assert sorted(s for r in data["routes"] for s in r[1:-1]) == [1, 2, 3]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda b: b.update(vehicles="two"),
        lambda b: b.update(locations="nope"),
        lambda b: b.update(capacity=-1),
        lambda b: b["locations"][1].update(x=999),
    ],
)
def test_bad_input_is_a_400_with_message(client, mutate):
    body = {**BODY, "locations": [dict(l) for l in BODY["locations"]]}
    mutate(body)
    res = client.post("/optimize", json=body)
    assert res.status_code == 400 and "error" in res.get_json()


def test_non_json_body_is_400(client):
    assert client.post("/optimize", data="hello", content_type="text/plain").status_code == 400


def test_unknown_route_keeps_404(client):
    assert client.get("/nope").status_code == 404
