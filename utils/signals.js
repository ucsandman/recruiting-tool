/**
 * Signals
 * Deterministic candidate signals derived from already-extracted profile text.
 * Pure functions: no DOM, no network, no AI. See the ban-safety invariant.
 */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const Signals = {
  /**
   * Parse a LinkedIn duration string into a month count.
   * @param {string} durationText e.g. "Jan 2023 - Present · 2 yrs 3 mos"
   * @param {Date} now injected for deterministic tests
   * @returns {{start, end, months, isCurrent}|null} null if unparseable
   */
  parseTenure(durationText, now = new Date()) {
    if (typeof durationText !== 'string' || durationText.trim() === '') return null;

    const text = durationText.trim();
    const isCurrent = /\bpresent\b/i.test(text);

    // Split off the "· 2 yrs 3 mos" summary, if any.
    // Public site joins with a middot; Recruiter's profile view uses a bullet.
    const parts = text.split(/[·•]/);
    const rangePart = parts[0].trim();
    const summaryPart = parts.length > 1 ? parts.slice(1).join('·').trim() : '';

    const endpoints = rangePart.split(/\s+[-–]\s+/).map(s => s.trim());
    const start = this._parsePoint(endpoints[0]);
    if (!start) return null;

    const rawEnd = endpoints.length > 1 ? endpoints[1] : '';
    const end = isCurrent ? null : this._parsePoint(rawEnd);
    if (!isCurrent && !end) return null;

    let months = this._monthsFromSummary(summaryPart);
    if (months === null) {
      const endPoint = isCurrent
        ? { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
        : end;
      months = this._monthsBetween(start, endPoint);
    }
    if (months === null) return null;

    return { start, end, months, isCurrent };
  },

  /**
   * Advisory movability label. Not a filter: the recruiter decides.
   * @param {number} months from parseTenure
   */
  tenureBand(months) {
    if (typeof months !== 'number' || !Number.isFinite(months) || months < 0) {
      return 'unknown';
    }
    if (months < 6) return 'new';
    if (months < 18) return 'settling';
    if (months < 48) return 'prime';
    return 'entrenched';
  },

  /**
   * Compare a stored role snapshot against what a page just showed.
   * @param {{title,company}|null} prev
   * @param {{title,company}|null} next
   */
  diffRole(prev, next) {
    const none = { changed: false, from: prev || null, to: next || null, kind: 'none' };
    if (!prev || !next) return none;

    const norm = v => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const titleChanged = norm(prev.title) !== norm(next.title);
    const companyChanged = norm(prev.company) !== norm(next.company);

    if (!titleChanged && !companyChanged) return none;

    let kind = 'none';
    if (titleChanged && companyChanged) kind = 'both';
    else if (companyChanged) kind = 'company-change';
    else kind = 'title-change';

    return { changed: true, from: prev, to: next, kind };
  },

  /**
   * Open-to-work detection with provenance.
   * Two independent sources; the recruiter sees which one fired.
   * @param {object} profileData from the extractors
   * @param {Date} now injected for deterministic tests
   */
  detectOpenToWork(profileData, now = new Date()) {
    const closed = { open: false, source: null, seenAt: null };
    if (!profileData || typeof profileData !== 'object') return closed;

    // Recruiter spotlight wins: it is the stronger, intent-declared signal.
    const spotlights = Array.isArray(profileData.recruiterSpotlights)
      ? profileData.recruiterSpotlights
      : [];
    if (spotlights.some(s => typeof s === 'string' && /open to work/i.test(s))) {
      return { open: true, source: 'recruiter-spotlight', seenAt: now.toISOString() };
    }

    const topCard = typeof profileData.topCardText === 'string' ? profileData.topCardText : '';
    // Match the badge phrase as its own line. A profile that merely contains the
    // words ("open to work with partners") must not fire.
    const badge = topCard.split('\n').some(line => /^\s*#?open\s+to\s+work\s*$/i.test(line));
    if (badge) {
      return { open: true, source: 'public-badge', seenAt: now.toISOString() };
    }

    return closed;
  },

  /** "Jan 2023" -> {year:2023, month:1}; "2019" -> {year:2019, month:null} */
  _parsePoint(text) {
    if (typeof text !== 'string') return null;
    const withMonth = text.trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
    if (withMonth) {
      const month = MONTHS[withMonth[1].toLowerCase()];
      if (!month) return null;
      return { year: parseInt(withMonth[2], 10), month };
    }
    const yearOnly = text.trim().match(/^(\d{4})$/);
    if (yearOnly) return { year: parseInt(yearOnly[1], 10), month: null };
    return null;
  },

  /** "2 yrs 3 mos" -> 27; "3 yrs" -> 36; "5 mos" -> 5; no match -> null */
  _monthsFromSummary(text) {
    if (!text) return null;
    const years = text.match(/(\d+)\s*(?:yr|yrs|year|years)\b/i);
    const months = text.match(/(\d+)\s*(?:mo|mos|month|months)\b/i);
    if (!years && !months) return null;
    return (years ? parseInt(years[1], 10) * 12 : 0)
         + (months ? parseInt(months[1], 10) : 0);
  },

  /** Inclusive month span, matching how LinkedIn counts. */
  _monthsBetween(start, end) {
    if (!start || !end) return null;
    const startMonth = start.month || 1;
    const endMonth = end.month || 12;
    const span = (end.year - start.year) * 12 + (endMonth - startMonth) + 1;
    return span > 0 ? span : null;
  }
};

// Dual export: a browser global for content scripts and the popup,
// a CommonJS module for the Node test runner. No build step.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Signals;
}
