# Client

React dashboard for the Fleet Optimization platform. See the [root README](../README.md) for setup.

```bash
cp .env.example .env     # REACT_APP_API_URL, default http://localhost:4000
npm install
npm start                # http://localhost:3000
npm test -- --watchAll=false
npm run build
```

Source layout: `src/App.js` (state + API calls), `src/components/` (map, panels, charts), `src/utils/` (validation, formatting, sample data), `src/api.js` (axios instance + admin token helpers).
