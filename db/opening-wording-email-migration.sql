-- opening-wording-email-migration.sql  THE EMAIL WORDING CHANGE (real run)  (written October 8, 2026)
-- NOT RUN ANYWHERE. Nothing was applied to stage, alpha or any other database when this file was written.
-- WHICH ENVIRONMENT: Supabase STAGE project (tpmvkjuhbbwftqoodzcn), SQL editor, signed in with the STAGE account (the yahoo one). Alpha only when John says so, with the alpha guard (sql-guards\project-guard-alpha.sql) pasted in place of the stage one.
-- WHAT IT CHANGES: ONLY the sentences of public.email_render(text, uuid, jsonb) that the owner's Oct 8, 2026 wording decision covers (an opening, not a posting; Opening ID, not postID; an employer, not a poster). 18 edits, listed below.
-- WHAT IT NEVER TOUCHES: any table, any row, the email outbox (public.email_outbox stores subject and body_text when an email is queued, so emails already queued keep the old wording; only emails queued after the run use the new wording), any other function, the grants, the Supabase Auth email templates.
-- HOW IT WORKS: it reads the stored definition with pg_get_functiondef, replaces each of the 18 exact texts below (each must occur EXACTLY once or the script stops and changes nothing), re-creates the function from that text, then re-reads it and proves that the security definer flag, volatility, search_path and grants are unchanged and that undoing the 18 edits gives back exactly the text it started with.
-- THE 18 EDITS (kind, old text -> new text):
--    1. [invitation]  "so you can register and manage job postings for it."  ->  "so you can register and manage openings for it."
--    2. [closing_soon]  "'Your posting ' || v_ref || ' closes on '"  ->  "'Your opening ' || v_ref || ' closes on '"
--    3. [closing_soon]  "register it again as a new posting. If it has been filled"  ->  "register it again as a new opening. If it has been filled"
--    4. [closing_soon]  "'A posting can be extended once, by up to 15 days, from My postings.'"  ->  "'An opening can be extended once, by up to 15 days, from My openings.'"
--    5. [expired]  "'Your posting ' || v_ref || ' reached its close date"  ->  "'Your opening ' || v_ref || ' reached its close date"
--    6. [expired]  "register it again as a new posting: "  ->  "register it again as a new opening: "
--    7. [golive_done]  "'Your scheduled posting ' || v_ref"  ->  "'Your scheduled opening ' || v_ref"
--    8. [golive_done]  "'Manage it from My postings: '"  ->  "'Manage it from My openings: '"
--    9. [golive_failed]  "'Your posting ' || v_ref || ' was due to go live"  ->  "'Your opening ' || v_ref || ' was due to go live"
--   10. [golive_failed]  "remove the schedule from My postings: "  ->  "remove the schedule from My openings: "
--   11. [comments]  "new comments on your posting ' || v_ref"  ->  "new comments on your opening ' || v_ref"
--   12. [comments]  "'Read them from My postings: '"  ->  "'Read them from My openings: '"
--   13. [comments]  "at most one of these emails per posting every 6 hours."  ->  "at most one of these emails per opening every 6 hours."
--   14. [contest_filed]  "'A poster contested a comment on a posting.'"  ->  "'An employer contested a comment on an opening.'"
--   15. [contest_filed]  "'Posting: ' || v_ref"  ->  "'Opening: ' || v_ref"
--   16. [contest_outcome]  "you contested on your posting ' || v_ref"  ->  "you contested on your opening ' || v_ref"
--   17. [all kinds that name an opening (the reference)]  "' (postID '"  ->  "' (Opening ID '"
--   18. [footer (all kinds)]  "emails about postings and rosters"  ->  "emails about openings and rosters"
-- THE TWO FILES (opening-wording-email-migration-dryrun.sql and opening-wording-email-migration.sql) are the SAME text except the LAST lines of the DO block: the dry run raises its result line (so the change is rolled back), the real run ends normally and commits.
-- ORDER OF WORK: 1) paste the WHOLE dry run file, run it ONCE; the expected answer is an error that starts  OPENING WORDING DRY RUN OK - rolled back, nothing was changed  2) paste the WHOLE real file, run it ONCE; the last result row says  email_render now uses the opening wording: true  3) paste opening-wording-email-test.sql and run it: it must end with an error that reads  OPENING WORDING TEST RESULT {...}  with failures empty (the error is how it rolls itself back).
-- If anything else appears (a PROJECT GUARD message, a message starting OPENING WORDING MIGRATION FAILED), nothing was changed: send the whole message to Claude. To undo after a real run: opening-wording-email-rollback.sql.
-- THE PROJECT GUARD below is the text of sql-guards\project-guard-stage.sql, unchanged: it stops the script at once if the editor is open on the wrong project.

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

do $m$
declare
  v_sig constant regprocedure := to_regprocedure('public.email_render(text, uuid, jsonb)');
  v_from text[] := array[
    $a$so you can register and manage job postings for it.$a$,
    $a$'Your posting ' || v_ref || ' closes on '$a$,
    $a$register it again as a new posting. If it has been filled$a$,
    $a$'A posting can be extended once, by up to 15 days, from My postings.'$a$,
    $a$'Your posting ' || v_ref || ' reached its close date$a$,
    $a$register it again as a new posting: $a$,
    $a$'Your scheduled posting ' || v_ref$a$,
    $a$'Manage it from My postings: '$a$,
    $a$'Your posting ' || v_ref || ' was due to go live$a$,
    $a$remove the schedule from My postings: $a$,
    $a$new comments on your posting ' || v_ref$a$,
    $a$'Read them from My postings: '$a$,
    $a$at most one of these emails per posting every 6 hours.$a$,
    $a$'A poster contested a comment on a posting.'$a$,
    $a$'Posting: ' || v_ref$a$,
    $a$you contested on your posting ' || v_ref$a$,
    $a$' (postID '$a$,
    $a$emails about postings and rosters$a$
  ]::text[];
  v_to text[] := array[
    $a$so you can register and manage openings for it.$a$,
    $a$'Your opening ' || v_ref || ' closes on '$a$,
    $a$register it again as a new opening. If it has been filled$a$,
    $a$'An opening can be extended once, by up to 15 days, from My openings.'$a$,
    $a$'Your opening ' || v_ref || ' reached its close date$a$,
    $a$register it again as a new opening: $a$,
    $a$'Your scheduled opening ' || v_ref$a$,
    $a$'Manage it from My openings: '$a$,
    $a$'Your opening ' || v_ref || ' was due to go live$a$,
    $a$remove the schedule from My openings: $a$,
    $a$new comments on your opening ' || v_ref$a$,
    $a$'Read them from My openings: '$a$,
    $a$at most one of these emails per opening every 6 hours.$a$,
    $a$'An employer contested a comment on an opening.'$a$,
    $a$'Opening: ' || v_ref$a$,
    $a$you contested on your opening ' || v_ref$a$,
    $a$' (Opening ID '$a$,
    $a$emails about openings and rosters$a$
  ]::text[];
  v_def text; v_new text; v_back text; v_re text;
  v_secdef boolean; v_vol "char"; v_cfg text[]; v_acl text;
  v_secdef2 boolean; v_vol2 "char"; v_cfg2 text[]; v_acl2 text;
  i int; c_from int; c_to int; v_done int := 0; v_todo int := 0;
begin
  perform set_config('lock_timeout', '15s', true);
  if v_sig is null then raise exception 'OPENING WORDING MIGRATION FAILED - NOTHING WAS CHANGED. public.email_render(text, uuid, jsonb) does not exist.'; end if;
  select p.prosecdef, p.provolatile, p.proconfig, p.proacl::text into v_secdef, v_vol, v_cfg, v_acl from pg_proc p where p.oid = v_sig;
  v_def := pg_get_functiondef(v_sig);
  v_new := v_def;
  for i in 1 .. array_length(v_from, 1) loop
    c_from := (length(v_new) - length(replace(v_new, v_from[i], ''))) / length(v_from[i]);
    c_to := (length(v_new) - length(replace(v_new, v_to[i], ''))) / length(v_to[i]);
    if c_from = 1 then
      v_new := replace(v_new, v_from[i], v_to[i]); v_todo := v_todo + 1;
    elsif c_from = 0 and c_to = 1 then
      v_done := v_done + 1;
    else
      raise exception 'OPENING WORDING MIGRATION FAILED - NOTHING WAS CHANGED. Edit % of 18: the text to replace was found % times (expected 1) and the new text % times. The function is not what this script was written against; send this message to Claude.', i, c_from, c_to;
    end if;
  end loop;
  if v_done > 0 and v_todo > 0 then
    raise exception 'OPENING WORDING MIGRATION FAILED - NOTHING WAS CHANGED. % of 18 edits are already in place and % are not: a half-applied state. Send this message to Claude.', v_done, v_todo;
  end if;
  if v_todo = 0 then
    raise notice 'OPENING WORDING MIGRATION: all 18 edits were already in place, nothing to do.';
    return;
  end if;
  execute v_new;
  -- re-read and prove: the new text is in, the properties and grants are unchanged, and undoing the 18 edits gives back exactly the text read at the start
  select p.prosecdef, p.provolatile, p.proconfig, p.proacl::text into v_secdef2, v_vol2, v_cfg2, v_acl2 from pg_proc p where p.oid = v_sig;
  v_re := pg_get_functiondef(v_sig);
  if v_re is distinct from v_new then raise exception 'OPENING WORDING MIGRATION FAILED - rolled back. The stored definition is not the text that was sent.'; end if;
  if v_secdef2 is distinct from v_secdef or v_vol2 is distinct from v_vol or v_cfg2 is distinct from v_cfg or v_acl2 is distinct from v_acl then
    raise exception 'OPENING WORDING MIGRATION FAILED - rolled back. Security definer, volatility, search_path or the grants changed.';
  end if;
  v_back := v_re;
  for i in 1 .. array_length(v_from, 1) loop v_back := replace(v_back, v_to[i], v_from[i]); end loop;
  if v_back is distinct from v_def then raise exception 'OPENING WORDING MIGRATION FAILED - rolled back. Something other than the 18 edits changed.'; end if;
  raise notice 'OPENING WORDING MIGRATION DONE: % of 18 edits applied.', v_todo;
end
$m$;

select position('postID' in pg_get_functiondef('public.email_render(text, uuid, jsonb)'::regprocedure)) = 0
   and position('Your posting' in pg_get_functiondef('public.email_render(text, uuid, jsonb)'::regprocedure)) = 0 as "email_render now uses the opening wording";
