// Errors thrown by the data layer. Messages are user-facing Hebrew text.

export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'invalid_credentials'
  | 'account_disabled'
  | 'storage_full'
  | 'unknown';

export type FieldErrors = Record<string, string>;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: 'צריך להיכנס למערכת מחדש.',
  forbidden: 'אין לך הרשאה לבצע את הפעולה הזו.',
  not_found: 'הפריט לא נמצא. ייתכן שהוא הוסר או שאין לך גישה אליו.',
  validation: 'יש לתקן את השדות המסומנים.',
  conflict: 'הפעולה לא בוצעה כי המידע השתנה בינתיים. רעננו את המסך ונסו שוב.',
  invalid_credentials: 'המייל או הסיסמה לא נכונים.',
  account_disabled: 'החשבון הזה הושבת. יש לפנות למנהלת המוקד.',
  storage_full: 'אין מספיק מקום לשמירה.',
  unknown: 'משהו השתבש. נסו שוב, ואם זה חוזר – פנו לתמיכה.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: FieldErrors;

  constructor(code: ErrorCode, message?: string, fieldErrors: FieldErrors = {}) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  console.error(err);
  return new AppError('unknown');
}

export function errorMessage(err: unknown): string {
  return toAppError(err).message;
}
