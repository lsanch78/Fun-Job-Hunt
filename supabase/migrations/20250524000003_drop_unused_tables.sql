-- Drop tables from the initial schema that are no longer used.
-- Keeping only: jobs, workdays (actively used by services).

drop table if exists application_records;
drop table if exists job_postings;
drop table if exists form_answer_map;
drop table if exists resume;
drop table if exists search_profiles;
