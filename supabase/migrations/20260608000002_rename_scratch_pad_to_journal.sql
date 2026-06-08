alter table scratch_pad rename to journal;

alter policy "Users manage own scratch pad" on journal
  rename to "Users manage own journal";
