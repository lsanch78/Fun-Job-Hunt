create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";


  create table "public"."claude_rec_cache" (
    "id" uuid not null default gen_random_uuid(),
    "company_name" text not null,
    "title_bucket" text not null,
    "recommendations" jsonb not null default '[]'::jsonb,
    "fetched_at" timestamp with time zone not null default now(),
    "cache_hits" integer not null default 0
      );


alter table "public"."claude_rec_cache" enable row level security;


  create table "public"."company_contact_cache" (
    "id" uuid not null default gen_random_uuid(),
    "company_name" text not null,
    "contacts" jsonb not null default '[]'::jsonb,
    "fetched_at" timestamp with time zone not null default now(),
    "cache_hits" integer not null default 0,
    "cache_misses" integer not null default 0
      );


alter table "public"."company_contact_cache" enable row level security;


  create table "public"."recommended_contacts" (
    "id" uuid not null default gen_random_uuid(),
    "job_id" uuid not null,
    "user_id" uuid not null,
    "name" text not null,
    "title" text,
    "email" text,
    "linkedin_url" text,
    "company" text,
    "seniority" text,
    "why" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."recommended_contacts" enable row level security;

CREATE UNIQUE INDEX claude_rec_cache_company_name_title_bucket_key ON public.claude_rec_cache USING btree (company_name, title_bucket);

CREATE UNIQUE INDEX claude_rec_cache_pkey ON public.claude_rec_cache USING btree (id);

CREATE UNIQUE INDEX company_contact_cache_company_name_key ON public.company_contact_cache USING btree (company_name);

CREATE UNIQUE INDEX company_contact_cache_pkey ON public.company_contact_cache USING btree (id);

CREATE UNIQUE INDEX recommended_contacts_pkey ON public.recommended_contacts USING btree (id);

alter table "public"."claude_rec_cache" add constraint "claude_rec_cache_pkey" PRIMARY KEY using index "claude_rec_cache_pkey";

alter table "public"."company_contact_cache" add constraint "company_contact_cache_pkey" PRIMARY KEY using index "company_contact_cache_pkey";

alter table "public"."recommended_contacts" add constraint "recommended_contacts_pkey" PRIMARY KEY using index "recommended_contacts_pkey";

alter table "public"."claude_rec_cache" add constraint "claude_rec_cache_company_name_title_bucket_key" UNIQUE using index "claude_rec_cache_company_name_title_bucket_key";

alter table "public"."company_contact_cache" add constraint "company_contact_cache_company_name_key" UNIQUE using index "company_contact_cache_company_name_key";

alter table "public"."recommended_contacts" add constraint "recommended_contacts_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE not valid;

alter table "public"."recommended_contacts" validate constraint "recommended_contacts_job_id_fkey";

alter table "public"."recommended_contacts" add constraint "recommended_contacts_seniority_check" CHECK ((seniority = ANY (ARRAY['peer'::text, 'manager'::text]))) not valid;

alter table "public"."recommended_contacts" validate constraint "recommended_contacts_seniority_check";

alter table "public"."recommended_contacts" add constraint "recommended_contacts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."recommended_contacts" validate constraint "recommended_contacts_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.count_user_contacts(p_user_id uuid)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT count(*) FROM public.contacts WHERE user_id = p_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_global_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select json_build_object(
    -- Users currently job-hunting: have at least one job not in a terminal status
    'hunters',
    (
      select count(distinct user_id)
      from public.jobs
      where status in ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW')
    ),

    -- Users who landed a job: have at least one OFFER
    'employed',
    (
      select count(distinct user_id)
      from public.jobs
      where status = 'OFFER'
    ),

    -- Total interview-stage events across all users
    'interviews',
    (
      select count(*)
      from public.jobs
      where status in ('PHONE_SCREEN', 'INTERVIEW', 'OFFER')
    ),

    -- Average interview conversion rate per user (apps → interview+)
    -- Computed as: for each user with ≥1 app, calc their rate, then average
    'avg_interview_rate',
    (
      select round(avg(rate)::numeric, 1)
      from (
        select
          user_id,
          count(*) filter (where status in ('PHONE_SCREEN','INTERVIEW','OFFER'))::float
            / nullif(count(*), 0) * 100 as rate
        from public.jobs
        group by user_id
        having count(*) >= 3   -- only users with meaningful sample size
      ) rates
    ),

    -- Average days to first OFFER per user who received one
    'avg_days_to_offer',
    (
      select round(avg(days_diff)::numeric, 0)
      from (
        select
          j.user_id,
          min(now()::date - j.date_applied::date) as days_diff
        from public.jobs j
        where j.status = 'OFFER'
        group by j.user_id
      ) offer_days
    ),

    -- Total applications submitted across the platform
    'total_apps',
    (
      select count(*) from public.jobs
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.game_progress (user_id, xp, updated_at)
    values (p_user_id, p_delta, now())
  on conflict (user_id) do update
    set xp = public.game_progress.xp + p_delta,
        updated_at = now();
end;
$function$
;

grant delete on table "public"."claude_rec_cache" to "anon";

grant insert on table "public"."claude_rec_cache" to "anon";

grant references on table "public"."claude_rec_cache" to "anon";

grant select on table "public"."claude_rec_cache" to "anon";

grant trigger on table "public"."claude_rec_cache" to "anon";

grant truncate on table "public"."claude_rec_cache" to "anon";

grant update on table "public"."claude_rec_cache" to "anon";

grant delete on table "public"."claude_rec_cache" to "authenticated";

grant insert on table "public"."claude_rec_cache" to "authenticated";

grant references on table "public"."claude_rec_cache" to "authenticated";

grant select on table "public"."claude_rec_cache" to "authenticated";

grant trigger on table "public"."claude_rec_cache" to "authenticated";

grant truncate on table "public"."claude_rec_cache" to "authenticated";

grant update on table "public"."claude_rec_cache" to "authenticated";

grant delete on table "public"."claude_rec_cache" to "service_role";

grant insert on table "public"."claude_rec_cache" to "service_role";

grant references on table "public"."claude_rec_cache" to "service_role";

grant select on table "public"."claude_rec_cache" to "service_role";

grant trigger on table "public"."claude_rec_cache" to "service_role";

grant truncate on table "public"."claude_rec_cache" to "service_role";

grant update on table "public"."claude_rec_cache" to "service_role";

grant delete on table "public"."company_contact_cache" to "anon";

grant insert on table "public"."company_contact_cache" to "anon";

grant references on table "public"."company_contact_cache" to "anon";

grant select on table "public"."company_contact_cache" to "anon";

grant trigger on table "public"."company_contact_cache" to "anon";

grant truncate on table "public"."company_contact_cache" to "anon";

grant update on table "public"."company_contact_cache" to "anon";

grant delete on table "public"."company_contact_cache" to "authenticated";

grant insert on table "public"."company_contact_cache" to "authenticated";

grant references on table "public"."company_contact_cache" to "authenticated";

grant select on table "public"."company_contact_cache" to "authenticated";

grant trigger on table "public"."company_contact_cache" to "authenticated";

grant truncate on table "public"."company_contact_cache" to "authenticated";

grant update on table "public"."company_contact_cache" to "authenticated";

grant delete on table "public"."company_contact_cache" to "service_role";

grant insert on table "public"."company_contact_cache" to "service_role";

grant references on table "public"."company_contact_cache" to "service_role";

grant select on table "public"."company_contact_cache" to "service_role";

grant trigger on table "public"."company_contact_cache" to "service_role";

grant truncate on table "public"."company_contact_cache" to "service_role";

grant update on table "public"."company_contact_cache" to "service_role";

grant delete on table "public"."recommended_contacts" to "anon";

grant insert on table "public"."recommended_contacts" to "anon";

grant references on table "public"."recommended_contacts" to "anon";

grant select on table "public"."recommended_contacts" to "anon";

grant trigger on table "public"."recommended_contacts" to "anon";

grant truncate on table "public"."recommended_contacts" to "anon";

grant update on table "public"."recommended_contacts" to "anon";

grant delete on table "public"."recommended_contacts" to "authenticated";

grant insert on table "public"."recommended_contacts" to "authenticated";

grant references on table "public"."recommended_contacts" to "authenticated";

grant select on table "public"."recommended_contacts" to "authenticated";

grant trigger on table "public"."recommended_contacts" to "authenticated";

grant truncate on table "public"."recommended_contacts" to "authenticated";

grant update on table "public"."recommended_contacts" to "authenticated";

grant delete on table "public"."recommended_contacts" to "service_role";

grant insert on table "public"."recommended_contacts" to "service_role";

grant references on table "public"."recommended_contacts" to "service_role";

grant select on table "public"."recommended_contacts" to "service_role";

grant trigger on table "public"."recommended_contacts" to "service_role";

grant truncate on table "public"."recommended_contacts" to "service_role";

grant update on table "public"."recommended_contacts" to "service_role";


  create policy "Service role can insert"
  on "public"."recommended_contacts"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users see own contacts"
  on "public"."recommended_contacts"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


drop policy "resumes_delete_policy" on "storage"."objects";

drop policy "resumes_read_policy" on "storage"."objects";

drop policy "resumes_update_policy" on "storage"."objects";

drop policy "resumes_upload_policy" on "storage"."objects";


