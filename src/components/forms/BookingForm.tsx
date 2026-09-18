import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import type { BookingStrings } from './strings';
import { formatPhone, isValidPhone, submitForm, todayISO } from './shared';

interface Props {
  strings: BookingStrings;
  locale: 'ru' | 'kk';
  compact?: boolean;
  endpoint?: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';
type Errors = Partial<Record<'name' | 'phone' | 'date' | 'consent' | 'form', string>>;

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BookingForm({ strings: s, locale, compact = false, endpoint = '/api/booking.php' }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const startedAt = useRef<number>(Date.now());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(s.serviceOptions[0]?.value ?? 'consultation');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(s.timeOptions[0]?.value ?? 'morning');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');
  const minDate = useMemo(() => todayISO(), []);

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = s.errors.name;
    if (!isValidPhone(phone)) e.phone = s.errors.phone;
    if (date && date < minDate) e.date = s.errors.date;
    if (!consent) e.consent = s.errors.consent;
    return e;
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      // Фокус на первое поле с ошибкой — после коммита React (aria-invalid появится в DOM)
      const form = ev.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStatus('submitting');
    const result = await submitForm(endpoint, {
      form: 'booking',
      locale,
      name: name.trim(),
      phone,
      service,
      date,
      time,
      comment: comment.trim(),
      consent,
      website,
      elapsed: Date.now() - startedAt.current,
      page: typeof location !== 'undefined' ? location.pathname : '',
    });
    if (result.ok) {
      setStatus('success');
      return;
    }
    setStatus('error');
    if (result.code === 'validation' && result.fields) {
      setErrors(Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k, v])) as Errors);
      setStatus('idle');
    } else if (result.code === 'rate') {
      setErrors({ form: s.errors.rate });
    } else if (result.code === 'network') {
      setErrors({ form: s.errors.network });
    } else {
      setErrors({ form: s.errorText });
    }
  }

  function reset() {
    setStatus('idle');
    setErrors({});
    startedAt.current = Date.now();
  }

  const fieldClass = 'field';
  const describe = (key: keyof Errors) => (errors[key] ? `${id}-${key}-err` : undefined);

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="bf" data-lenis-prevent>
      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          <m.div
            key="success"
            className="bf__success"
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.56, ease: EASE }}
          >
            <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" className="bf__check">
              <m.circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE }} />
              <m.path d="M20 33l8 8 16-17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: reduce ? 0 : 0.5, ease: EASE }} />
            </svg>
            <p className="bf__success-title">{s.successTitle}</p>
            <p className="bf__success-text">{s.successText}</p>
            <button type="button" className="btn btn-secondary-on-dark bf__again" onClick={reset}>{s.again}</button>
          </m.div>
        ) : (
          <m.form
            key="form"
            className={compact ? 'bf__form bf__form--compact' : 'bf__form'}
            noValidate
            onSubmit={onSubmit}
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            aria-busy={status === 'submitting'}
          >
            <div className="bf__row">
              <div className="bf__field">
                <label htmlFor={`${id}-name`} className="bf__label">{s.name} <span aria-hidden="true">*</span></label>
                <input
                  id={`${id}-name`}
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={fieldClass}
                  placeholder={s.namePlaceholder}
                  data-autofocus={compact ? '' : undefined}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={describe('name')}
                  maxLength={80}
                />
                {errors.name && <p id={`${id}-name-err`} className="bf__error" role="alert">{errors.name}</p>}
              </div>
              <div className="bf__field">
                <label htmlFor={`${id}-phone`} className="bf__label">{s.phone} <span aria-hidden="true">*</span></label>
                <input
                  id={`${id}-phone`}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className={fieldClass}
                  placeholder={s.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  onFocus={() => { if (!phone) setPhone('+7 '); }}
                  onBlur={() => { if (phone.trim() === '+7') setPhone(''); }}
                  aria-invalid={errors.phone ? 'true' : undefined}
                  aria-describedby={errors.phone ? `${id}-phone-err` : `${id}-phone-hint`}
                />
                {errors.phone
                  ? <p id={`${id}-phone-err`} className="bf__error" role="alert">{errors.phone}</p>
                  : <p id={`${id}-phone-hint`} className="bf__hint">{s.phoneHint}</p>}
              </div>
            </div>

            <div className="bf__row">
              <div className="bf__field">
                <label htmlFor={`${id}-service`} className="bf__label">{s.service}</label>
                <select id={`${id}-service`} name="service" className={fieldClass} value={service} onChange={(e) => setService(e.target.value)}>
                  {s.serviceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="bf__field bf__field--half">
                <label htmlFor={`${id}-date`} className="bf__label">{s.date}</label>
                <input id={`${id}-date`} name="date" type="date" className={fieldClass} min={minDate} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={errors.date ? 'true' : undefined} aria-describedby={describe('date')} />
                {errors.date && <p id={`${id}-date-err`} className="bf__error" role="alert">{errors.date}</p>}
              </div>
              <div className="bf__field bf__field--half">
                <label htmlFor={`${id}-time`} className="bf__label">{s.time}</label>
                <select id={`${id}-time`} name="time" className={fieldClass} value={time} onChange={(e) => setTime(e.target.value)}>
                  {s.timeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {!compact && (
              <div className="bf__field">
                <label htmlFor={`${id}-comment`} className="bf__label">{s.comment}</label>
                <textarea id={`${id}-comment`} name="comment" rows={3} className={fieldClass} placeholder={s.commentPlaceholder} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
              </div>
            )}

            {/* Honeypot: скрыт от людей, роботы заполняют */}
            <div className="bf__hp" aria-hidden="true">
              <label htmlFor={`${id}-website`}>Website</label>
              <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <div className="bf__consent">
              <input
                id={`${id}-consent`}
                name="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={errors.consent ? 'true' : undefined}
                aria-describedby={describe('consent')}
                className="bf__checkbox"
              />
              <label htmlFor={`${id}-consent`} className="bf__consent-label">
                {s.consent} <a href={s.consentHref} className="link-u" target="_blank" rel="noopener">{s.consentLink}</a> {s.consentAnd} <a href={s.privacyHref} className="link-u" target="_blank" rel="noopener">{s.privacyLink}</a>
              </label>
            </div>
            {errors.consent && <p id={`${id}-consent-err`} className="bf__error" role="alert">{errors.consent}</p>}

            <div className="bf__actions">
              <m.button
                type="submit"
                className="btn btn-primary-on-dark bf__submit"
                disabled={status === 'submitting'}
                whileTap={reduce ? undefined : { scale: 0.98 }}
              >
                {status === 'submitting' ? s.submitting : s.submit}
              </m.button>
              <p className="bf__status" aria-live="polite" role="status">
                {status === 'error' && errors.form ? errors.form : ''}
              </p>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </div>
    </LazyMotion>
  );
}
