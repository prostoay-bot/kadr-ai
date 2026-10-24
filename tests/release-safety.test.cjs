const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const from=html.indexOf('function validIsoDate(s){');
const to=html.indexOf('function checkContractText(){',from);
assert.ok(from>=0 && to>from,'Safety helpers must exist');
const ctx=vm.createContext({});
vm.runInContext(html.slice(from,to),ctx);
test('valid Gregorian date',()=>assert.equal(ctx.validIsoDate('2028-02-29'),true));
test('impossible February date rejected',()=>assert.equal(ctx.validIsoDate('2027-02-29'),false));
test('bad date format rejected',()=>assert.equal(ctx.validIsoDate('2026-2-01'),false));
test('passport series+number rejected',()=>assert.equal(ctx.containsSensitiveId('Паспорт 45 11 123456'),true));
test('SNILS rejected',()=>assert.equal(ctx.containsSensitiveId('СНИЛС 123-456-789 01'),true));
test('synthetic employment terms accepted',()=>assert.equal(ctx.containsSensitiveId('Оклад 100000 рублей. Отпуск 28 календарных дней.'),false));
test('automatic audit blocked for sensitive text',()=>{
 assert.match(html,/if\(s&&containsSensitiveId\(s\)\)/);
});
test('OCR outputs cannot auto-audit without warning',()=>{
 assert.match(html,/if\(out\.warnings\?\.length\)/);
});
test('backup import restores old state on failed save',()=>{
 assert.ok(html.includes('const previousDb=db;db=x;') && html.includes('if(!save()){db=previousDb;return}'));
});
