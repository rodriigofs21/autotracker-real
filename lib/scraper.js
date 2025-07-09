// lib/scraper.js
const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');

async function getBrowser() {
  return puppeteer.launch({
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: chrome.headless,
  });
}

async function scrapeUrl(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    const isWebMotors = url.includes('webmotors.com');

    if (isWebMotors) {
      console.log('🤖 Extraindo dados do WebMotors...');
      await page.waitForSelector('.CardVehicle', { timeout: 15000 });
      return page.evaluate(() => {
        return Array.from(document.querySelectorAll('.CardVehicle')).map(card => {
          try {
            const titleEl = card.querySelector('h2');
            const priceEl = card.querySelector('.CardVehicle__price');
            const yearKmEl = card.querySelector('.CardVehicle__year-km');
            const locationEl = card.querySelector('.CardVehicle__location');
            const linkEl = card.querySelector('a');

            return {
              titulo_anuncio: titleEl ? titleEl.innerText.trim() : null,
              valor_anunciado: priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9,-]+/g, "").replace(",", ".")) : null,
              ano: yearKmEl ? parseInt(yearKmEl.innerText.split('/')[0].trim()) : null,
              quilometragem: yearKmEl && yearKmEl.innerText.includes('km') ? parseInt(yearKmEl.innerText.split('•')[1].replace(/\D/g, '')) : null,
              localidade: locationEl ? locationEl.innerText.trim() : null,
              link_anuncio: linkEl ? linkEl.href : null,
              site_origem: 'webmotors',
            };
          } catch(e) { return null; }
        }).filter(v => v && v.titulo_anuncio && v.link_anuncio);
      });
    } else { // OLX
      console.log('🤖 Extraindo dados da OLX...');
      await page.waitForSelector('[data-testid="ad-card"]', { timeout: 15000 });
      return page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-testid="ad-card"]')).map(card => {
          try {
            const titleEl = card.querySelector('h2');
            const priceEl = card.querySelector('[data-testid="ad-price"]');
            const linkEl = card.querySelector('a');
            
            const props = Array.from(card.querySelectorAll('[data-testid="ad-features"] span'));
            const year = props.find(p => /^\d{4}$/.test(p.innerText))?.innerText;
            const km = props.find(p => p.innerText.toLowerCase().includes('km'))?.innerText;

            return {
              titulo_anuncio: titleEl ? titleEl.innerText.trim() : null,
              valor_anunciado: priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9,-]+/g, "").replace(",", ".")) : null,
              ano: year ? parseInt(year) : null,
              quilometragem: km ? parseInt(km.replace(/\D/g, '')) : null,
              localidade: card.querySelector('[data-testid="ad-location"]')?.innerText.trim(),
              link_anuncio: linkEl ? linkEl.href : null,
              site_origem: 'olx',
            };
          } catch(e) { return null; }
        }).filter(v => v && v.titulo_anuncio && v.link_anuncio);
      });
    }
  } catch (error) {
    console.error(`❌ Erro ao processar URL ${url}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeUrl };