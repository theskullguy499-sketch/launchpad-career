import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { makeBillingHandler } from '../_shared/billing.mjs';
Deno.serve(makeBillingHandler('billing', { env: (name: string) => Deno.env.get(name), createClient, fetch }));
