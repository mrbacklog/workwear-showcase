'use client';

import type { ShowcaseModel } from '@/types/product';

interface ProductSpecsProps {
  model: ShowcaseModel;
}

interface SpecRow {
  label: string;
  value: string | null | undefined;
}

export function ProductSpecs({ model }: ProductSpecsProps) {
  const enrichmentSpecs: SpecRow[] = [
    { label: 'Materiaal', value: model.material },
    { label: 'Stofgewicht', value: model.fabricTypeWeight },
    { label: 'Normen', value: model.safetyNorms },
    { label: 'Geslacht', value: model.gender },
    { label: 'Wassen', value: model.careInstructions },
    { label: 'Herkomst', value: model.countryOfOrigin },
  ].filter((s) => s.value);

  const metaSpecs: SpecRow[] = [
    { label: 'Artikelnummer', value: model.modelCode },
    { label: 'Kleuren', value: String(model.colorGroups.length) },
    { label: 'Varianten', value: String(model.variantCount) },
  ];

  if (enrichmentSpecs.length === 0 && !model.modelCode) return null;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Specificaties</h3>
      </div>
      <dl className="px-3 py-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {enrichmentSpecs.map((spec) => (
          <div key={spec.label} className="contents">
            <dt className="text-gray-500">{spec.label}</dt>
            <dd className="font-medium text-gray-900">{spec.value}</dd>
          </div>
        ))}

        {enrichmentSpecs.length > 0 && (
          <div className="contents">
            <div className="col-span-2 border-t border-gray-100 my-0.5" />
          </div>
        )}

        {metaSpecs.map((spec) => (
          <div key={spec.label} className="contents">
            <dt className="text-gray-500">{spec.label}</dt>
            <dd className="font-medium text-gray-900">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
