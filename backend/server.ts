import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

let supabase: SupabaseClient | null = null;

// Connect to Supabase
async function connectSupabase(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.warn('Supabase credentials not configured. Running without database.');
    return null;
  }

  try {
    const client = createClient(url, key);
    console.log('Connected to Supabase database');
    return client;
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return null;
  }
}

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop');
  
  // Initialize Supabase connection
  connectSupabase().then(client => {
    supabase = client;
  });
});
