alter table public.master_codex rename to master_cv;

alter table public.master_cv
  rename constraint master_codex_user_id_key to master_cv_user_id_key;

drop policy "Users manage own master codex" on public.master_cv;

create policy "Users manage own master CV"
  on public.master_cv for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
