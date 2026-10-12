// Input validation used by the data layer (the trust boundary), not only by forms.
// Each validator collects a Hebrew error per field and returns the cleaned value.

import { AppError, type FieldErrors } from './errors.ts';

export class Validator {
  readonly errors: FieldErrors = {};

  private fail(field: string, message: string): null {
    if (!this.errors[field]) this.errors[field] = message;
    return null;
  }

  /** Required text, trimmed. */
  text(field: string, value: unknown, label: string, max: number, min = 1): string {
    const v = typeof value === 'string' ? value.trim() : '';
    if (v.length < min) {
      this.fail(field, min <= 1 ? `יש למלא ${label}` : `${label} צריך להכיל לפחות ${min} תווים`);
      return v;
    }
    if (v.length > max) this.fail(field, `${label} ארוך מדי (עד ${max} תווים)`);
    return v;
  }

  /** Optional text: empty becomes null. */
  optionalText(field: string, value: unknown, label: string, max: number): string | null {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return null;
    if (v.length > max) this.fail(field, `${label} ארוך מדי (עד ${max} תווים)`);
    return v;
  }

  phone(field: string, value: unknown): string | null {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return null;
    const normalized = normalizePhone(raw);
    if (!normalized) return this.fail(field, 'מספר הטלפון לא תקין. דוגמה: 050-1234567');
    return normalized;
  }

  email(field: string, value: unknown, required = false): string | null {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!v) return required ? this.fail(field, 'יש למלא כתובת מייל') : null;
    if (v.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      return this.fail(field, 'כתובת המייל לא תקינה. דוגמה: name@gmail.com');
    }
    return v;
  }

  date(field: string, value: unknown, label: string, required = false): string | null {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return required ? this.fail(field, `יש לבחור ${label}`) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      return this.fail(field, `${label} לא תקין`);
    }
    return v;
  }

  dateTime(field: string, value: unknown, label: string): string {
    const v = typeof value === 'string' ? value.trim() : '';
    const t = Date.parse(v);
    if (!v || Number.isNaN(t)) {
      this.fail(field, `יש לבחור ${label}`);
      return '';
    }
    return new Date(t).toISOString();
  }

  oneOf<T extends string>(field: string, value: unknown, allowed: readonly T[], label: string): T {
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
    this.fail(field, `יש לבחור ${label}`);
    return allowed[0];
  }

  int(field: string, value: unknown, label: string, min: number, max: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.fail(field, `${label} צריך להיות מספר בין ${min} ל-${max}`);
      return min;
    }
    return n;
  }

  check(condition: boolean, field: string, message: string): void {
    if (!condition) this.fail(field, message);
  }

  /** Throws a validation AppError if any field failed. */
  done(): void {
    if (Object.keys(this.errors).length > 0) {
      throw new AppError('validation', undefined, this.errors);
    }
  }
}

/** Keeps digits and a leading +. Accepts Israeli and international numbers. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d{9,15}$/.test(cleaned)) return null;
  return cleaned;
}

export const PASSWORD_MIN_LENGTH = 8;

export function validateNewPassword(v: Validator, field: string, password: unknown, confirm: unknown): string {
  const p = typeof password === 'string' ? password : '';
  v.check(p.length >= PASSWORD_MIN_LENGTH, field, `הסיסמה צריכה להכיל לפחות ${PASSWORD_MIN_LENGTH} תווים`);
  v.check(p.length <= 72, field, 'הסיסמה ארוכה מדי');
  v.check(p === confirm, 'confirm', 'שתי הסיסמאות לא זהות');
  return p;
}
