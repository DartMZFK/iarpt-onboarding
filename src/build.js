// Сборка: src/app.html -> ../index.html (обычный хостинг) и ../index_tilda.html (блок T123 «свой код»)
const fs = require('fs');

const src = fs.readFileSync('app.html', 'utf8');
const fonts = JSON.parse(fs.readFileSync('fonts.json'));
const imgs = JSON.parse(fs.readFileSync('imgs.json'));
const b64 = k => 'data:image/png;base64,' + imgs[k];

const filled = src
  .replace(/__LOGO__/g, b64('logo'))
  .replace(/__CARD__/g, b64('card'))
  .replace('__FONTS__', 'window.FONTS=' + JSON.stringify(fonts) + ';')
  .replace('__IMGS__', 'window.IMGS=' + JSON.stringify({ logoW: b64('logoW'), logoR: b64('logoR') }) + ';')
  .replace('__CONTENT__', fs.readFileSync('pdfcontent.js', 'utf8'));

// всё до обёртки — это head (title, шрифты, стили), всё начиная с неё — body
const MARK = '<div id="iarpt-onb">';
const at = filled.indexOf(MARK);
if (at < 0) throw new Error('не найдена обёртка ' + MARK);
const head = filled.slice(0, at);
const body = filled.slice(at);

const standalone = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#BC2C2C">
${head.trim()}
</head>
<body>
${body.trim()}
</body>
</html>
`;

// на Тильде страницу оформляет сама Тильда — свой сброс html/body не нужен
const tilda = (head.replace(/<style id="onb-page">[\s\S]*?<\/style>\s*/, '') + body).trim() + '\n';

fs.writeFileSync('../index.html', standalone);
fs.writeFileSync('../index_tilda.html', tilda);
console.log('index.html       %d KB', Math.round(standalone.length / 1024));
console.log('index_tilda.html %d KB', Math.round(tilda.length / 1024));
