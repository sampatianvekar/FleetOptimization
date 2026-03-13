from flask import Flask, request, jsonify
from aco_vrp import solve_vrp

app = Flask(__name__)

@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.json
    locations = data.get('locations', [])
    vehicles = data.get('vehicles', 1)
    result = solve_vrp(locations, vehicles)
    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5000)