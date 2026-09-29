CREATE TABLE public.venue_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_slug text NOT NULL,
  path text NOT NULL,
  sort_order integer NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_images_slug_sort_unique UNIQUE (venue_slug, sort_order)
);

CREATE INDEX venue_images_venue_slug_idx ON public.venue_images (venue_slug);

GRANT SELECT ON public.venue_images TO anon;
GRANT SELECT ON public.venue_images TO authenticated;
GRANT ALL ON public.venue_images TO service_role;

ALTER TABLE public.venue_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue images are publicly readable"
  ON public.venue_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Storage policies for the venue-images bucket
CREATE POLICY "Venue image files are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'venue-images');

CREATE POLICY "Authenticated users can upload venue images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'venue-images');

CREATE POLICY "Authenticated users can update venue images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'venue-images')
  WITH CHECK (bucket_id = 'venue-images');

CREATE POLICY "Authenticated users can delete venue images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'venue-images');