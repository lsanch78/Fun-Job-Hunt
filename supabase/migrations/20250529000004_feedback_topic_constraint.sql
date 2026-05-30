ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_topic_valid
    CHECK (topic IN ('User Interface', 'User Experience', 'Bug', 'Feature Idea', 'Other'));
