/**
 * LinkedIn Profile Extractor
 * Content script that runs on LinkedIn profile pages
 */

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProfile') {
    try {
      const profileData = extractProfileData();
      console.log('Extracted profile data:', profileData);
      sendResponse({ success: true, data: profileData });
    } catch (error) {
      console.error('Profile extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

/**
 * Helper to get text content safely
 */
function getText(selector, parent = document) {
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() || null;
}

/**
 * Helper to try multiple selectors
 */
function getTextFromSelectors(selectors, parent = document) {
  for (const selector of selectors) {
    const text = getText(selector, parent);
    if (text) return text;
  }
  return null;
}

/**
 * Find a section by its header text (LinkedIn 2025 approach)
 * LinkedIn no longer uses IDs - sections are identified by their content
 */
function findSectionByHeader(headerText) {
  const sections = document.querySelectorAll('section');
  for (const section of sections) {
    const text = section.innerText?.trim() || '';
    // Check if section starts with the header text (case-insensitive)
    if (text.toLowerCase().startsWith(headerText.toLowerCase())) {
      return section;
    }
  }
  return null;
}

/**
 * Extract entries from a section by parsing innerText
 * LinkedIn uses divs not li elements, so we parse text directly
 */
function extractSectionEntries(section, headerText) {
  if (!section) return [];

  // Get full text and remove the header
  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(new RegExp('^' + headerText + '\\s*', 'i'), '').trim();

  // Split into entries - typically separated by double newlines or clear breaks
  // Look for patterns that indicate new entries
  const entries = [];
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return lines;
}

/**
 * Parse education entries from text lines
 */
function parseEducationFromText(section) {
  if (!section) return [];

  const education = [];
  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Education\s*/i, '').trim();

  // Split by looking for school names (typically followed by degree info)
  // Schools often end with "University", "College", "Institute", "School"
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentEdu = null;

  for (const line of lines) {
    // Skip UI elements
    if (line.match(/^(Show all|see more|skills?)$/i)) continue;

    // Check if this is a school name
    const isSchool = line.match(/(University|College|Institute|School|Academy|Universität|MBA|PhD)/i) &&
                     !line.match(/^(Bachelor|Master|Doctor|Associate|Diploma|Certificate|B\.|M\.|MBA)/i);

    // Check if this is a degree
    const isDegree = line.match(/^(Bachelor|Master|Doctor|Associate|Diploma|Certificate|B\.|M\.|MBA|BBA|BS|BA|MS|MA|PhD)/i) ||
                     line.match(/degree/i);

    // Check if this is a year range
    const isYears = line.match(/^\d{4}\s*[-–]\s*(\d{4}|Present)/i);

    if (isSchool) {
      // Save previous entry
      if (currentEdu && currentEdu.school) {
        education.push(currentEdu);
      }
      currentEdu = { school: line, degree: '', field: '', years: '' };
    } else if (currentEdu) {
      if (isDegree && !currentEdu.degree) {
        // Parse degree and field (often comma-separated)
        const parts = line.split(',').map(s => s.trim());
        currentEdu.degree = parts[0] || '';
        currentEdu.field = parts.slice(1).join(', ') || '';
      } else if (isYears && !currentEdu.years) {
        currentEdu.years = line;
      }
    }
  }

  // Don't forget last entry
  if (currentEdu && currentEdu.school) {
    education.push(currentEdu);
  }

  return education;
}

/**
 * Parse skills from section text
 */
function parseSkillsFromText(section) {
  if (!section) return [];

  const skills = [];
  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Skills\s*/i, '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip UI elements and endorsement counts
    if (line.match(/^(Show all|see more|Endorsed by|\d+ endorsement|Take skill quiz)/i)) continue;
    if (line.match(/^\d+$/)) continue; // Just numbers (endorsement counts)

    // Skills are typically short phrases
    if (line.length > 2 && line.length < 60 && !line.includes('·')) {
      skills.push(line);
    }
  }

  return skills;
}

/**
 * Parse generic list entries (certifications, courses, languages, etc.)
 */
function parseSimpleListFromText(section, headerText) {
  if (!section) return [];

  const items = [];
  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(new RegExp('^' + headerText + '\\s*', 'i'), '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip UI elements
    if (line.match(/^(Show all|see more|Issued|Expires|Credential)/i)) continue;
    if (line.match(/^\d{4}$/) || line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i)) continue;

    // Take first meaningful lines as items
    if (line.length > 2 && line.length < 100 && items.length < 15) {
      // Avoid duplicates and very similar items
      if (!items.some(i => i.toLowerCase() === line.toLowerCase())) {
        items.push(line);
      }
    }
  }

  return items;
}

/**
 * Raw text of the profile top card, used for badge detection.
 * LinkedIn wraps the entire profile (About, Featured, Activity, etc.) in an
 * outer <section> under <main>, so `main.querySelector('section')` returns
 * that wrapper, not the top card. The real top card is the SMALLEST section
 * under <main> whose first non-empty line equals the profile's name.
 */
function extractTopCardText() {
  const main = document.querySelector('main');
  if (!main) return '';

  const sections = Array.from(main.querySelectorAll('section'));
  if (sections.length === 0) return '';

  const name = extractName();
  if (name) {
    const candidates = sections
      .map(section => (section.innerText || '').trim())
      .filter(text => {
        const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
        return firstLine === name;
      });

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.length - b.length);
      return candidates[0];
    }
  }

  // Fallback: name extraction failed or LinkedIn changed. Never return the
  // whole profile - cap at 40 lines to keep prompts small and the badge
  // detection surface narrow.
  const fallbackText = (sections[0].innerText || '').trim();
  return fallbackText.split('\n').slice(0, 40).join('\n');
}

/**
 * Whether any aria-label under <main> carries the open-to-work signal.
 * LinkedIn renders this as e.g. "View <Name>'s profile, open to work" or
 * "<Name>, Open to work Verified Profile You" - the distinguishing shape is
 * a comma followed by "open to work" as a word.
 */
function extractOpenToWorkAria() {
  const main = document.querySelector('main');
  if (!main) return false;
  const elements = main.querySelectorAll('[aria-label]');
  for (const el of elements) {
    const label = el.getAttribute('aria-label') || '';
    if (/,\s*open\s*to\s*work\b/i.test(label)) return true;
  }
  return false;
}

/**
 * Extract profile data from the current LinkedIn page
 */
function extractProfileData() {
  if (!window.location.href.includes('linkedin.com/in/')) {
    throw new Error('Not on a LinkedIn profile page');
  }

  // Log what we can find for debugging
  console.log('Page title:', document.title);
  console.log('Found h1 elements:', document.querySelectorAll('h1').length);

  const profile = {
    name: extractName(),
    headline: extractHeadline(),
    location: extractLocation(),
    profileUrl: window.location.href.split('?')[0],
    profileImageUrl: extractProfileImage(),
    topCardText: extractTopCardText(),
    openToWorkAria: extractOpenToWorkAria(),
    about: extractAbout(),
    currentRole: extractCurrentRole(),
    experience: extractExperience(),
    education: extractEducation(),
    skills: extractSkills(),
    certifications: extractCertifications(),
    languages: extractLanguages(),
    services: extractServices(),
    volunteering: extractVolunteering(),
    courses: extractCourses(),
    honors: extractHonors(),
    organizations: extractOrganizations()
  };

  return profile;
}

/**
 * Extract the person's name
 */
function extractName() {
  // MOST RELIABLE: Get name from page title first
  // LinkedIn titles are formatted as "Name | LinkedIn" or "Name - Title | LinkedIn"
  const titleMatch = document.title.match(/^(.+?)\s*[|\-–]/);
  if (titleMatch) {
    const nameFromTitle = titleMatch[1].trim();
    // Make sure it's not a title like "Software Engineer" - names are typically 2-4 words, no common job words
    const jobWords = ['engineer', 'manager', 'director', 'analyst', 'developer', 'designer', 'specialist', 'consultant', 'lead', 'senior', 'junior', 'vp', 'ceo', 'cto', 'cfo'];
    const lowerName = nameFromTitle.toLowerCase();
    const isLikelyName = !jobWords.some(word => lowerName.includes(word)) &&
                         nameFromTitle.split(' ').length <= 4 &&
                         nameFromTitle.length < 40;
    if (isLikelyName) {
      return nameFromTitle;
    }
  }

  // Try traditional selectors
  const selectors = [
    'h1.text-heading-xlarge',
    'h1.inline.t-24',
    '.pv-text-details__left-panel h1',
    '[data-anonymize="person-name"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && text.length < 50 && !text.includes('Experience') && !text.includes('Education')) {
      return text;
    }
  }

  // LinkedIn 2025: Look for name by finding text that matches page title
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return null;
}

/**
 * Extract the headline
 */
function extractHeadline() {
  const name = extractName();

  // Try traditional selectors first
  const selectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '[data-anonymize="headline"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && text !== name && text.length > 5 && text.length < 200) {
      return text;
    }
  }

  // LinkedIn 2025: Find headline by looking for job-like text in profile section
  const profileSection = document.querySelector('[data-view-name="profile-main-level"]');
  if (profileSection) {
    const paragraphs = profileSection.querySelectorAll('p');
    for (const p of paragraphs) {
      const text = p?.textContent?.trim();
      if (!text || text === name || text.length < 5) continue;

      // Headline usually contains "at" or job-related words, or is a longer description
      const isHeadline = text.includes(' at ') ||
                         text.includes('|') ||
                         /\b(engineer|manager|director|developer|designer|analyst|consultant|specialist|founder|ceo|cto|student|professor|teacher)\b/i.test(text);

      // Also check it's not a location (no city, state pattern without job words)
      const isLocation = /^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(text) ||
                         text.includes(' Area') ||
                         (text.split(',').length === 2 && text.length < 30 && !isHeadline);

      if (isHeadline && !isLocation && text.length < 200) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Extract location
 */
function extractLocation() {
  const name = extractName();
  const headline = extractHeadline();

  // Try traditional selectors first
  const selectors = [
    '.pv-text-details__left-panel .text-body-small.t-black--light',
    '[data-anonymize="location"]'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el?.textContent?.trim();
      if (text && text !== name && text !== headline &&
          !text.includes('connection') && !text.includes('follower') &&
          text.length < 100) {
        return text;
      }
    }
  }

  // LinkedIn 2025: Find location in profile main section
  const profileSection = document.querySelector('[data-view-name="profile-main-level"]');
  if (profileSection) {
    const paragraphs = profileSection.querySelectorAll('p');
    for (const p of paragraphs) {
      const text = p?.textContent?.trim();
      if (!text || text === name || text === headline) continue;
      if (text.includes('connection') || text.includes('follower')) continue;

      // Location patterns: "City, State", "City, Country", "Greater X Area", etc.
      const isLocation = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]/.test(text) ||
                         text.includes(' Area') ||
                         text.includes(' Metro') ||
                         /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(text) ||
                         // Country names or regions
                         /^(United States|United Kingdom|Canada|Australia|Germany|France|India|China|Japan|Brazil|Mexico|Spain|Italy|Netherlands|Sweden|Singapore|Ireland|Israel|Switzerland)/i.test(text);

      // Make sure it's not a job title
      const isJobTitle = /\b(engineer|manager|director|developer|designer|analyst|consultant|specialist|founder|ceo|cto)\b/i.test(text) ||
                         text.includes(' at ');

      if (isLocation && !isJobTitle && text.length < 60) {
        return text;
      }
    }

    // Fallback: look for "City, ST" pattern anywhere in the text
    const allText = profileSection.innerText;
    const locationMatch = allText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/);
    if (locationMatch && locationMatch[1] !== name) {
      return locationMatch[1];
    }
  }

  return null;
}

/**
 * Extract profile image
 */
function extractProfileImage() {
  const selectors = [
    '.pv-top-card-profile-picture__image--show',
    '.pv-top-card-profile-picture__image',
    'img.profile-photo-edit__preview',
    '.presence-entity__image',
    'img[alt*="profile photo"]',
    '.ph5 img.evi-image'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.src && !el.src.includes('ghost')) {
      return el.src;
    }
  }
  return null;
}

/**
 * Extract About section
 */
function extractAbout() {
  const section = findSectionByHeader('About');
  if (!section) return null;

  // Get all text after "About" header
  const fullText = section.innerText?.trim() || '';
  // Remove the "About" header and any "see more" text
  const aboutText = fullText
    .replace(/^About\s*/i, '')
    .replace(/…see more$/i, '')
    .replace(/see more$/i, '')
    .trim();

  return aboutText || null;
}

/**
 * Extract current role from experience
 */
function extractCurrentRole() {
  const experience = extractExperience();
  if (experience.length > 0) {
    return {
      title: experience[0].title,
      company: experience[0].company,
      duration: experience[0].duration
    };
  }
  return null;
}

/**
 * Extract experience section
 */
function extractExperience() {
  const experience = [];
  const section = findSectionByHeader('Experience');
  if (!section) return experience;

  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Experience\s*/i, '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentExp = null;

  for (const line of lines) {
    // Skip UI elements
    if (line.match(/^(Show all|see more|\d+ experiences?)$/i)) continue;

    // Check if this is a date/duration line
    const isDate = line.match(/^\d{4}\s*[-–]|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i);
    const isDuration = line.match(/\d+\s*(yr|mo|year|month)/i);

    // Check if this looks like a company line (contains · for employment type)
    const isCompanyLine = line.includes('·') && line.match(/(Full-time|Part-time|Contract|Freelance|Internship|Self-employed)/i);

    // Check if this looks like a job title (typically not too long, no dates, no bullets)
    const looksLikeTitle = line.length > 3 && line.length < 80 &&
                          !isDate && !isDuration && !isCompanyLine &&
                          !line.startsWith('•') && !line.startsWith('-') &&
                          !line.match(/^(Skills|Credential)/i);

    if (looksLikeTitle && (!currentExp || (currentExp.title && currentExp.company))) {
      // Save previous entry if complete
      if (currentExp && currentExp.title) {
        experience.push(currentExp);
      }
      currentExp = { title: line, company: '', duration: '', description: '' };
    } else if (currentExp) {
      if (isCompanyLine && !currentExp.company) {
        currentExp.company = line.split('·')[0].trim();
      } else if ((isDate || isDuration) && !currentExp.duration) {
        currentExp.duration = line;
      } else if (!currentExp.company && !isDate && !isDuration && line.length > 2 && line.length < 60) {
        // Might be company name without employment type
        currentExp.company = line;
      }
    }
  }

  // Don't forget last entry
  if (currentExp && currentExp.title) {
    experience.push(currentExp);
  }

  return experience;
}

/**
 * Extract education
 */
function extractEducation() {
  const section = findSectionByHeader('Education');
  return parseEducationFromText(section);
}

/**
 * Extract skills
 */
function extractSkills() {
  const section = findSectionByHeader('Skills');
  return parseSkillsFromText(section);
}

/**
 * Extract certifications
 */
function extractCertifications() {
  const section = findSectionByHeader('Licenses & certifications');
  return parseSimpleListFromText(section, 'Licenses & certifications');
}

/**
 * Extract languages
 */
function extractLanguages() {
  const section = findSectionByHeader('Languages');
  return parseSimpleListFromText(section, 'Languages');
}

/**
 * Extract services offered
 */
function extractServices() {
  const services = [];
  const section = findSectionByHeader('Services');
  if (!section) return services;

  // Services are often displayed as a simple list or comma-separated
  const fullText = section.innerText?.trim() || '';
  const servicesText = fullText.replace(/^Services\s*/i, '').trim();

  // Split by common delimiters
  const items = servicesText.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);

  items.forEach(item => {
    if (!services.includes(item)) {
      services.push(item);
    }
  });

  return services;
}

/**
 * Extract volunteering experience
 */
function extractVolunteering() {
  const volunteering = [];
  const section = findSectionByHeader('Volunteering');
  if (!section) return volunteering;

  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Volunteering\s*/i, '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentVol = null;

  for (const line of lines) {
    if (line.match(/^(Show all|see more)$/i)) continue;

    // Check if this looks like a role (usually first line of entry)
    // Roles often are short and don't contain dates
    const isDate = line.match(/^\d{4}|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    const isOrg = line.length > 2 && !isDate && currentVol && !currentVol.organization;

    if (!isDate && !currentVol && line.length > 2 && line.length < 80) {
      currentVol = { role: line, organization: '', duration: '' };
    } else if (currentVol) {
      if (isOrg) {
        currentVol.organization = line;
      } else if (isDate) {
        currentVol.duration = line;
        // After getting duration, save and reset
        volunteering.push(currentVol);
        currentVol = null;
      }
    }
  }

  // Don't forget last entry
  if (currentVol && currentVol.role) {
    volunteering.push(currentVol);
  }

  return volunteering;
}

/**
 * Extract courses
 */
function extractCourses() {
  const section = findSectionByHeader('Courses');
  return parseSimpleListFromText(section, 'Courses');
}

/**
 * Extract honors and awards
 */
function extractHonors() {
  const honors = [];
  const section = findSectionByHeader('Honors & awards');
  if (!section) return honors;

  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Honors & awards\s*/i, '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentHonor = null;

  for (const line of lines) {
    if (line.match(/^(Show all|see more)$/i)) continue;

    const isDate = line.match(/^\d{4}$|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i);

    if (!isDate && !currentHonor && line.length > 2) {
      currentHonor = { title: line, issuer: '' };
    } else if (currentHonor && !isDate && !currentHonor.issuer && line.length > 2) {
      currentHonor.issuer = line;
      honors.push(currentHonor);
      currentHonor = null;
    } else if (isDate && currentHonor) {
      honors.push(currentHonor);
      currentHonor = null;
    }
  }

  if (currentHonor && currentHonor.title) {
    honors.push(currentHonor);
  }

  return honors;
}

/**
 * Extract organizations/memberships
 */
function extractOrganizations() {
  const orgs = [];
  const section = findSectionByHeader('Organizations');
  if (!section) return orgs;

  let fullText = section.innerText?.trim() || '';
  fullText = fullText.replace(/^Organizations\s*/i, '').trim();

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentOrg = null;

  for (const line of lines) {
    if (line.match(/^(Show all|see more)$/i)) continue;

    const isDate = line.match(/^\d{4}|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);

    if (!isDate && !currentOrg && line.length > 2) {
      currentOrg = { name: line, role: '' };
    } else if (currentOrg && !isDate && !currentOrg.role && line.length > 2) {
      currentOrg.role = line;
    } else if (isDate && currentOrg) {
      orgs.push(currentOrg);
      currentOrg = null;
    }
  }

  if (currentOrg && currentOrg.name) {
    orgs.push(currentOrg);
  }

  return orgs;
}

// Log that content script is loaded
console.log('Recruiter Toolkit: LinkedIn extractor loaded on', window.location.href);
