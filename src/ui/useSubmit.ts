import { useCallback, useState } from 'react';
import { authEvents } from '../auth/authEvents';
import { toAppError, type FieldErrors } from '../core/errors';
import { useToast } from './feedback';

/**
 * Runs a data-layer call from a form: tracks "saving...", shows field errors
 * next to the fields and a general error at the top, and a toast on success.
 */
export function useSubmit() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(
    async <T>(fn: () => Promise<T>, successMessage?: string): Promise<{ ok: true; value: T } | { ok: false }> => {
      setPending(true);
      setErrors({});
      setFormError(null);
      try {
        const value = await fn();
        if (successMessage) toast.success(successMessage);
        return { ok: true, value };
      } catch (err) {
        const e = toAppError(err);
        if (e.code === 'unauthenticated') authEvents.expired();
        setErrors(e.fieldErrors);
        setFormError(e.message);
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { submit, pending, errors, formError, reset };
}

/** For one-click actions (buttons, checkboxes): result is reported by a toast. */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      setPending(true);
      try {
        await fn();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (err) {
        const e = toAppError(err);
        if (e.code === 'unauthenticated') authEvents.expired();
        toast.error(e.message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
