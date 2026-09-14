const fs=require('fs');let h=fs.readFileSync('app.html','utf8');const f=JSON.parse(fs.readFileSync('fonts.json'));const im=JSON.parse(fs.readFileSync('imgs.json'));
h=h.replace(/__LOGO__/g,'data:image/png;base64,'+im.logo).replace(/__CARD__/g,'data:image/png;base64,'+im.card)
 .replace('__FONTS__','window.FONTS='+JSON.stringify(f)+';').replace('__IMGS__','window.IMGS='+JSON.stringify({logoW:'data:image/png;base64,'+im.logoW,logoR:'data:image/png;base64,'+im.logoR})+';')
 .replace('__CONTENT__',fs.readFileSync('pdfcontent.js','utf8'));
fs.writeFileSync('index.html',h);fs.writeFileSync('test.html',h.replace('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','t/package/dist/jspdf.umd.min.js'));console.log(h.length);
