import { supabase } from './supabase';

// Store matched listing IDs only, never the user's raw search text.
export async function recordSearchDemand(ids: string[]) {
  const { error } = await supabase.rpc('record_listing_search', { listing_ids: ids.slice(0, 100) });
  if (error) console.warn('Search demand recording unavailable:', error.code);
}

export async function loadSearchDemand(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('listing_search_demand');
  if (error) {
    console.warn('Search demand unavailable:', error.code);
    return new Map();
  }
  return new Map((data ?? []).map((row: { job_id: string; search_count: number }) =>
    [row.job_id, Number(row.search_count) || 0]));
}
