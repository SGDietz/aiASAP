-- Exact rollback for the aiASAP independent cloud watchdog only.
do $$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job_id in select jobid from cron.job where jobname = 'aiasap-cloud-heartbeat-watchdog'
    loop
      perform cron.unschedule(v_job_id);
    end loop;
  end if;
end;
$$;

drop function if exists public.aiasap_cloud_watchdog_tick(boolean);
drop table if exists public.aiasap_cloud_watchdog_checks;
drop table if exists public.aiasap_cloud_watchdog_state;

-- Extensions and Vault secrets are intentionally retained because they may be
-- shared by unrelated database features. Remove only the five exact
-- aiasap_watchdog_* Vault entries in a separately reviewed operation if needed.
