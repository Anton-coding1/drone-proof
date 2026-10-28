DROP POLICY IF EXISTS "public read" ON public.scenarios;
DROP POLICY IF EXISTS "public read" ON public.drone_points;
REVOKE SELECT ON public.scenarios FROM anon, authenticated;
REVOKE SELECT ON public.drone_points FROM anon, authenticated;