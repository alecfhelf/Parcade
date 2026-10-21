-- Mini-golf rounds. Run once before deploying the mini-golf release.
-- Mini courses live in the same courses table but are flagged so real-golf search skips them.
-- Mini pars run 1 to 9 and a mini card can have 9 or 18 holes.

alter table public.rounds add column if not exists mini boolean not null default false;
alter table public.courses add column if not exists mini boolean not null default false;

-- Guests can't save courses, so a guest's mini-golf card (name + pars) is kept on the round instead.
alter table public.rounds add column if not exists mini_course jsonb;
alter table public.rounds drop constraint if exists rounds_mini_course_shape;
alter table public.rounds add constraint rounds_mini_course_shape check (
  mini_course is null or (
    mini
    and jsonb_typeof(mini_course -> 'pars') = 'array'
    and jsonb_array_length(mini_course -> 'pars') in (9, 18)
  )
);
