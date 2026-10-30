/**
 * Reference sources used to check the science content.
 *
 * Provenance policy: topic text was written for JARVIS in plain language (not
 * copied). Facts were checked against the openly available references below.
 * Each topic lists the reference(s) it relies on. Content has NOT yet been
 * reviewed by a qualified teacher, and no curriculum (e.g. NGSS or a national
 * syllabus) mapping has been audited. See docs/SCIENCE_CONTENT.md.
 */
export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
}

export const SOURCES: Record<string, SourceRef> = {
  "openstax-bio2e": { id: "openstax-bio2e", title: "Biology 2e", publisher: "OpenStax (Rice University)", url: "https://openstax.org/details/books/biology-2e", license: "CC BY 4.0" },
  "openstax-conceptsbio": { id: "openstax-conceptsbio", title: "Concepts of Biology", publisher: "OpenStax (Rice University)", url: "https://openstax.org/details/books/concepts-biology", license: "CC BY 4.0" },
  "openstax-chem2e": { id: "openstax-chem2e", title: "Chemistry 2e", publisher: "OpenStax (Rice University)", url: "https://openstax.org/details/books/chemistry-2e", license: "CC BY 4.0" },
  "openstax-hsphysics": { id: "openstax-hsphysics", title: "Physics (high school)", publisher: "OpenStax (Rice University)", url: "https://openstax.org/details/books/physics", license: "CC BY 4.0" },
  "openstax-collegephys2e": { id: "openstax-collegephys2e", title: "College Physics 2e", publisher: "OpenStax (Rice University)", url: "https://openstax.org/details/books/college-physics-2e", license: "CC BY 4.0" },
  "usgs-water": { id: "usgs-water", title: "Water Science School", publisher: "U.S. Geological Survey", url: "https://www.usgs.gov/special-topics/water-science-school", license: "Public domain (U.S. Government work)" },
  "nasa-science": { id: "nasa-science", title: "NASA Science", publisher: "NASA", url: "https://science.nasa.gov/", license: "Generally public domain (U.S. Government work)" },
  "nist-constants": { id: "nist-constants", title: "Fundamental Physical Constants", publisher: "NIST", url: "https://physics.nist.gov/cuu/Constants/", license: "Public domain (U.S. Government work)" },
  "iupac-ptable": { id: "iupac-ptable", title: "Periodic Table of Elements", publisher: "IUPAC", url: "https://iupac.org/what-we-do/periodic-table-of-elements/", license: "See publisher" },
};

export const PROVENANCE_NOTE =
  "Written for JARVIS in plain language and checked against the listed open references. Not yet reviewed by a teacher.";
