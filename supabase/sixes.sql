-- Sixes game mode. Safe to run more than once.
--
-- The rounds table was made directly in Supabase, so whether rounds.mode has a check constraint listing the modes isn't
-- in the repo. This finds any check on public.rounds that lists 'vegas' and re-creates it with 'sixes' added, keeping
-- its name and everything else. If there's no such check, it does nothing.
--
-- Tournaments stay as they are: tournaments.mode's check (tournaments.sql) leaves Sixes out on purpose.
-- The Club guard (club.sql) already rejects every mode but 'stroke' for free accounts, so Sixes is covered there.

do $$
declare
  c record;
  def text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.rounds'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%''vegas''%'
      and pg_get_constraintdef(oid) not like '%''sixes''%'
  loop
    def := replace(c.d, '''vegas''::text', '''vegas''::text, ''sixes''::text');
    if def = c.d then
      def := replace(c.d, '''vegas''', '''vegas'', ''sixes''');
    end if;
    execute format('alter table public.rounds drop constraint %I', c.conname);
    execute format('alter table public.rounds add constraint %I %s', c.conname, def);
    raise notice 'Added sixes to %: %', c.conname, def;
  end loop;
end $$;
