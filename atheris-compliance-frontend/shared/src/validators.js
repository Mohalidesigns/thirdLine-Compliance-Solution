const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]{2,100}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;
const PASSWORD_UPPER = /[A-Z]/;
const PASSWORD_LOWER = /[a-z]/;
const PASSWORD_DIGIT = /\d/;
const PASSWORD_SPECIAL = /[!@#$%^&*()_\-+={}[\]|:;"'<>,.?/~`]/;

function msg(label, detail) {
  return `${label}: ${detail}`;
}

export function required(value, label = 'This field') {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    return { valid: false, message: `${label} is required` };
  }
  return { valid: true };
}

export function name(value) {
  if (!value || !value.trim()) return { valid: false, message: 'Name is required' };
  if (!NAME_RE.test(value.trim())) {
    return { valid: false, message: 'Name must be 2–100 characters (letters, spaces, hyphens, apostrophes only)' };
  }
  return { valid: true };
}

export function email(value) {
  if (!value || !value.trim()) return { valid: false, message: 'Email is required' };
  if (!EMAIL_RE.test(value.trim())) {
    return { valid: false, message: 'Enter a valid email address (e.g. user@example.com)' };
  }
  return { valid: true };
}

export function phone(value, country = 'NG') {
  if (!value || !value.trim()) return { valid: false, message: 'Phone number is required' };
  const cleaned = value.trim().replace(/[\s\-()]/g, '');
  if (country === 'NG') {
    const ngRe = /^(\+234\d{10}|0\d{10})$/;
    if (!ngRe.test(cleaned)) {
      return { valid: false, message: 'Enter a valid Nigerian phone (e.g. 08031234567 or +2348031234567)' };
    }
  } else {
    if (cleaned.length < 8 || cleaned.length > 15 || !/^\+?\d+$/.test(cleaned)) {
      return { valid: false, message: 'Enter a valid phone number (8–15 digits, optional +)' };
    }
  }
  return { valid: true };
}

export function password(value, minLen = 8) {
  if (!value) return { valid: false, message: 'Password is required' };
  if (value.length < minLen) {
    return { valid: false, message: `Password must be at least ${minLen} characters` };
  }
  if (!PASSWORD_UPPER.test(value)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!PASSWORD_LOWER.test(value)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!PASSWORD_DIGIT.test(value)) {
    return { valid: false, message: 'Password must contain at least one digit' };
  }
  if (!PASSWORD_SPECIAL.test(value)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

export function url(value) {
  if (!value || !value.trim()) return { valid: false, message: 'URL is required' };
  if (!URL_RE.test(value.trim())) {
    return { valid: false, message: 'Enter a valid URL starting with http:// or https://' };
  }
  return { valid: true };
}
