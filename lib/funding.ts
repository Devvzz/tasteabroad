// Exchange and scholarship facts per country. Kept per country on purpose: these schemes are national,
// and every link points to the official programme page (checked October 2026).

export interface Scholarship {
  name: string;
  url: string;
  /** Who it is mainly for, so nobody expects a bachelor's grant from a PhD scheme. */
  level: string;
}

export type ExchangeStatus = "programme" | "partner" | "semp";

// Erasmus+ programme countries in the dataset: EU members plus Turkey.
const ERASMUS_PROGRAMME = new Set(["AT", "BE", "CZ", "DE", "DK", "ES", "FI", "FR", "GR", "HU", "IE", "IT", "NL", "PL", "PT", "SE", "SI", "TR"]);

export function exchangeStatus(countryCode: string): ExchangeStatus | undefined {
  if (ERASMUS_PROGRAMME.has(countryCode)) return "programme";
  // Albania takes part as a partner country, through agreements between single universities.
  if (countryCode === "AL") return "partner";
  // Switzerland runs its own Swiss-European Mobility Programme alongside Erasmus+.
  if (countryCode === "CH") return "semp";
  return undefined;
}

/** Hungarian universities run by public trust foundations are currently cut off from Erasmus+ grants. */
export const ERASMUS_CAVEAT: Record<string, string> = { HU: "erasmusHungary" };

const ERASMUS_MUNDUS: Scholarship = {
  name: "Erasmus Mundus Joint Masters",
  url: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
  level: "Master's",
};

const NATIONAL: Record<string, Scholarship> = {
  AT: { name: "OeAD grants database", url: "https://grants.at/en/", level: "All levels" },
  AU: { name: "Australia Awards", url: "https://www.dfat.gov.au/people-to-people/australia-awards", level: "Bachelor's to PhD, selected countries" },
  CA: { name: "EduCanada scholarships", url: "https://www.educanada.ca/scholarships-bourses/index.aspx?lang=eng", level: "Mostly graduate" },
  CH: {
    name: "Swiss Government Excellence Scholarships",
    url: "https://www.sbfi.admin.ch/sbfi/en/home/education/scholarships-and-grants/swiss-government-excellence-scholarships.html",
    level: "PhD and research",
  },
  DE: { name: "DAAD scholarship database", url: "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/", level: "All levels" },
  FR: { name: "Eiffel Excellence Scholarship", url: "https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence", level: "Master's and PhD" },
  GB: { name: "Chevening Scholarships", url: "https://www.chevening.org/scholarships/", level: "Master's, selected countries" },
  HU: { name: "Stipendium Hungaricum", url: "https://stipendiumhungaricum.hu/", level: "Bachelor's to PhD, partner countries" },
  IE: {
    name: "Government of Ireland International Education Scholarships",
    url: "https://hea.ie/policy/internationalisation/goi-ies/",
    level: "Master's and PhD",
  },
  IN: { name: "ICCR scholarships", url: "https://a2ascholarships.iccr.gov.in/", level: "Bachelor's to PhD" },
  IT: { name: "Study in Italy: government scholarships", url: "https://studyinitaly.esteri.it/", level: "Master's and PhD" },
  JP: { name: "MEXT and other scholarships", url: "https://www.studyinjapan.go.jp/en/planning/scholarships/", level: "All levels" },
  KR: { name: "Global Korea Scholarship (GKS)", url: "https://www.studyinkorea.go.kr/", level: "Bachelor's to PhD" },
  NL: { name: "NL Scholarship", url: "https://www.studyinnl.org/finances/nl-scholarship", level: "Bachelor's and master's, non-EU" },
  NZ: { name: "Manaaki New Zealand Scholarships", url: "https://www.nzscholarships.govt.nz/", level: "Selected countries" },
  PL: { name: "NAWA programmes", url: "https://nawa.gov.pl/en/students/foreign-students", level: "All levels" },
  SE: { name: "Swedish Institute Scholarships", url: "https://si.se/en/apply/scholarships/", level: "Master's, selected countries" },
  TR: { name: "Türkiye Scholarships", url: "https://www.turkiyeburslari.gov.tr/", level: "Bachelor's to PhD" },
  TW: { name: "Taiwan scholarships", url: "https://www.studyintaiwan.org/how-to-apply/scholarship", level: "All levels" },
  US: { name: "Fulbright Foreign Student Program", url: "https://foreign.fulbrightonline.org/", level: "Graduate, through your home country" },
};

/** Government scholarships worth a look for a country (EU countries also get Erasmus Mundus). */
export function scholarshipsFor(countryCode: string): Scholarship[] {
  const list = NATIONAL[countryCode] ? [NATIONAL[countryCode]] : [];
  if (exchangeStatus(countryCode) === "programme") list.push(ERASMUS_MUNDUS);
  return list;
}
