/**
 * Each Root City district's colour and the ink on it: the city screen draws them, and the
 * city's banner (a keepsake) flies its first district's colour over every settlement.
 */
export const DISTRICT_LOOK: Record<string, { color: string; ink: string }> = {
  millraceQuarter: { color: '#3A6EA5', ink: '#e8f1fa' },
  orchardWard: { color: '#E0A33B', ink: '#4a3410' },
  mendedCommons: { color: '#2E8B6A', ink: '#eaf6ef' },
  foundryDistrict: { color: '#B85C6E', ink: '#fbecef' },
  tidalQuarter: { color: '#2F5E63', ink: '#e6f2f2' },
  ridgeQuarter: { color: '#6B5B4E', ink: '#f4ece2' },
  sunQuarter: { color: '#C8743A', ink: '#fff4e6' },
  canalQuarter: { color: '#7A4E8A', ink: '#f6eef8' },
  canopyQuarter: { color: '#3E6B2E', ink: '#eef6e6' },
};

export const districtLook = (id: string) =>
  DISTRICT_LOOK[id] ?? { color: '#9e9280', ink: '#fffbf0' };
