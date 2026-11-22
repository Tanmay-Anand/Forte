/**
 * Common blood-test markers, so entering a report is picking from a list
 * rather than typing names. Units are the usual defaults and can be changed
 * per result, because labs report in different units. Reference ranges are NOT
 * seeded: they differ between labs and are always taken from the report.
 *
 * [name, category, default unit]
 */
export type LabCategory =
  | 'Blood count'
  | 'Lipids'
  | 'Liver'
  | 'Kidney'
  | 'Thyroid'
  | 'Vitamins and minerals'
  | 'Hormones'
  | 'Metabolic'
  | 'Inflammation'
  | 'Other';

export const LAB_CATEGORIES: LabCategory[] = [
  'Blood count',
  'Lipids',
  'Liver',
  'Kidney',
  'Thyroid',
  'Vitamins and minerals',
  'Hormones',
  'Metabolic',
  'Inflammation',
  'Other',
];

export const LAB_MARKER_SEED: [string, LabCategory, string][] = [
  ['Haemoglobin', 'Blood count', 'g/dL'],
  ['Haematocrit', 'Blood count', '%'],
  ['Red blood cells', 'Blood count', '10^6/µL'],
  ['White blood cells', 'Blood count', '10^3/µL'],
  ['Platelets', 'Blood count', '10^3/µL'],
  ['MCV', 'Blood count', 'fL'],
  ['Neutrophils', 'Blood count', '%'],
  ['Lymphocytes', 'Blood count', '%'],

  ['Total cholesterol', 'Lipids', 'mg/dL'],
  ['LDL cholesterol', 'Lipids', 'mg/dL'],
  ['HDL cholesterol', 'Lipids', 'mg/dL'],
  ['Triglycerides', 'Lipids', 'mg/dL'],
  ['VLDL cholesterol', 'Lipids', 'mg/dL'],

  ['ALT (SGPT)', 'Liver', 'U/L'],
  ['AST (SGOT)', 'Liver', 'U/L'],
  ['Alkaline phosphatase', 'Liver', 'U/L'],
  ['GGT', 'Liver', 'U/L'],
  ['Total bilirubin', 'Liver', 'mg/dL'],
  ['Albumin', 'Liver', 'g/dL'],
  ['Total protein', 'Liver', 'g/dL'],

  ['Creatinine', 'Kidney', 'mg/dL'],
  ['Urea', 'Kidney', 'mg/dL'],
  ['BUN', 'Kidney', 'mg/dL'],
  ['eGFR', 'Kidney', 'mL/min/1.73m²'],
  ['Uric acid', 'Kidney', 'mg/dL'],
  ['Sodium', 'Kidney', 'mmol/L'],
  ['Potassium', 'Kidney', 'mmol/L'],

  ['TSH', 'Thyroid', 'mIU/L'],
  ['Free T4', 'Thyroid', 'ng/dL'],
  ['Free T3', 'Thyroid', 'pg/mL'],

  ['Vitamin D (25-OH)', 'Vitamins and minerals', 'ng/mL'],
  ['Vitamin B12', 'Vitamins and minerals', 'pg/mL'],
  ['Folate', 'Vitamins and minerals', 'ng/mL'],
  ['Ferritin', 'Vitamins and minerals', 'ng/mL'],
  ['Iron', 'Vitamins and minerals', 'µg/dL'],
  ['Calcium', 'Vitamins and minerals', 'mg/dL'],
  ['Magnesium', 'Vitamins and minerals', 'mg/dL'],

  ['Testosterone (total)', 'Hormones', 'ng/dL'],
  ['Testosterone (free)', 'Hormones', 'pg/mL'],
  ['Cortisol', 'Hormones', 'µg/dL'],
  ['Oestradiol', 'Hormones', 'pg/mL'],
  ['SHBG', 'Hormones', 'nmol/L'],

  ['Fasting glucose', 'Metabolic', 'mg/dL'],
  ['HbA1c', 'Metabolic', '%'],
  ['Insulin (fasting)', 'Metabolic', 'µIU/mL'],

  ['CRP', 'Inflammation', 'mg/L'],
  ['hs-CRP', 'Inflammation', 'mg/L'],
  ['ESR', 'Inflammation', 'mm/hr'],
  ['Creatine kinase (CK)', 'Inflammation', 'U/L'],
];
