import type { ShowcaseModel } from '@/types/product';

interface ProductAttributesProps {
  model: ShowcaseModel;
}

export function ProductAttributes({ model }: ProductAttributesProps) {
  const attributes: { label: string; value: string }[] = [
    { label: 'Merk', value: model.brandName },
    { label: 'Modelcode', value: model.modelCode },
    { label: 'Categorie', value: model.categoryPath },
    { label: 'Aantal varianten', value: String(model.variantCount) },
    {
      label: 'Aantal kleuren',
      value: String(model.colorGroups.length),
    },
  ];

  return (
    <div>
      {/* Description */}
      {model.descriptionNl && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Beschrijving
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {model.descriptionNl}
          </p>
        </div>
      )}

      {/* Key-value attributes */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Kenmerken
        </h2>
        <dl className="divide-y divide-gray-100">
          {attributes.map(({ label, value }) => (
            <div key={label} className="flex py-2 text-sm">
              <dt className="w-40 shrink-0 text-gray-500">{label}</dt>
              <dd className="text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
