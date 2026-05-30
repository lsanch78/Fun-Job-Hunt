-- 1. DB-level length constraints on contacts columns
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_name_length     CHECK (char_length(name)     <= 100),
  ADD CONSTRAINT contacts_company_length  CHECK (char_length(company)  <= 100),
  ADD CONSTRAINT contacts_linkedin_length CHECK (char_length(linkedin) <= 200),
  ADD CONSTRAINT contacts_github_length   CHECK (char_length(github)   <= 100),
  ADD CONSTRAINT contacts_twitter_length  CHECK (char_length(twitter)  <= 100),
  ADD CONSTRAINT contacts_discord_length  CHECK (char_length(discord)  <= 100),
  ADD CONSTRAINT contacts_email_length    CHECK (char_length(email)    <= 200),
  ADD CONSTRAINT contacts_notes_length    CHECK (char_length(notes)    <= 1000);

-- 2. Security definer function to count contacts without triggering RLS recursion
CREATE OR REPLACE FUNCTION count_user_contacts(p_user_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.contacts WHERE user_id = p_user_id;
$$;

-- 3. Cap contacts per user at 500 via RLS INSERT policy
DROP POLICY IF EXISTS "contacts_owner_policy" ON public.contacts;

CREATE POLICY "contacts_owner_policy" ON public.contacts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND count_user_contacts(auth.uid()) < 500
  );
