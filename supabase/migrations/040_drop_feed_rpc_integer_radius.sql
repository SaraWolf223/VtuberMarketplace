-- Remove duplicate get_feed_listings(int radius) overload left after 039 added numeric radius.
-- PostgREST cannot choose between integer vs numeric p_radius_miles.

DROP FUNCTION IF EXISTS public.get_feed_listings(
  double precision,
  double precision,
  integer,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer
);

GRANT EXECUTE ON FUNCTION public.get_feed_listings(
  double precision,
  double precision,
  numeric,
  public.listing_category,
  numeric,
  public.listing_status,
  text,
  text,
  text,
  integer
) TO authenticated, anon;
