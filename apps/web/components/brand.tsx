import { Stethoscope } from 'lucide-react';
import Link from 'next/link';
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={'brand' + (light ? ' brand-light' : '')} aria-label="SOS DOCTEURS, accueil">
      <span className="brand-icon">
        <Stethoscope size={30} strokeWidth={1.8} />
        <span className="brand-cross">+</span>
      </span>
      <span>
        <b>
          SOS <span>DOCTEURS</span>
        </b>
        <small>VOTRE SANTÉ, NOTRE MISSION</small>
      </span>
    </Link>
  );
}
