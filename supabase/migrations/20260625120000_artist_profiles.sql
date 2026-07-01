-- Caché de perfiles acústicos por artista para el descubrimiento.
-- Cada fila = un artista analizado (embedding CLAP 512-d + features).
-- La clave es estable: "provider:id" (p.ej. "deezer:1024511").

create extension if not exists vector;

create table if not exists artist_profiles (
  key         text primary key,         -- provider:id
  bpm         real,
  energy      real,
  brightness  real,
  music_key   text,                      -- tonalidad estimada (p.ej. "F# minor")
  embedding   vector(512),               -- huella acústica CLAP, L2-normalizada
  updated_at  timestamptz not null default now()
);

-- Índice para búsqueda por vecino más cercano (coseno) directamente en SQL.
create index if not exists artist_profiles_embedding_idx
  on artist_profiles using ivfflat (embedding vector_cosine_ops) with (lists = 100);
