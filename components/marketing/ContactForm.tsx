'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { CONTACT_EMAIL } from './content';

/**
 * Contact form. With no marketing backend endpoint, submission composes a
 * pre-filled `mailto:` so it works end-to-end against any mail client.
 */
/** All field styling lives in the `.mkt-field` foundation class. */
const FIELD = 'mkt-field';

export function ContactForm() {
  const t = useTranslations('marketing.pages.contact.form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent(
      t('mailSubject', { name: name.trim() || t('mailSubjectFallback') }),
    );
    const body = encodeURIComponent(`${message.trim()}\n\n- ${name.trim()}\n${email.trim()}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label
          htmlFor="contact-name"
          className="mb-1.5 block text-sm font-medium text-[var(--cr-neutral-700)]"
        >
          {t('nameLabel')}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('namePlaceholder')}
          className={FIELD}
        />
      </div>
      <div>
        <label
          htmlFor="contact-email"
          className="mb-1.5 block text-sm font-medium text-[var(--cr-neutral-700)]"
        >
          {t('emailLabel')}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('emailPlaceholder')}
          className={FIELD}
        />
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="mb-1.5 block text-sm font-medium text-[var(--cr-neutral-700)]"
        >
          {t('messageLabel')}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('messagePlaceholder')}
          className={`${FIELD} resize-y`}
        />
      </div>
      <button type="submit" className="mkt-btn mkt-btn--primary mkt-btn--lg mkt-btn--block">
        {t('submit')}
      </button>
      <p className="text-xs text-[var(--cr-neutral-500)]">{t('helper')}</p>
    </form>
  );
}
