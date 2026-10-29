import { Suspense } from 'react';
import { Login } from '../../components/login';
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="loading">
          Ouverture de votre espace…
        </main>
      }
    >
      <Login />
    </Suspense>
  );
}
