-- opening-wording-email-test.sql  the DATABASE proof of the email wording change, ONE DO block that writes nothing and ends with an exception  (written October 8, 2026)
-- NOT RUN ANYWHERE yet. Run it in the STAGE SQL editor (yahoo account) AFTER opening-wording-email-migration.sql (it fails on the old wording, which is how it proves the change).
-- It creates no row and changes nothing: public.email_render is STABLE. It reads ONE existing posting that has a close date (any organization, nothing about it is changed or printed except through the rendered text it checks) and renders all 8 email kinds for it.
-- Expected: an error that reads  OPENING WORDING TEST RESULT {"checks": 42, "failures": []}  with "failures" EMPTY. Any entry in "failures" names the check that failed. The error is the rollback (nothing to roll back, but the same ending as the earlier tests).
-- What it asserts: every one of the 18 new sentences appears in the right email; the old words posting, postings, postID and poster appear nowhere in any email (the posting's own title and the organization's own name are cut out first, because a real title can contain such a word); the reference reads  (Opening ID XXXX-XXXX-XXXX)  with the 12 characters of the code; the footer and the subject lines are unchanged in shape; the function is still security definer, stable, search_path empty, executable by service_role and by nobody else.

-- expected project: STAGE
do $guard$
declare
  v_expected constant text := 'STAGE';   -- the ONLY line that differs between project-guard-stage.sql and project-guard-alpha.sql: STAGE or ALPHA
  v_stage_ref constant text := 'tpmvkjuhbbwftqoodzcn';
  v_alpha_ref constant text := 'qgnqoihamhziaqikupaw';
  v_job constant text := 'run-notification-scheduler';
  v_stage_ids constant uuid[] := array['4192e6dd-ca21-4d85-89e5-714f60f0ec3a', 'a0465e78-3976-4b9b-a479-485af09a5d64']::uuid[];
  v_tables int;
  v_read boolean := false;
  v_stage_hit int := 0;
  v_alpha_hit int := 0;
  v_ids int := 0;
  v_actual text;
  v_found text;
  v_next text;
begin
  select count(*) into v_tables from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('organizations', 'posters', 'postings', 'email_outbox');
  if v_tables = 4 then
    begin
      if to_regclass('cron.job') is not null then
        execute format('select count(*) filter (where strpos(command, %L) > 0), count(*) filter (where strpos(command, %L) > 0) from cron.job where jobname = %L', '//' || v_stage_ref || '.supabase.co/', '//' || v_alpha_ref || '.supabase.co/', v_job) into v_stage_hit, v_alpha_hit;
        v_read := true;
      end if;
    exception when others then
      v_read := false; v_stage_hit := 0; v_alpha_hit := 0;
    end;
    if v_read and v_stage_hit > 0 and v_alpha_hit = 0 then v_actual := 'STAGE';
    elsif v_read and v_alpha_hit > 0 and v_stage_hit = 0 then v_actual := 'ALPHA';
    end if;
  end if;
  if v_actual = v_expected then
    return;
  end if;
  if v_tables = 0 then
    v_found := 'this database has no Fight Ghost Jobs tables, so it is not the ' || v_expected || ' project.';
  elsif v_actual is not null then
    v_found := 'this looks like the ' || v_actual || ' project, not ' || v_expected || '.';
  elsif v_tables < 4 then
    v_found := 'cannot prove which project this is: this database has only ' || v_tables || ' of the 4 Fight Ghost Jobs tables that were checked.';
  else
    select count(*) into v_ids from public.organizations o where o.id = any(v_stage_ids);
    v_found := 'cannot prove which project this is: the scheduler cron job that carries the project name was not found, could not be read, or names both projects (hint, not proof: this database holds ' || v_ids || ' of the 2 organization ids known from STAGE).';
  end if;
  if v_tables = 0 or v_actual is not null then
    v_next := case v_expected when 'STAGE' then 'open the Supabase project named fightghostjobs in the yahoo account (the STAGE project), open its SQL editor, paste the whole script and run it again there.'
      else 'open the ALPHA project in the gmail account (the Fight Ghost Jobs alpha project), open its SQL editor, paste the whole script and run it again there.' end;
  else
    v_next := 'do not run anything here. Send this whole message to Claude, with the name of the Supabase project and the account you have open.';
  end if;
  raise exception 'PROJECT GUARD FAILED - NOTHING WAS CHANGED. Expected: the % project. Found: % Next step: %', v_expected, v_found, v_next using errcode = 'P0779';
end
$guard$;

do $t$
#variable_conflict use_column
declare
  v_id uuid; v_title text; v_org text; v_code text; v_ref text; v_site text;
  v_k text; v_x jsonb; v_s text; v_b text; v_all text := ''; v_strip text;
  r record; n int := 0; fails text[] := '{}';
  v_kinds constant text[] := array['invitation', 'closing_soon', 'expired', 'golive_done', 'golive_failed', 'comments', 'contest_filed', 'contest_outcome'];
  v_body_of jsonb := '{}'::jsonb;
begin
  create temp table pg_temp.chk (name text, ok boolean) on commit drop;
  select p.id, p.title, o.name, p.public_code into v_id, v_title, v_org, v_code
    from public.postings p join public.organizations o on o.id = p.organization_id
   where p.expiration_date is not null and p.public_code is not null and length(p.public_code) = 12
   order by p.created_at desc limit 1;
  if v_id is null then raise exception 'OPENING WORDING TEST: needs one existing posting with a close date and a public code; there is none'; end if;
  select coalesce((select value from public.app_settings where key = 'site_url'), 'https://stage.fightghostjobs.com') into v_site;
  v_ref := v_title || ' (Opening ID ' || substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4) || ')';

  foreach v_k in array v_kinds loop
    v_x := case v_k
      when 'invitation' then jsonb_build_object('org_name', 'ZZ Org', 'full_name', 'ZZ Person', 'added_by', 'ZZ Admin')
      when 'closing_soon' then jsonb_build_object('days', '3')
      when 'golive_failed' then jsonb_build_object('code', 'ZZ_CODE')
      when 'contest_filed' then jsonb_build_object('category', 'none', 'at', '2026-10-08T12:00:00Z')
      when 'contest_outcome' then jsonb_build_object('outcome', 'left', 'at', '2026-10-08T12:00:00Z')
      else '{}'::jsonb end;
    select e.subject, e.body into v_s, v_b from public.email_render(v_k, case when v_k = 'invitation' then null else v_id end, v_x) e;
    v_body_of := v_body_of || jsonb_build_object(v_k, coalesce(v_s, '') || E'\n' || coalesce(v_b, ''));
    insert into pg_temp.chk values ('renders: ' || v_k, v_s is not null and v_b is not null);
  end loop;

  insert into pg_temp.chk values ('the reference reads (Opening ID XXXX-XXXX-XXXX) in the 7 kinds that name an opening',
    (select count(*) from jsonb_each_text(v_body_of) j where position(v_ref in j.value) > 0) = 7);
  insert into pg_temp.chk values ('footer says openings and rosters on all 8 kinds',
    (select count(*) from jsonb_each_text(v_body_of) j where position('emails about openings and rosters you are responsible for.' in j.value) > 0) = 8);
  insert into pg_temp.chk values ('footer keeps its reply and privacy lines on all 8 kinds',
    (select count(*) from jsonb_each_text(v_body_of) j where position('Reply to this email to reach us. Privacy: ' || v_site || '/privacy.html' in j.value) > 0) = 8);

  -- the old words are gone from every email (the posting's own title, the organization's name and the sample names are cut out first)
  for r in select key, value from jsonb_each_text(v_body_of) loop
    v_strip := replace(replace(replace(r.value, v_title, ''), coalesce(v_org, ''), ''), v_site, '');
    insert into pg_temp.chk values ('no posting/postings word in ' || r.key, v_strip !~* 'posting');
    insert into pg_temp.chk values ('no postID or poster word in ' || r.key, v_strip !~* 'post ?id' and v_strip !~* 'poster');
  end loop;

  -- exact sentences that cannot be confused with anything else
  insert into pg_temp.chk values ('closing_soon sentence', (v_body_of ->> 'closing_soon') like '%Your opening ' || v_ref || ' closes on %');
  insert into pg_temp.chk values ('closing_soon extension line', (v_body_of ->> 'closing_soon') like '%An opening can be extended once, by up to 15 days, from My openings.%');
  insert into pg_temp.chk values ('expired sentence', (v_body_of ->> 'expired') like '%Your opening ' || v_ref || ' reached its close date and is now shown to candidates as expired (no action taken).%register it again as a new opening: %');
  insert into pg_temp.chk values ('golive_done sentence', (v_body_of ->> 'golive_done') like '%Your scheduled opening ' || v_ref || ' went live at %Manage it from My openings: %');
  insert into pg_temp.chk values ('golive_failed sentence', (v_body_of ->> 'golive_failed') like '%Your opening ' || v_ref || ' was due to go live but could not be published%from My openings: %');
  insert into pg_temp.chk values ('comments sentence', (v_body_of ->> 'comments') like '%Candidates have left new comments on your opening ' || v_ref || '.%Read them from My openings: %per opening every 6 hours.%');
  insert into pg_temp.chk values ('contest_filed sentence', (v_body_of ->> 'contest_filed') like '%An employer contested a comment on an opening.%Opening: ' || v_ref || '%');
  insert into pg_temp.chk values ('contest_outcome sentence', (v_body_of ->> 'contest_outcome') like '%A decision has been made on the comment you contested on your opening ' || v_ref || '.%');
  insert into pg_temp.chk values ('invitation sentence', (v_body_of ->> 'invitation') like '%so you can register and manage openings for it.%');

  -- subjects are unchanged in shape
  insert into pg_temp.chk values ('subjects keep their shape',
    (v_body_of ->> 'closing_soon') like 'Closing in 3 days: %' and (v_body_of ->> 'expired') like 'Expired: %' and (v_body_of ->> 'golive_done') like 'Now live: %'
    and (v_body_of ->> 'golive_failed') like 'Scheduled go-live did not happen: %' and (v_body_of ->> 'comments') like 'New candidate comments on %'
    and (v_body_of ->> 'contest_filed') like 'Comment contest filed: %' and (v_body_of ->> 'contest_outcome') like 'Contest decision: %'
    and (v_body_of ->> 'invitation') like 'You have been added to ZZ Org on FightGhostJobs%');

  -- the function itself
  insert into pg_temp.chk select 'function is security definer', p.prosecdef from pg_proc p where p.oid = 'public.email_render(text, uuid, jsonb)'::regprocedure;
  insert into pg_temp.chk select 'function is stable', p.provolatile = 's' from pg_proc p where p.oid = 'public.email_render(text, uuid, jsonb)'::regprocedure;
  insert into pg_temp.chk select 'search_path is empty', coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p where p.oid = 'public.email_render(text, uuid, jsonb)'::regprocedure;
  insert into pg_temp.chk values ('service_role can execute', has_function_privilege('service_role', 'public.email_render(text, uuid, jsonb)', 'execute'));
  insert into pg_temp.chk values ('anon, authenticated and public cannot execute',
    not has_function_privilege('anon', 'public.email_render(text, uuid, jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.email_render(text, uuid, jsonb)', 'execute'));

  select count(*), coalesce(array_agg(name) filter (where not ok), '{}') into n, fails from pg_temp.chk;
  raise exception 'OPENING WORDING TEST RESULT %', jsonb_build_object('checks', n, 'failures', to_jsonb(fails))::text;
end
$t$;
