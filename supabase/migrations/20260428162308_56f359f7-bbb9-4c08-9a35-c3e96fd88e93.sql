insert into storage.buckets (id, name, public)
values ('pick-images', 'pick-images', true)
on conflict (id) do nothing;

create policy "Public read access for pick-images"
on storage.objects for select
to public
using (bucket_id = 'pick-images');

create policy "Service role can write pick-images"
on storage.objects for insert
to service_role
with check (bucket_id = 'pick-images');