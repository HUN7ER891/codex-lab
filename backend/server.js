const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('AI Content Aggregator backend running!');
});

app.listen(5000, () => console.log('Backend server on http://localhost:5000'));
