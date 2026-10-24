const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('all inline JavaScript parses',()=>{
 const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
 assert.ok(js.length>0);
 js.forEach((code,i)=>assert.doesNotThrow(()=>new vm.Script(code,{filename:'inline-'+i+'.js'})));
});
test('local PDF.js worker version agrees with main library',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../vendor/pdfjs/pdf.mjs'),'utf8').slice(0,5000);
 const worker=fs.readFileSync(path.join(__dirname,'../vendor/pdfjs/pdf.worker.mjs'),'utf8').slice(0,5000);
 const version=x=>x.match(/pdfjsVersion\s*=\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
 assert.ok(version(main),'Missing main PDF.js version');
 assert.equal(version(main),version(worker));
});
test('law corpus metadata explicitly records verification status',()=>{
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/tk-rf.json'),'utf8'));
 assert.equal(corpus.source_verified,false);
 assert.equal(corpus.edition_verified,false);
 assert.ok(corpus.text.length>100000);
});
test('app does not silently accept unsupported DOC',()=>{
 assert.match(html,/\['pdf','docx','txt','jpg','jpeg','png','webp','bmp'\]/);
 assert.match(html,/Формат \./);
});
