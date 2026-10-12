import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDemo } from '../data/DataContext';
import { Button } from '../ui/Button';
import { Field, FormError, Input } from '../ui/Field';
import { useSubmit } from '../ui/useSubmit';
import { IDLE_LIMIT_MINUTES, useAuth } from './AuthContext';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-b from-brand-50 to-slate-100 px-4 py-10 sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-lg text-slate-600">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, signIn, signedOutReason } = useAuth();
  const demo = useDemo();
  const { submit, pending, errors, formError } = useSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const login = (e?: string, p?: string) => submit(() => signIn(e ?? email, p ?? password));

  return (
    <AuthCard title="ניהול המוקד" subtitle="כניסה למערכת">
      {signedOutReason === 'idle' && (
        <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-blue-900" role="status">
          יצאת מהמערכת אוטומטית אחרי {IDLE_LIMIT_MINUTES} דקות בלי פעילות, כדי לשמור על פרטיות התורמים. אפשר להיכנס שוב.
        </p>
      )}
      {signedOutReason === 'expired' && (
        <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-blue-900" role="status">
          החיבור הסתיים. צריך להיכנס שוב.
        </p>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login();
        }}
      >
        <FormError>{Object.keys(errors).length ? null : formError}</FormError>
        <Field label="מייל" error={errors.email}>
          <Input type="email" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="סיסמה" error={errors.password}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
              aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending} icon={<LogIn className="h-5 w-5" aria-hidden />}>
          כניסה
        </Button>
        <p className="text-center text-slate-600">שכחת את הסיסמה? יש לפנות למנהלת המוקד, והיא תיצור לך סיסמה חדשה.</p>
      </form>

      {demo && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="mb-1 font-bold text-slate-800">מצב הדגמה – כניסה מהירה</p>
          <p className="mb-3 text-sm text-slate-600">כדי לראות מה כל אחת רואה במערכת:</p>
          <div className="space-y-2">
            {demo.demoAccounts().map((a) => (
              <Button key={a.email} variant="secondary" className="w-full justify-start" disabled={pending} onClick={() => login(a.email, a.password)}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
