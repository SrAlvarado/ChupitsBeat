-- Oyentes mensuales de Spotify cacheados por artista (clave provider:id de
-- descubrimiento, p.ej. "deezer:1024511"). Se llena vía el scraper de RapidAPI.
-- Valor -1 = "ya consultado pero sin dato" (para no re-gastar la API gratis).

alter table artist_profiles
  add column if not exists monthly_listeners integer;
