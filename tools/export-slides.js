const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const WIDTH = 1440;
const HEIGHT = 900;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.SLIDE_URL || '';
const OUTPUT_DIR = path.resolve(process.env.SLIDE_OUTPUT_DIR || 'slide-screenshots');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function resolveRequestPath(rootDir, requestUrl) {
  const parsed = new URL(requestUrl || '/', 'http://127.0.0.1');
  const rawPath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  const decoded = decodeURIComponent(rawPath);
  const absolute = path.normalize(path.join(rootDir, decoded));
  if (!absolute.startsWith(rootDir)) return null;
  return absolute;
}

async function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolveRequestPath(rootDir, req.url);
      if (!filePath) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', getContentType(filePath));
        res.end(data);
      });
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}/index.html`,
      });
    });
  });
}

async function stopStaticServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(() => resolve()));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hideNav(page) {
  await page.evaluate(() => {
    const prevBtn = document.querySelector('button[aria-label="Previous slide"]');
    const nav = prevBtn ? prevBtn.closest('div.fixed') : null;
    if (nav) nav.style.display = 'none';
  });
}

async function clickIfVisible(page, roleNameRegex) {
  const button = page.getByRole('button', { name: roleNameRegex }).first();
  if (!(await button.count())) return false;
  try {
    await button.waitFor({ state: 'visible', timeout: 1400 });
    await button.click({ timeout: 1400 });
    await sleep(300);
    return true;
  } catch {
    return false;
  }
}

async function applyRevealSequence(page, slideNumber) {
  if (slideNumber === 7) {
    await clickIfVisible(page, /What Is A Frontier Firm/i);
    await clickIfVisible(page, /In Practice/i);
  }

  if (slideNumber === 8) {
    await clickIfVisible(page, /OECD Insight/i);
    await clickIfVisible(page, /Why It Matters/i);
  }

  if (slideNumber === 9) {
    await clickIfVisible(page, /Do we agree with Elon/i);
  }

  if (slideNumber === 10) {
    await clickIfVisible(page, /Show details/i);
  }

  if (slideNumber === 14) {
    await clickIfVisible(page, /Show tracking panel/i);
  }
}

async function fitOverflowIfNeeded(page) {
  for (let i = 0; i < 6; i += 1) {
    const metrics = await page.evaluate(() => {
      const stage = document.querySelector('.deck-fit-stage');
      const viewport = document.querySelector('.deck-slide-viewport');
      if (!stage || !viewport) {
        return { done: true };
      }

      const overflowW = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const overflowH = Math.max(0, stage.scrollHeight - stage.clientHeight);
      const currentScale = parseFloat(getComputedStyle(viewport).getPropertyValue('--deck-content-scale')) || 1;

      if (overflowW <= 1 && overflowH <= 1) {
        return {
          done: true,
          overflowW,
          overflowH,
          currentScale,
          nextScale: currentScale,
        };
      }

      const widthRatio = stage.clientWidth / Math.max(stage.scrollWidth, 1);
      const heightRatio = stage.clientHeight / Math.max(stage.scrollHeight, 1);
      const ratio = Math.min(widthRatio, heightRatio, 1);
      const nextScale = Math.max(0.6, currentScale * ratio * 0.992);

      viewport.style.setProperty('--deck-content-scale', String(nextScale));
      return {
        done: false,
        overflowW,
        overflowH,
        currentScale,
        nextScale,
      };
    });

    if (metrics.done) return;
    await sleep(120);
  }
}

async function goToSlide(page, slideNumber) {
  await page.evaluate((n) => {
    window.location.hash = `#slide-${n}`;
  }, slideNumber);

  await page.waitForTimeout(700);
  await page.waitForFunction(
    (n) => {
      const text = document.body?.innerText || '';
      const re = new RegExp(`Slide\\s+${n}\\s*\\/\\s*\\d+`, 'i');
      return re.test(text);
    },
    slideNumber,
    { timeout: 3500 }
  ).catch(() => {});

  // Force one extra layout pass for SlideFrame fit calculations.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(220);
}

async function buildPdf(browser, imageFiles) {
  const htmlPath = path.join(OUTPUT_DIR, 'slides-print.html');
  const pdfPath = path.join(OUTPUT_DIR, 'slides.pdf');

  const sections = imageFiles
    .map((name) => `<section class="page"><img src="${name}" alt="${name}" /></section>`)
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${WIDTH}px ${HEIGHT}px; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
${sections}
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');

  const pdfPage = await browser.newPage();
  await pdfPage.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await pdfPage.waitForTimeout(250);
  await pdfPage.pdf({
    path: pdfPath,
    printBackground: true,
    width: `${WIDTH}px`,
    height: `${HEIGHT}px`,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await pdfPage.close();

  try {
    fs.unlinkSync(htmlPath);
  } catch {
    // Best-effort cleanup only.
  }

  return pdfPath;
}

async function main() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let browser;
  let staticServer;

  try {
    let activeBaseUrl = BASE_URL;
    if (!activeBaseUrl) {
      const started = await startStaticServer(PROJECT_ROOT);
      staticServer = started.server;
      activeBaseUrl = started.baseUrl;
      console.log(`Serving slide deck from ${activeBaseUrl}`);
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      try { await dialog.dismiss(); } catch {}
    });
    page.on('popup', async (popup) => {
      try { await popup.close(); } catch {}
    });

    await page.goto(`${activeBaseUrl}#slide-1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const totalSlides = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const m = text.match(/Slide\s+\d+\s*\/\s*(\d+)/i);
      return m ? Number(m[1]) : 21;
    });

    const imageFiles = [];

    for (let i = 1; i <= totalSlides; i += 1) {
      await goToSlide(page, i);
      await applyRevealSequence(page, i);
      await fitOverflowIfNeeded(page);
      await hideNav(page);
      await page.waitForTimeout(280);

      const fileName = `slide-${pad2(i)}.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: false });
      imageFiles.push(fileName);
      console.log(`Captured ${fileName}`);
    }

    const pdfPath = await buildPdf(browser, imageFiles);
    console.log(`Created PDF: ${pdfPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopStaticServer(staticServer);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
