import { LoginForm } from "@/components/login-form";

// Nicht statisch vorrendern: die Auth-Seite ist zur Laufzeit dynamisch.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
