import type { ContactInfo } from '@effjobhunt/shared';
import { FormField } from './FormField';

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface Props {
  contact: Partial<ContactInfo>;
  onChange: (updated: Partial<ContactInfo>) => void;
  errors?: Partial<Record<keyof ContactInfo, string[]>>;
}

export function ContactSection({ contact, onChange, errors }: Props) {
  function field(key: keyof ContactInfo) {
    return (value: string) => onChange({ ...contact, [key]: value });
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Contact</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="contact-name" label="Full name *" error={errors?.['name']?.[0]}>
          <input
            id="contact-name"
            type="text"
            className={INPUT}
            value={contact.name ?? ''}
            onChange={(e) => field('name')(e.target.value)}
            maxLength={120}
            required
          />
        </FormField>

        <FormField id="contact-email" label="Email *" error={errors?.['email']?.[0]}>
          <input
            id="contact-email"
            type="email"
            className={INPUT}
            value={contact.email ?? ''}
            onChange={(e) => field('email')(e.target.value)}
            maxLength={120}
            required
          />
        </FormField>

        <FormField id="contact-phone" label="Phone" error={errors?.['phone']?.[0]}>
          <input
            id="contact-phone"
            type="tel"
            className={INPUT}
            value={contact.phone ?? ''}
            onChange={(e) => field('phone')(e.target.value)}
            maxLength={30}
          />
        </FormField>

        <FormField id="contact-location" label="Location" error={errors?.['location']?.[0]}>
          <input
            id="contact-location"
            type="text"
            className={INPUT}
            value={contact.location ?? ''}
            onChange={(e) => field('location')(e.target.value)}
            maxLength={120}
            placeholder="City, State"
          />
        </FormField>

        <FormField
          id="contact-linkedin"
          label="LinkedIn URL"
          error={errors?.['linkedin']?.[0]}
        >
          <input
            id="contact-linkedin"
            type="url"
            className={`${INPUT} sm:col-span-2`}
            value={contact.linkedin ?? ''}
            onChange={(e) => field('linkedin')(e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </FormField>
      </div>
    </section>
  );
}
