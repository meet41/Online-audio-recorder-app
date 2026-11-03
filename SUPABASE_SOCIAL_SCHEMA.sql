-- Run this in Supabase SQL Editor to support Likes, Comments, Plays, and Remixes:

-- 1. Add social interaction columns to recordings table
alter table public.recordings 
  add column if not exists likes text[] default '{}',
  add column if not exists play_count integer default 0,
  add column if not exists parent_id uuid references public.recordings(id) on delete set null;

-- 2. Create comments table
create table if not exists public.recording_comments (
  id uuid default gen_random_uuid() primary key,
  recording_id uuid references public.recordings(id) on delete cascade not null,
  author text not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS on comments
alter table public.recording_comments enable row level security;

create policy "Allow public read comments" on public.recording_comments for select using (true);
create policy "Allow public insert comments" on public.recording_comments for insert with check (true);
create policy "Allow public delete comments" on public.recording_comments for delete using (true);

-- 4. Enable Realtime updates on comments
alter publication supabase_realtime add table public.recording_comments;
