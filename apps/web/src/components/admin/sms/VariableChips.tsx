'use client';

import { TEMPLATE_VAR_KEYS, TEMPLATE_VAR_LABELS, type TemplateVarKey } from './template-vars';

export function VariableChips({ onInsert }: { onInsert: (key: TemplateVarKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="متغیرهای قالب">
      {TEMPLATE_VAR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="min-h-11 rounded-full border border-gray-200 px-3 text-sm"
          onClick={() => onInsert(key)}
        >
          {TEMPLATE_VAR_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
