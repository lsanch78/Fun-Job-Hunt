import { RESUME_SUMMARY_MAX } from '@effjobhunt/shared';
import { FormField } from './FormField';
import { CharCount } from './CharCount';

const TEXTAREA =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[100px]';

interface Props {
  summary: string;
  onChange: (value: string) => void;
  error?: string;
}

export function SummarySection({ summary, onChange, error }: Props) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Summary</h2>
      <FormField id="summary" label="Professional summary" error={error}>
        <textarea
          id="summary"
          className={TEXTAREA}
          value={summary}
          onChange={(e) => onChange(e.target.value)}
          maxLength={RESUME_SUMMARY_MAX}
        />
        <div className="flex justify-end">
          <CharCount value={summary} max={RESUME_SUMMARY_MAX} />
        </div>
      </FormField>
    </section>
  );
}
