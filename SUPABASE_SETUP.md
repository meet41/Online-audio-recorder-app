# Supabase Database & Storage Setup (100% Free, No Credit Card)

Follow these simple steps in your [Supabase Dashboard](https://supabase.com/dashboard) to connect your project:

---

### Step 1: Create Your PostgreSQL Table

1. Go to the **SQL Editor** tab in the left sidebar of your Supabase dashboard.
2. Click **New query**, paste the following SQL script, and click **Run**:

```sql
-- 1. Create recordings table
create table public.recordings (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  author text not null,
  duration integer default 0,
  size bigint default 0,
  audio_url text not null,
  storage_path text,
  is_deleted boolean default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.recordings enable row level security;

-- 3. Allow public read/write access (for our shared voice memo app)
create policy "Allow public read access"
  on public.recordings for select
  using (true);

create policy "Allow public insert"
  on public.recordings for insert
  with check (true);

create policy "Allow public update"
  on public.recordings for update
  using (true);

create policy "Allow public delete"
  on public.recordings for delete
  using (true);

-- 4. Enable Realtime updates
alter publication supabase_realtime add table public.recordings;
```

---

### Step 2: Create Storage Bucket for MP3 Files

1. Go to the **Storage** tab in the left sidebar.
2. Click **New bucket**.
3. Bucket name: **`recordings`** (all lowercase).
4. Toggle **Public bucket** to **ON** (so users can stream and download their MP3 recordings).
5. Click **Save**.

---

### Step 3: Set Storage Bucket Policies

Under **Storage** ➔ **Policies** (or click on the `recordings` bucket options ➔ **Policies**):
1. Click **New policy** ➔ **For full customization** (or select "Insert, Select, Update, Delete").
2. Set Policy Name: `Public Access for Audio Memos`
3. Check all actions: **SELECT**, **INSERT**, **UPDATE**, **DELETE**.
4. Target roles: `anon` and `authenticated` (or `public`).
5. In both `USING` and `WITH CHECK` expression boxes, simply write:
   ```sql
   true
   ```
6. Click **Save policy**.

---

### Step 4: Add Supabase Keys to `.env`

1. In Supabase, go to **Project Settings** (gear icon) ➔ **API**.
2. Copy:
   - **Project URL**
   - **Project API Keys** ➔ **`anon` `public`** key
3. In your project directory (`C:\Users\meetk\.gemini\antigravity\scratch\audio-recorder-app`), create or edit `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Start the app:
   ```powershell
   npm run dev
   ```
5. You're done! Your app will display **"Supabase Connected"** with a green badge and will save real **MP3** files straight to the cloud!
