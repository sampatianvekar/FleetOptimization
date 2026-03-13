# 🚛 Fleet Route Optimization Platform

> A full-stack logistics optimization platform that computes efficient delivery routes using the **Ant Colony Optimization (ACO)** algorithm implemented in Python. The system integrates the optimization engine with a MERN-based dashboard to analyze routes, compare travel distance and ETA, and visualize fleet performance.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)

---

## 🌟 Features

- 🐜 **ACO Algorithm** — Ant Colony Optimization computes the most efficient delivery routes across multiple stops
- 📍 **Route Visualization** — Interactive map-based dashboard to visualize optimized fleet routes
- 📊 **Performance Analytics** — Compare travel distance, ETA, and fleet efficiency metrics
- 🔄 **Real-time Optimization** — Submit delivery jobs and get optimized routes instantly
- 📦 **Fleet Management** — Track and manage multiple vehicles and delivery assignments
- 🗄️ **MongoDB Integration** — Persistent storage for routes, vehicles, and delivery history
- 🌐 **REST API** — Clean Express.js API connecting the Python optimizer with the React frontend

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Algorithm | Python (ACO — Ant Colony Optimization) |
| Tools | Git, npm |

---

## 🏗️ Project Structure

```
FleetOptimization/
├── src/                   # React frontend
│   ├── components/        # UI components
│   ├── pages/             # Dashboard pages
│   └── App.js             # Main React app
├── models/                # MongoDB models
│   ├── Route.js           # Route schema
│   └── Vehicle.js         # Vehicle schema
├── optimizer/             # Python ACO engine
│   └── aco.py             # Ant Colony Optimization algorithm
├── package.json           # Node.js dependencies
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- Python 3.8+
- MongoDB (local or Atlas)
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sampatianvekar/FleetOptimization.git
cd FleetOptimization

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install numpy

# 4. Set up environment variables
# Create a .env file with:
MONGO_URI=your_mongodb_connection_string
PORT=5000

# 5. Start the backend server
node server.js

# 6. Start the React frontend
cd src
npm start
```

---

## 🧠 How the ACO Algorithm Works

The **Ant Colony Optimization** algorithm is inspired by the foraging behavior of ants:

1. 🐜 Virtual "ants" explore possible routes between delivery points
2. 📍 Each ant deposits "pheromones" on shorter, more efficient paths
3. 🔄 Over multiple iterations, pheromone trails reinforce the best routes
4. ✅ The algorithm converges on the most optimal delivery sequence

This approach solves the **Travelling Salesman Problem (TSP)** variant for fleet routing, significantly reducing total travel distance and delivery time.

---

## 📊 Results

| Metric | Before Optimization | After ACO |
|--------|-------------------|-----------|
| Total Distance | Unoptimized | Minimized |
| ETA | Higher | Reduced |
| Fuel Efficiency | Lower | Improved |

---

## 👨‍💻 Developed By

| Developer | GitHub | Contact |
|-----------|--------|---------|
| Sampati Anvekar | [@sampatianvekar](https://github.com/sampatianvekar) | sampatianvekar@gmail.com |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
