'use client';

import { countSmsParts, ensureOptOutFooter } from './sms-parts';
import { worstCaseBody } from './template-vars';

export function PartCounter({ body, messageClass }: { body: string; messageClass: string }) {
  const shown = ensureOptOutFooter(body, messageClass);
  const worst = ensureOptOutFooter(worstCaseBody(body), messageClass);
  const parts = countSmsParts(shown);
  const worstParts = countSmsParts(worst);
  return (
    <p className="text-xs text-gray-600" aria-live="polite">
      {shown.length.toLocaleString('fa-IR')} نویسه · {parts.toLocaleString('fa-IR')} پارت
      {worstParts > parts ? ` · حداکثر ${worstParts.toLocaleString('fa-IR')} پارت` : ''}
    </p>
  );
}
