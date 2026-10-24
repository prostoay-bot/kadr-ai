// Regression tests for the page-level OCR guard in index.html.
// Run: node --test tests/ocr-quality.test.cjs
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function assessScannedPage(');
const end=html.indexOf('async function parsePdf(file){',start);
assert.ok(start>=0 && end>start,'OCR helper must remain present in the application');
const context=vm.createContext({});
vm.runInContext(html.slice(start,end),context);
const check=(text,confidence,page)=>context.assessScannedPage(text,confidence,page);
test('good Russian OCR page passes',()=>{
 assert.equal(check('Трудовой договор. Работник принимается на должность специалиста с окладом 100 000 рублей.',92,1),null);
});
test('empty scan blocks audit',()=>{assert.match(check('',96,2),/страница 2.*мало текста/)});
test('short extracted scan blocks audit',()=>{assert.match(check('Трудовой договор',83,3),/страница 3.*мало текста/)});
test('low confidence scan blocks audit even with enough characters',()=>{
 assert.match(check('Трудовой договор и приложения. '.repeat(8),43,4),/страница 4.*уверенность/);
});
test('missing OCR confidence blocks audit',()=>{
 assert.match(check('Трудовой договор и приложения. '.repeat(8),null,5),/страница 5.*нет достоверной оценки/);
});
test('NaN confidence blocks audit',()=>{
 assert.match(check('Трудовой договор и приложения. '.repeat(8),NaN,6),/страница 6.*нет достоверной оценки/);
});
test('multiple reasons are reported together',()=>{
 const result=check('нет',15,7);
 assert.match(result,/мало текста/);assert.match(result,/уверенность/);
});
