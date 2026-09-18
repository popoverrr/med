import { t, localePath, type Locale } from '@/lib/i18n';

export function formStrings(locale: Locale) {
  const dict = t(locale);
  return {
    ...dict.forms.booking,
    consentHref: localePath(locale, '/legal/consent'),
    privacyHref: localePath(locale, '/legal/privacy'),
  };
}
export type BookingStrings = ReturnType<typeof formStrings>;

export function contactStrings(locale: Locale) {
  const dict = t(locale);
  return {
    ...dict.forms.contact,
    consent: dict.forms.booking.consent,
    consentLink: dict.forms.booking.consentLink,
    consentAnd: dict.forms.booking.consentAnd,
    privacyLink: dict.forms.booking.privacyLink,
    consentError: dict.forms.booking.errors.consent,
    nameError: dict.forms.booking.errors.name,
    submitting: dict.forms.booking.submitting,
    errorTitle: dict.forms.booking.errorTitle,
    errorText: dict.forms.booking.errorText,
    again: dict.forms.booking.again,
    rate: dict.forms.booking.errors.rate,
    network: dict.forms.booking.errors.network,
    consentHref: localePath(locale, '/legal/consent'),
    privacyHref: localePath(locale, '/legal/privacy'),
  };
}
export type ContactStrings = ReturnType<typeof contactStrings>;
