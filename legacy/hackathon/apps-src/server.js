// src/server.js
import express from 'express';
import cors from 'cors';
import { scrapeUrl } from './pipeline.js';

const app = express();

app.use(cors({ origin: 'http://127.0.0.1:5173' }));
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const data = await scrapeUrl(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper backend listening on port ${PORT}`);
});
