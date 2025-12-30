const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');

function generateVisitorId() {
  const dt = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(1000 + Math.random()*9000);
  return `VST-${dt}-${rand}`;
}

router.post('/generate', async (req, res) => {
  try {
    const id = generateVisitorId();
    // Optional: ensure unique by checking DB
    res.json({ success: true, visitorId: id });
  } catch(err) {
    console.error('generate error', err);
    res.status(500).json({ success: false, error: 'Failed to generate visitor id' });
  }
});

module.exports = router;