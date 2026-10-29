import { Suspense } from 'react';
import { Workspace } from '../../components/workspace';
export default function Space() {
  return (
    <Suspense
      fallback={
        <main id="main" className="loading">
          Chargement de votre espace…
        </main>
      }
    >
      <Workspace />
    </Suspense>
  );
}
