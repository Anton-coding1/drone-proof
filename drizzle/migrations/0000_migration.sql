CREATE TABLE public.scenarios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, location_name text, is_simulated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.drone_points (id bigserial PRIMARY KEY, scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE, t timestamptz NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL, alt_m double precision, satellites int, accuracy_m double precision, fix_type int, jamming_state int, spoofing_state int);
CREATE INDEX ON public.drone_points(scenario_id, t);
CREATE TABLE public.sky_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL CHECK (type IN ('jamming','spoofing')), lat double precision NOT NULL, lon double precision NOT NULL, start_time timestamptz NOT NULL, end_time timestamptz NOT NULL);
CREATE TABLE public.sky_hexes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hour timestamptz NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL, low_quality_count int NOT NULL DEFAULT 0, total_count int NOT NULL DEFAULT 0);

GRANT SELECT ON public.scenarios, public.drone_points, public.sky_events, public.sky_hexes TO anon, authenticated;
GRANT ALL ON public.scenarios, public.drone_points, public.sky_events, public.sky_hexes TO service_role;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drone_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sky_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sky_hexes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.scenarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.drone_points FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.sky_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.sky_hexes FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.scenarios (id, name, description, location_name, is_simulated) VALUES
('a0000000-0000-0000-0000-00000000000a','Clean London flight','Routine 5-minute flight with a strong GNSS fix throughout.','Westminster, London, UK',true),
('b0000000-0000-0000-0000-00000000000b','Ground-level jammer','Local signal loss mid-flight while the wider sky stayed clean.','Tromsø, Norway',true),
('c0000000-0000-0000-0000-00000000000c','Baltic incident','Flight inside a known regional jamming event.','Gdańsk Bay, Poland',true);

-- A: clean
INSERT INTO public.drone_points (scenario_id,t,lat,lon,alt_m,satellites,accuracy_m,fix_type,jamming_state,spoofing_state)
SELECT 'a0000000-0000-0000-0000-00000000000a', '2026-10-01 14:00:00+00'::timestamptz + s*interval '1 second',
 51.5007 + 0.0015*sin(s/48.0), -0.1246 + 0.0025*sin(s/96.0), 60 + 10*sin(s/30.0),
 16 + floor(random()*5)::int, 0.8 + random()*0.7, 3, 1, 1
FROM generate_series(0,299) s;

-- B: ground jammer minutes 2-4
INSERT INTO public.drone_points (scenario_id,t,lat,lon,alt_m,satellites,accuracy_m,fix_type,jamming_state,spoofing_state)
SELECT 'b0000000-0000-0000-0000-00000000000b', '2026-09-16 10:00:00+00'::timestamptz + s*interval '1 second',
 69.2900 + 0.0012*sin(s/48.0) + CASE WHEN s BETWEEN 120 AND 239 THEN (random()-0.5)*0.0004 ELSE 0 END,
 16.0300 + 0.0035*sin(s/96.0) + CASE WHEN s BETWEEN 120 AND 239 THEN (random()-0.5)*0.0008 ELSE 0 END,
 50 + 8*sin(s/30.0),
 CASE WHEN s BETWEEN 120 AND 239 THEN 3 + floor(random()*4)::int ELSE 15 + floor(random()*4)::int END,
 CASE WHEN s BETWEEN 120 AND 239 THEN 20 + random()*20 ELSE 0.8 + random()*0.5 END,
 CASE WHEN s BETWEEN 120 AND 239 THEN 2 ELSE 3 END,
 CASE WHEN s BETWEEN 120 AND 239 THEN 3 ELSE 1 END, 1
FROM generate_series(0,299) s;

-- C: Baltic from minute 1
INSERT INTO public.drone_points (scenario_id,t,lat,lon,alt_m,satellites,accuracy_m,fix_type,jamming_state,spoofing_state)
SELECT 'c0000000-0000-0000-0000-00000000000c', '2026-09-20 15:00:00+00'::timestamptz + s*interval '1 second',
 54.3800 + 0.0015*sin(s/48.0) + CASE WHEN s >= 60 THEN (random()-0.5)*0.0008 ELSE 0 END,
 18.4700 + 0.0025*sin(s/96.0) + CASE WHEN s >= 60 THEN (random()-0.5)*0.0014 ELSE 0 END,
 70 + 10*sin(s/30.0),
 CASE WHEN s >= 60 THEN 2 + floor(random()*4)::int ELSE 15 + floor(random()*4)::int END,
 CASE WHEN s >= 60 THEN 15 + random()*45 ELSE 0.9 + random()*0.6 END,
 CASE WHEN s >= 60 THEN 2 ELSE 3 END,
 CASE WHEN s >= 60 THEN 3 ELSE 1 END, 1
FROM generate_series(0,299) s;

INSERT INTO public.sky_hexes (hour,lat,lon,low_quality_count,total_count) VALUES
('2026-10-01 14:00:00+00',51.5007,-0.1246,0,40),
('2026-09-16 10:00:00+00',69.2900,16.0300,0,8),
('2026-09-20 15:00:00+00',54.3800,18.4700,14,30);

INSERT INTO public.sky_events (type,lat,lon,start_time,end_time) VALUES
('jamming',54.45,18.60,'2026-09-20 14:30:00+00','2026-09-20 16:00:00+00');