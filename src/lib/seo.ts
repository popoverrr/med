import company from '@content/config/company.json';
import contacts from '@content/config/contacts.json';
import { SITE_URL } from '@content/config/site.mjs';
import { t, localePath, type Locale } from '@/lib/i18n';
import { real } from '@/lib/utils/placeholders';

type JsonLd = Record<string, unknown>;

export function absolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** Организация + медицинская организация — на каждой странице. */
export function organizationLd(locale: Locale): JsonLd {
  const dict = t(locale);
  const phone = real(contacts.phone);
  const email = real(contacts.email);
  const hours = real(contacts.openingHoursSpec);
  const lat = real(contacts.geo.lat);
  const lng = real(contacts.geo.lng);

  const ld: JsonLd = {
    '@context': 'https://schema.org',
    '@type': ['MedicalClinic', 'MedicalBusiness', 'Organization'],
    '@id': `${SITE_URL}/#organization`,
    name: 'Hydromed',
    legalName: company.legalName[locale],
    alternateName: company.legalNameShort[locale],
    url: absolute(localePath(locale, '/')),
    logo: absolute('/media/logo-512.png'),
    image: absolute(`/media/og-image-${locale}-1200.jpg`),
    description: dict.seo.home.description,
    identifier: { '@type': 'PropertyValue', propertyID: 'BIN', value: company.bin },
    address: {
      '@type': 'PostalAddress',
      streetAddress: company.address.street[locale],
      addressLocality: company.address.region[locale],
      postalCode: company.address.postalCode,
      addressCountry: 'KZ',
    },
    medicalSpecialty: 'Gastroenterologic',
    availableService: {
      '@type': 'MedicalProcedure',
      '@id': `${SITE_URL}/#procedure`,
      name: locale === 'kk' ? 'Гидроколонотерапия' : 'Гидроколонотерапия',
    },
    hasCredential: [
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: locale === 'kk' ? 'Медициналық қызметке лицензия' : 'Лицензия на медицинскую деятельность',
        identifier: company.license.number,
        dateCreated: company.license.issued,
        recognizedBy: { '@type': 'GovernmentOrganization', name: company.license.licensor[locale] },
        url: absolute(localePath(locale, '/legal/license')),
      },
    ],
    employee: {
      '@type': 'Person',
      name: company.specialist.name[locale],
      jobTitle: company.specialist.role[locale],
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: company.specialist.certificate.kind[locale],
        identifier: company.specialist.certificate.number,
        recognizedBy: { '@type': 'Organization', name: company.specialist.certificate.issuer[locale] },
      },
    },
    isAcceptingNewPatients: true,
    currenciesAccepted: 'KZT',
    priceRange: '₸₸',
  };
  if (phone) ld.telephone = phone;
  if (email) ld.email = email;
  if (hours) ld.openingHours = hours;
  if (lat && lng) ld.geo = { '@type': 'GeoCoordinates', latitude: Number(lat), longitude: Number(lng) };
  return ld;
}

export function procedureLd(locale: Locale): JsonLd {
  const dict = t(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    '@id': `${SITE_URL}/#procedure`,
    name: dict.pages.procedure.h1,
    alternateName: locale === 'kk' ? ['Ішекті шаю', 'Колоногидротерапия'] : ['Кишечное орошение', 'Колоногидротерапия'],
    description: dict.pages.procedure.lead,
    procedureType: 'https://schema.org/NoninvasiveProcedure',
    bodyLocation: locale === 'kk' ? 'Тоқ ішек' : 'Толстый кишечник',
    howPerformed: dict.home.how.steps.map((s) => s.title + ': ' + s.text).join(' '),
    preparation: dict.pages.procedure.sections.prep.items.join(' '),
    followup: dict.pages.procedure.sections.after.items.join(' '),
    contraindication: dict.home.contra.groups.flatMap((g) => g.items).map((name) => ({ '@type': 'MedicalContraindication', name })),
    url: absolute(localePath(locale, '/procedure')),
    provider: { '@id': `${SITE_URL}/#organization` },
  };
}

export function faqLd(locale: Locale): JsonLd {
  const dict = t(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dict.home.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function breadcrumbLd(locale: Locale, crumbs: Array<{ name: string; path: string }>): JsonLd {
  const dict = t(locale);
  const all = [{ name: dict.common.breadcrumbHome, path: '/' }, ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absolute(localePath(locale, c.path)),
    })),
  };
}

export function webPageLd(locale: Locale, path: string, title: string, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: absolute(localePath(locale, path)),
    name: title,
    description,
    inLanguage: locale === 'kk' ? 'kk-KZ' : 'ru-KZ',
    isPartOf: { '@type': 'WebSite', url: SITE_URL, name: 'Hydromed', publisher: { '@id': `${SITE_URL}/#organization` } },
  };
}
