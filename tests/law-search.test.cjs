const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/tk-rf.json'),'utf8')).text;
const extract=(begin,end)=>{const a=html.indexOf(begin);const b=html.indexOf(end,a);assert.ok(a>=0&&b>a,begin);return html.slice(a,b)};
const ctx=vm.createContext({});
vm.runInContext(extract('function normalizedLawText(s){','function lawTokens(q){'),ctx);
vm.runInContext(extract('function detectTkArticleQuery(input){','lawResultsHtml=function(){'),ctx);
test('article 57 exists in local corpus',()=>assert.match(corpus,/(?:^|\n)Статья 57\. /));
test('article 341.1-1 exists in local corpus',()=>assert.match(corpus,/(?:^|\n)Статья 341\.1-1\. /));
for(const [q,num] of [['57','57'],['статья 57','57'],['ст. 57','57'],['ТК РФ статья 57','57'],['341.1-1','341.1-1'],['статья 341.1-1','341.1-1']]){
 test('exact article search: '+q,()=>assert.equal(ctx.detectTkArticleQuery(q),num));
}
test('full-text search is rendered before topic catalog',()=>{
 assert.ok(html.includes('Поиск по тексту ТК РФ'));
 assert.ok(html.includes("const requested=detectTkArticleQuery(q)"));
});
