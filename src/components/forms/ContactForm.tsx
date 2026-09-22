import { useId, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import type { ContactStrings } from './strings';
import { submitForm } from './shared';
import { withBase } from '@/lib/base';

interface Props {
  strings: ContactStrings;
  locale: 'ru' | 'kk';
  endpoint?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';
type Errors = Partial<Record<'name' | 'contact' | 'message' | 'consent' | 'form', string>>;
const EASE = [0.16, 1, 0.3, 1] as const;

export default function ContactForm({ strings: s, locale, endpoint = withBase('/api/contact.php') }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const startedAt = useRef(Date.now());
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = s.nameError;
    const c = contact.trim();
    const okPhone = /^\+?[\d\s()-]{10,}$/.test(c);
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
    if (!okPhone && !okMail) e.contact = s.errors.contact;
    if (message.trim().length < 10) e.message = s.errors.message;
    if (!consent) e.consent = s.consentError;
    return e;
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const form = ev.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStatus('submitting');
    const r = await submitForm(endpoint, {
      form: 'contact',
      locale,
      name: name.trim(),
      contact: contact.trim(),
      message: message.trim(),
      consent,
      website,
      elapsed: Date.now() - startedAt.current,
      page: typeof location !== 'undefined' ? location.pathname : '',
    });
    if (r.ok) return setStatus('success');
    setStatus('error');
    if (r.code === 'validation' && r.fields) { setErrors(r.fields as Errors); setStatus('idle'); }
    else if (r.code === 'rate') setErrors({ form: s.rate });
    else if (r.code === 'network') setErrors({ form: s.network });
    else setErrors({ form: s.errorText });
  }

  const describe = (k: keyof Errors) => (errors[k] ? `${id}-${k}-err` : undefined);

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="bf bf--light">
      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          <m.div key="ok" className="bf__success" role="status" aria-live="polite" initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.2 : 0.56, ease: EASE }}>
            <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" className="bf__check">
              <m.circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE }} />
              <m.path d="M20 33l8 8 16-17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: reduce ? 0 : 0.5, ease: EASE }} />
            </svg>
            <p className="bf__success-title">{s.successTitle}</p>
            <p className="bf__success-text">{s.successText}</p>
          </m.div>
        ) : (
          <m.form key="f" className="bf__form" noValidate onSubmit={onSubmit} initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.24 }} aria-busy={status === 'submitting'}>
            <div className="bf__row">
              <div className="bf__field">
                <label htmlFor={`${id}-name`} className="bf__label">{s.name} <span aria-hidden="true">*</span></label>
                <input id={`${id}-name`} name="name" type="text" autoComplete="name" required className="field" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={describe('name')} maxLength={80} />
                {errors.name && <p id={`${id}-name-err`} className="bf__error" role="alert">{errors.name}</p>}
              </div>
              <div className="bf__field">
                <label htmlFor={`${id}-contact`} className="bf__label">{s.contact} <span aria-hidden="true">*</span></label>
                <input id={`${id}-contact`} name="contact" type="text" autoComplete="tel email" required className="field" value={contact} onChange={(e) => setContact(e.target.value)} aria-invalid={errors.contact ? 'true' : undefined} aria-describedby={describe('contact')} maxLength={120} />
                {errors.contact && <p id={`${id}-contact-err`} className="bf__error" role="alert">{errors.contact}</p>}
              </div>
            </div>
            <div className="bf__field">
              <label htmlFor={`${id}-message`} className="bf__label">{s.message} <span aria-hidden="true">*</span></label>
              <textarea id={`${id}-message`} name="message" rows={4} required className="field" placeholder={s.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={errors.message ? 'true' : undefined} aria-describedby={describe('message')} maxLength={2000} />
              {errors.message && <p id={`${id}-message-err`} className="bf__error" role="alert">{errors.message}</p>}
            </div>
            <div className="bf__hp" aria-hidden="true">
              <label htmlFor={`${id}-website`}>Website</label>
              <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="bf__consent">
              <input id={`${id}-consent`} name="consent" type="checkbox" className="bf__checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={errors.consent ? 'true' : undefined} aria-describedby={describe('consent')} />
              <label htmlFor={`${id}-consent`} className="bf__consent-label">
                {s.consent} <a href={s.consentHref} className="link-u" target="_blank" rel="noopener">{s.consentLink}</a> {s.consentAnd} <a href={s.privacyHref} className="link-u" target="_blank" rel="noopener">{s.privacyLink}</a>
              </label>
            </div>
            {errors.consent && <p id={`${id}-consent-err`} className="bf__error" role="alert">{errors.consent}</p>}
            {s.disabledNotice && <p className="bf__notice" role="note">{s.disabledNotice}</p>}
            <div className="bf__actions">
              <button type="submit" className="btn btn-primary bf__submit" disabled={status === 'submitting' || !!s.disabledNotice}>{status === 'submitting' ? s.submitting : s.submit}</button>
              <p className="bf__status" aria-live="polite" role="status">{status === 'error' && errors.form ? errors.form : ''}</p>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </div>
    </LazyMotion>
  );
}
