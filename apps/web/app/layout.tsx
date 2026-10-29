import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'SOS DOCTEURS — Votre santé, notre mission', template: '%s | SOS DOCTEURS' },
  description:
    'Demandez des soins à domicile, au bureau ou en téléconsultation au Bénin. Disponibilité confirmée par la coordination.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <a className="skip" href="#main">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
