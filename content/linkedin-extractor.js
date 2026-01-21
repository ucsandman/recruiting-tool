/**
 * LinkedIn Profile Extractor
 * Content script that runs on LinkedIn profile pages
 */

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProfile') {
    try {
      const profileData = extractProfileData();
      sendResponse({ success: true, data: profileData });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

/**
 * Extract profile data from the current LinkedIn page
 */
function extractProfileData() {
  // Check if we're on a profile page
  if (!window.location.href.includes('linkedin.com/in/')) {
    throw new Error('Not on a LinkedIn profile page');
  }

  const profile = {
    name: extractName(),
    headline: extractHeadline(),
    location: extractLocation(),
    profileUrl: window.location.href.split('?')[0],
    profileImageUrl: extractProfileImage(),
    about: extractAbout(),
    currentRole: extractCurrentRole(),
    experience: extractExperience(),
    education: extractEducation(),
    skills: extractSkills(),
    certifications: extractCertifications(),
    languages: extractLanguages()
  };

  return profile;
}

/**
 * Extract the person's name
 */
function extractName() {
  // Try multiple selectors as LinkedIn's DOM changes frequently
  const selectors = [
    'h1.text-heading-xlarge',
    'h1[class*="text-heading"]',
    '.pv-top-card--list li:first-child',
    '.pv-text-details__left-panel h1'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  return null;
}

/**
 * Extract the headline (title under name)
 */
function extractHeadline() {
  const selectors = [
    '.text-body-medium.break-words',
    '[data-generated-suggestion-target]',
    '.pv-top-card--list-bullet .text-body-small',
    '.pv-text-details__left-panel .text-body-medium'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  return null;
}

/**
 * Extract location
 */
function extractLocation() {
  const selectors = [
    '.pv-top-card--list.pv-top-card--list-bullet .text-body-small:first-child',
    '.pv-text-details__left-panel span.text-body-small:first-of-type',
    '[class*="top-card"] span.text-body-small'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    // Filter out non-location text
    if (text && !text.includes('connections') && !text.includes('followers')) {
      return text;
    }
  }
  return null;
}

/**
 * Extract profile image URL
 */
function extractProfileImage() {
  const selectors = [
    '.pv-top-card-profile-picture__image',
    'img.profile-photo-edit__preview',
    '.pv-top-card__photo img',
    'img[class*="profile-picture"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.src) {
      return element.src;
    }
  }
  return null;
}

/**
 * Extract About section
 */
function extractAbout() {
  const aboutSection = document.querySelector('#about');
  if (aboutSection) {
    const parent = aboutSection.closest('section');
    const textDiv = parent?.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]');
    if (textDiv?.textContent?.trim()) {
      return textDiv.textContent.trim();
    }
    // Fallback
    const anyText = parent?.querySelector('.inline-show-more-text');
    if (anyText?.textContent?.trim()) {
      return anyText.textContent.trim();
    }
  }
  return null;
}

/**
 * Extract current role
 */
function extractCurrentRole() {
  const experienceSection = document.querySelector('#experience');
  if (experienceSection) {
    const parent = experienceSection.closest('section');
    const firstJob = parent?.querySelector('li.artdeco-list__item');
    if (firstJob) {
      return {
        title: firstJob.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim() || null,
        company: firstJob.querySelector('.t-normal span[aria-hidden="true"]')?.textContent?.trim() || null,
        duration: extractDuration(firstJob)
      };
    }
  }
  return null;
}

/**
 * Extract experience section
 */
function extractExperience() {
  const experience = [];
  const experienceSection = document.querySelector('#experience');

  if (experienceSection) {
    const parent = experienceSection.closest('section');
    const jobs = parent?.querySelectorAll('li.artdeco-list__item');

    jobs?.forEach((job, index) => {
      if (index < 5) { // Limit to 5 most recent
        const titleEl = job.querySelector('.t-bold span[aria-hidden="true"]');
        const companyEl = job.querySelector('.t-normal span[aria-hidden="true"]');
        const descEl = job.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]');

        if (titleEl?.textContent?.trim()) {
          experience.push({
            title: titleEl.textContent.trim(),
            company: companyEl?.textContent?.trim() || null,
            duration: extractDuration(job),
            description: descEl?.textContent?.trim() || null
          });
        }
      }
    });
  }

  return experience;
}

/**
 * Extract duration from a job entry
 */
function extractDuration(element) {
  const durationEl = element.querySelector('.t-black--light span[aria-hidden="true"]');
  return durationEl?.textContent?.trim() || null;
}

/**
 * Extract education section
 */
function extractEducation() {
  const education = [];
  const educationSection = document.querySelector('#education');

  if (educationSection) {
    const parent = educationSection.closest('section');
    const schools = parent?.querySelectorAll('li.artdeco-list__item');

    schools?.forEach((school, index) => {
      if (index < 3) { // Limit to 3
        const schoolNameEl = school.querySelector('.t-bold span[aria-hidden="true"]');
        const degreeEl = school.querySelector('.t-normal span[aria-hidden="true"]');
        const yearsEl = school.querySelector('.t-black--light span[aria-hidden="true"]');

        if (schoolNameEl?.textContent?.trim()) {
          const degreeText = degreeEl?.textContent?.trim() || '';
          const [degree, field] = degreeText.split(',').map(s => s?.trim());

          education.push({
            school: schoolNameEl.textContent.trim(),
            degree: degree || null,
            field: field || null,
            years: yearsEl?.textContent?.trim() || null
          });
        }
      }
    });
  }

  return education;
}

/**
 * Extract skills
 */
function extractSkills() {
  const skills = [];
  const skillsSection = document.querySelector('#skills');

  if (skillsSection) {
    const parent = skillsSection.closest('section');
    const skillElements = parent?.querySelectorAll('li.artdeco-list__item .t-bold span[aria-hidden="true"]');

    skillElements?.forEach((el, index) => {
      if (index < 10) { // Limit to 10
        const skill = el?.textContent?.trim();
        if (skill) {
          skills.push(skill);
        }
      }
    });
  }

  return skills;
}

/**
 * Extract certifications
 */
function extractCertifications() {
  const certifications = [];
  const certSection = document.querySelector('#licenses_and_certifications');

  if (certSection) {
    const parent = certSection.closest('section');
    const certs = parent?.querySelectorAll('li.artdeco-list__item .t-bold span[aria-hidden="true"]');

    certs?.forEach((el, index) => {
      if (index < 5) { // Limit to 5
        const cert = el?.textContent?.trim();
        if (cert) {
          certifications.push(cert);
        }
      }
    });
  }

  return certifications;
}

/**
 * Extract languages
 */
function extractLanguages() {
  const languages = [];
  const langSection = document.querySelector('#languages');

  if (langSection) {
    const parent = langSection.closest('section');
    const langs = parent?.querySelectorAll('li.artdeco-list__item .t-bold span[aria-hidden="true"]');

    langs?.forEach((el, index) => {
      if (index < 5) { // Limit to 5
        const lang = el?.textContent?.trim();
        if (lang) {
          languages.push(lang);
        }
      }
    });
  }

  return languages;
}
