-- contacts table
CREATE TABLE public.contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  company             VARCHAR(100),
  linkedin            VARCHAR(200),
  github              VARCHAR(100),
  twitter             VARCHAR(100),
  discord             VARCHAR(100),
  email               VARCHAR(200),
  notes               VARCHAR(1000),
  last_interaction_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_owner_policy" ON public.contacts
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX contacts_user_id_idx ON public.contacts(user_id);

-- job_contacts junction table
CREATE TABLE public.job_contacts (
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, contact_id)
);

ALTER TABLE public.job_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_contacts_owner_policy" ON public.job_contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE INDEX job_contacts_job_id_idx     ON public.job_contacts(job_id);
CREATE INDEX job_contacts_contact_id_idx ON public.job_contacts(contact_id);

-- drop the old plain-text contacts column
ALTER TABLE public.jobs DROP COLUMN contacts;
