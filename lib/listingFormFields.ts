export const SHOE_SIZES = Array.from({ length: 9 }, (_, index) => String(36 + index));
export type ListingFormField = { name: string; label: string; type: string; options?: string[]; allowCustomSize?: boolean; [key: string]: unknown };
const footwear = /гутал|туфл|пүүз|шаахай|сандаал|footwear|shoes?|boots?|sneakers?/i;
const clothing = /хувцас|clothing|apparel/i;
const sizeField = (field: ListingFormField) => /размер|хэмжээ|(?:^|[\s_-])size(?:$|[\s_-])/i.test(`${field.name} ${field.label}`);

/** Adjust presentation only; keep existing field keys for stored listing compatibility. */
export function getListingFormFields(schema: unknown, category: string | null, subcategory: string | null): ListingFormField[] {
  const fields = (Array.isArray(schema) ? schema : []).filter((field): field is ListingFormField =>
    field && typeof field.name === 'string' && typeof field.label === 'string').map(field => ({ ...field }));
  const isShoe = footwear.test(subcategory ?? '') || (footwear.test(category ?? '') && !clothing.test(category ?? ''));
  const isWearable = isShoe || clothing.test(category ?? '');
  if (!isWearable) return fields;
  let foundSize = false;
  const result = fields.map(field => {
    if (!sizeField(field)) return field;
    foundSize = true;
    return { ...field, allowCustomSize: true,
      ...(isShoe ? { type: 'dropdown', options: [...SHOE_SIZES] } : {}) };
  });
  if (isShoe && !foundSize) result.push({ name: 'Размер', label: 'Гутлын размер (EU)', type: 'dropdown', options: [...SHOE_SIZES], allowCustomSize: true });
  return result;
}
