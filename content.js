/**
 * Alibaba Page-Agent esintili DOM ve metin çıkarma motoru.
 * Sayfadaki gereksiz öğeleri (script, style, nav, footer, header, reklam alanları) filtreleyip
 * görünür ana Kullanım Koşulları (ToS) metnini temiz bir metin olarak çıkarır.
 */

function isElementVisible(elem) {
  if (!elem) return false;
  const style = window.getComputedStyle(elem);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  if (elem.offsetWidth === 0 && elem.offsetHeight === 0 && !elem.getClientRects().length) {
    return false;
  }
  return true;
}

function extractTermsText() {
  const ignoreTags = new Set([
    'SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE',
    'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS', 'BUTTON', 'INPUT',
    'TEXTAREA', 'SELECT', 'DIALOG', 'MENU'
  ]);

  const adAndBoilerplateSelectors = [
    '[role="banner"]',
    '[role="navigation"]',
    '[role="complementary"]',
    '[aria-hidden="true"]',
    '.ad', '.ads', '.advertisement', '.sponsor',
    'ins.adsbygoogle',
    '[class*="cookie"]', '[id*="cookie"]',
    '[class*="banner"]', '[id*="banner"]',
    '[class*="popup"]', '[id*="popup"]',
    '[class*="modal"]', '[id*="modal"]'
  ];

  // Olası ana metin taşıyıcıları (Terms/Legal/Content konteynerları)
  const candidateSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.terms-of-service',
    '.terms',
    '.tos',
    '.legal-content',
    '#content',
    '.content'
  ];

  let targetRoot = null;
  for (const selector of candidateSelectors) {
    const el = document.querySelector(selector);
    if (el && isElementVisible(el) && el.textContent.trim().length > 300) {
      targetRoot = el;
      break;
    }
  }

  // Özel konteyner bulunamazsa document.body üzerinden devam edilir
  if (!targetRoot) {
    targetRoot = document.body;
  }

  // Kriterlere göre öğenin filtrelenmesi gerekip gerekmediğini kontrol eder
  function shouldFilterNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    if (ignoreTags.has(node.tagName)) return true;

    if (!isElementVisible(node)) return true;

    for (const selector of adAndBoilerplateSelectors) {
      try {
        if (node.matches(selector)) return true;
      } catch (e) {
        // Geçersiz seçici durumunda atla
      }
    }

    return false;
  }

  const extractedParagraphs = [];

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        extractedParagraphs.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (shouldFilterNode(node)) {
        return;
      }

      const isBlock = [
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'SECTION', 'ARTICLE', 'TR', 'BLOCKQUOTE'
      ].includes(node.tagName);

      for (let child = node.firstChild; child; child = child.nextSibling) {
        traverse(child);
      }

      if (isBlock) {
        extractedParagraphs.push('\n');
      }
    }
  }

  traverse(targetRoot);

  return extractedParagraphs
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// Popup'tan gelen 'Analizi Başlat' tetiklemesini dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'analyze_tos') {
    const textContent = extractTermsText();

    if (!textContent || textContent.length < 50) {
      sendResponse({
        status: 'error',
        message: 'Sayfada analiz edilebilecek anlamlı bir metin tespit edilemedi.'
      });
      return false;
    }

    // Metni işlenmek üzere background.js'ye gönder
    chrome.runtime.sendMessage(
      {
        action: 'process_tos_with_llm',
        text: textContent
      },
      (bgResponse) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            status: 'error',
            message: 'Arka plan servisiyle iletişim kurulamadı: ' + chrome.runtime.lastError.message
          });
        } else {
          sendResponse(bgResponse);
        }
      }
    );

    return true; // Asenkron yanıt için kanalı açık tut
  }
});
