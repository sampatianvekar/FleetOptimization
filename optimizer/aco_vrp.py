import numpy as np
import random
from geopy.distance import geodesic

ALPHA = 1
BETA = 5
EVAPORATION = 0.5
Q = 100
ANTS = 10
ITERATIONS = 50

def distance(p1, p2):
    return geodesic((p1['y'], p1['x']), (p2['y'], p2['x'])).km

def create_distance_matrix(locations):
    n = len(locations)
    matrix = np.zeros((n,n))
    for i in range(n):
        for j in range(n):
            matrix[i][j] = distance(locations[i], locations[j])
    return matrix

def solve_vrp(locations, vehicles):
    n = len(locations)
    dist = create_distance_matrix(locations)
    pheromone = np.ones((n,n))
    capacities = [100]*vehicles
    demands = [loc.get("demand",10) for loc in locations]

    best_routes, best_cost = None, float('inf')

    for _ in range(ITERATIONS):
        routes = [[] for _ in range(vehicles)]
        loads = [0]*vehicles
        visited = set([0])
        for v in range(vehicles):
            current = 0
            routes[v].append(0)
            while True:
                candidates = []
                for j in range(1,n):
                    if j not in visited and loads[v]+demands[j]<=capacities[v]:
                        tau = pheromone[current][j]**ALPHA
                        eta = (1/dist[current][j])**BETA if dist[current][j]!=0 else 0
                        candidates.append((j, tau*eta))
                if not candidates: break
                total = sum(c[1] for c in candidates)
                probs = [(c[0],c[1]/total) for c in candidates]
                r = random.random()
                cumulative = 0
                for node, prob in probs:
                    cumulative += prob
                    if r <= cumulative:
                        routes[v].append(node)
                        visited.add(node)
                        loads[v] += demands[node]
                        current = node
                        break
            routes[v].append(0)
        cost = sum(dist[r[i]][r[i+1]] for r in routes for i in range(len(r)-1))
        if cost<best_cost:
            best_cost = cost
            best_routes = routes
        pheromone *= (1-EVAPORATION)
        for r in routes:
            for i in range(len(r)-1):
                pheromone[r[i]][r[i+1]] += Q/(cost+1)

    total_distance = sum(distance(locations[r[i]], locations[r[i+1]]) for r in best_routes for i in range(len(r)-1))
    avg_speed = 40
    eta_hours = total_distance/avg_speed
    eta_minutes = eta_hours*60
    return {"routes": best_routes, "distance_km": round(total_distance,2), "eta_hours": round(eta_hours,2), "eta_minutes": round(eta_minutes,0)}