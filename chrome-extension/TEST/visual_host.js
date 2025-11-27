// Simple Express server to visualize Puppeteer test results as charts
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (for Chart.js and HTML)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to get test results
app.get('/results', (req, res) => {
  const resultsPath = path.join(__dirname, 'puppeteer_results.json');
  if (fs.existsSync(resultsPath)) {
    const data = fs.readFileSync(resultsPath, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Visual host running at http://localhost:${PORT}`);
});

// To use: 
// 1. Run puppeteer_runner.js and save results to puppeteer_results.json
// 2. Place index.html and Chart.js in TEST/public/
// 3. Run this server and open http://localhost:3000
