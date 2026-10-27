import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { makeHandler } from '../_shared/handlers.mjs';
Deno.serve(makeHandler('job-explorer', { env: (name: string) => Deno.env.get(name), createClient, fetch }));
