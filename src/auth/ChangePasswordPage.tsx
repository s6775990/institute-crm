import { Navigate, useNavigate } from 'react-router-dom';
import { PasswordForm } from '../modules/account/AccountPage';
import { Button } from '../ui/Button';
import { useAuth } from './AuthContext';
import { AuthCard } from './LoginPage';

/** Shown on first sign-in (or after a reset) until a personal password is chosen. */
export default function ChangePasswordPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  return (
    <AuthCard title={`ברוכה הבאה, ${user.fullName.split(' ')[0]}`} subtitle="לפני שמתחילים, בחרי סיסמה אישית שרק את יודעת">
      <PasswordForm submitLabel="שמירה וכניסה למערכת" onDone={() => navigate('/', { replace: true })} />
      <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>
        יציאה
      </Button>
    </AuthCard>
  );
}
