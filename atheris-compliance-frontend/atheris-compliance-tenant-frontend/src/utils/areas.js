export const AREAS_OF_FOCUS = [
  'AML/CFT', 'Corporate Governance', 'Conduct Risk', 'Data Protection',
  'Consumer Protection', 'Cybersecurity', 'Anti-Bribery & Corruption',
  'Capital Market', 'Compliance Risk Management', 'ESG', 'Account Management',
  'Cash Management', 'Financial Reporting',
];

export function areaOptions(extra = []) {
  const used = (extra || []).filter((a) => a && a !== 'Unassigned');
  return Array.from(new Set([...AREAS_OF_FOCUS, ...used])).sort();
}