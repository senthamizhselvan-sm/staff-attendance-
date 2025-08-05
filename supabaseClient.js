// supabaseClient.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Create a mock client if environment variables are missing
let supabase;
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env - using mock client'
  );
  console.warn('⚠️ Please create a .env file with your Supabase credentials');

  // Create a mock client that returns errors for database operations
  supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: null,
              error: {
                code: 'PGRST116',
                message: 'Mock: No database connection',
              },
            }),
        }),
        order: () => ({
          order: () =>
            Promise.resolve({
              data: [],
              error: { message: 'Mock: No database connection' },
            }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: 'Mock: No database connection' },
              }),
          }),
        }),
      }),
    }),
    rpc: () =>
      Promise.resolve({
        data: null,
        error: { message: 'Mock: No database connection' },
      }),
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: globalThis.fetch },
  });
}

export { supabase };
