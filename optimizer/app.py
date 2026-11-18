"""Flask wrapper around the ACO solver.  Run with:  python app.py"""
import logging
import os

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from aco_vrp import ACOParams, MAX_LOCATIONS, solve_vrp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("optimizer")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024  # 256 KB request cap


@app.get("/health")
def health():
    return jsonify(status="ok", max_locations=MAX_LOCATIONS)


@app.post("/optimize")
def optimize():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Request body must be a JSON object"), 400

    capacity = data.get("capacities") or data.get("capacity", 100)
    tuning = {k: data[k] for k in ("ants", "iterations", "seed") if k in data}
    try:
        params = ACOParams(
            ants=min(max(int(tuning.get("ants", 20)), 1), 100),
            iterations=min(max(int(tuning.get("iterations", 80)), 1), 500),
            seed=tuning.get("seed"),
        )
        result = solve_vrp(
            data.get("locations"),
            data.get("vehicles", 1),
            capacity=capacity,
            avg_speed_kmh=float(data.get("avg_speed_kmh", 40)),
            service_minutes=float(data.get("service_minutes", 0)),
            params=params,
        )
    except (ValueError, TypeError) as exc:
        return jsonify(error=str(exc)), 400
    log.info(
        "solved %d locations / %s vehicles in %d ms (%.1f%% better than baseline)",
        len(data["locations"]), data.get("vehicles", 1), result["runtime_ms"], result["improvement_pct"],
    )
    return jsonify(result)


@app.errorhandler(Exception)
def unexpected(exc):
    if isinstance(exc, HTTPException):  # 404, 405, 413 ... keep their real status
        return jsonify(error=exc.description), exc.code
    log.exception("unhandled error")
    return jsonify(error="Internal optimizer error"), 500


if __name__ == "__main__":
    # 5001, not 5000: macOS AirPlay Receiver squats on 5000.
    app.run(host=os.getenv("OPTIMIZER_HOST", "127.0.0.1"), port=int(os.getenv("OPTIMIZER_PORT", "5001")))
