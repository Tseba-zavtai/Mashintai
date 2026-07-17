-- Stores the latest Expo push token for each signed-in device owner.
alter table public.users
  add column if not exists expo_push_token text;