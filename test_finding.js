// Quick test for the finding
// Load the actual compiled code
const helpers = require('./src/lib/signup/helpers.ts');

const testCases = [
  { text: 'Yeah, looks good', expected: true, desc: 'Affirmative with looks good' },
  { text: 'Okay, the box shows the right email', expected: false, desc: 'Screen description with box' },
  { text: 'Yes. looks good', expected: true, desc: 'Yes with looks good' },
  { text: 'Yeah looks right', expected: true, desc: 'Yeah with looks right' },
];

console.log('Testing isAccountConsentYes:');
testCases.forEach(({ text, expected, desc }) => {
  const result = helpers.isAccountConsentYes(text);
  const pass = result === expected ? 'PASS' : 'FAIL';
  console.log(`${pass}: ${desc}`);
  console.log(`  Input: "${text}"`);
  console.log(`  Expected: ${expected}, Got: ${result}`);
});
