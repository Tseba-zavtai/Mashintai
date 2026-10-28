import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanDeletedAccountFiles } from '../_shared/accountDeletion.ts';

// Public wake-up only: takes no target/path input, reads a service-only queue.
// Atomic leases cap work; callers cannot enqueue files or inspect queue contents.
serve(async req => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await cleanDeletedAccountFiles(admin);
    return new Response(null, { status: 204 });
  } catch {
    console.error('account deletion cleanup failed');
    return new Response(null, { status: 503 });
  }
});
