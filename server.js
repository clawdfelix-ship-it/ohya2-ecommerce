const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is working!' });
});

// Root route
app.get('/', (req, res) => {
  res.send('OHYA2 E-Commerce - Server is running!');
});

module.exports = app;
