import fs from 'node:fs';
import path from 'node:path';

export function readLegalIdentity(docsDir) {
  const entity = fs.readFileSync(path.join(docsDir, 'ENTITY.md'), 'utf8');
  const field = (label) => entity.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`))?.[1]?.trim();
  const values = {
    appName: field('App display name'), domain: field('Production domain'), legalOperator: field('Legal operator'),
    effectiveDate: field('Effective date'), lastUpdated: field('Last updated'), supportEmail: field('Support email'),
    privacyEmail: field('Privacy email'), mailingAddress: field('Mailing address'), governingLaw: field('Governing law'), disputeVenue: field('Dispute venue'),
  };
  const unresolved = Object.entries(values).filter(([, value]) => !value || /\[|\]|TBA|yourdomain|YOUR /i.test(value));
  if (unresolved.length) throw new Error(`Complete docs/legal/ENTITY.md before generation: ${unresolved.map(([key]) => key).join(', ')}`);
  return values;
}

export function applyLegalIdentity(source, v) {
  const replacements = [
    [/\[LAST UPDATED DATE — see docs\/legal\/ENTITY\.md\]/g, v.lastUpdated],
    [/\[EFFECTIVE DATE — see docs\/legal\/ENTITY\.md\]/g, v.effectiveDate],
    [/\[YOUR COMPANY LLC\]/g, v.legalOperator],
    [/support@yourdomain\.com/g, v.supportEmail],
    [/https:\/\/yourdomain\.com/g, `https://${v.domain}`],
    [/yourdomain\.com/g, v.domain],
    [/\[YOUR STATE\], United States/g, v.governingLaw],
    [/state or federal courts located in \[YOUR COUNTY\], \[YOUR STATE\]/gi, v.disputeVenue],
    [/Local Marketplace/g, v.appName],
  ];
  let output = source;
  for (const [pattern, value] of replacements) output = output.replace(pattern, value);
  return output;
}
