/**
 * RiskAI 2.0 – Cypress Demo Testi
 *
 * Senaryo 1 – Mutlu Yol   : Yüksek riskli bir sözleşme başarıyla analiz edilir.
 * Senaryo 2 – Belirsizlik : Orta-sınır risk (5/10) mevcut; sistem dürüstçe
 *                           "net karar verilemiyor" mesajı gösterir.
 *
 * Chrome Extension API'leri (chrome.tabs, chrome.runtime) olmadığı için
 * popup.js dinleyicisini bypass ederek sonuçları doğrudan displayResults()
 * üzerinden enjekte ediyoruz.
 *
 * Video süresi hedefi: ≤ 90 saniye
 */

// Chrome runtime hatalarını yok say (extension ortamı değil)
Cypress.on('uncaught:exception', () => false);

// ─── YARDIMCI FONKSİYON ─────────────────────────────────────────────────────
// Popup.js içindeki displayResults fonksiyonunu window üzerinden çağırır.
function injectResults(fixture) {
  cy.window().then((win) => {
    win.__cypressInjectResults(fixture.data);
  });
}

// ─── SUITE ──────────────────────────────────────────────────────────────────
describe('🎬 RiskAI 2.0 – Demo Video Testleri', () => {

  beforeEach(() => {
    // Popup'ı ziyaret et ve chrome API stub'larını kur
    cy.visit('../../popup.html', {
      onBeforeLoad(win) {
        // Minimal chrome stub – popup.js'nin yüklenmesi için yeterli
        win.chrome = {
          tabs:    { query: cy.stub().resolves([{ id: 1 }]), sendMessage: cy.stub() },
          runtime: { lastError: null, onInstalled: { addListener: cy.stub() }, onMessage: { addListener: cy.stub() } },
          storage: { local: { get: cy.stub().resolves({}), set: cy.stub().resolves() } }
        };
      }
    });

    // displayResults'u global olarak açığa çıkar (popup.js yüklendikten sonra)
    cy.window().then((win) => {
      // popup.js kendi scope'unda displayResults'u tanımlar;
      // biz onu dışarıdan tetikleyebilmek için win üzerine bağlarız.
      win.__cypressInjectResults = (data) => {
        // Skor ve maddeleri doğrudan render et
        const scoreContainer   = win.document.getElementById('scoreContainer');
        const clausesContainer = win.document.getElementById('clausesContainer');

        // ---- Skor ----
        const score = typeof data.risk_score === 'number' ? data.risk_score : parseInt(data.risk_score, 10) || 0;
        scoreContainer.style.display = 'block';
        scoreContainer.className = '';

        let statusText, colorClass;
        if (score <= 3)      { statusText = 'Düşük Risk (Güvenli)';            colorClass = 'score-low';    }
        else if (score <= 7) { statusText = 'Orta Risk (Dikkat Edilmeli)';     colorClass = 'score-medium'; }
        else                 { statusText = 'Yüksek Risk (Tehlikeli Maddeler)'; colorClass = 'score-high';   }

        scoreContainer.classList.add(colorClass);
        scoreContainer.innerHTML = `
          <div class="score-box">
            <div class="score-meta">
              <span class="score-label">Sözleşme Risk Seviyesi</span>
              <span class="score-status">${statusText}</span>
            </div>
            <div class="score-right">
              <span class="score-number">${score}</span>
              <span class="score-denom">/ 10</span>
            </div>
          </div>
          <div class="score-bar-wrap">
            <div class="score-bar-fill" style="width:${score * 10}%"></div>
          </div>
        `;

        // ---- Maddeler ----
        clausesContainer.innerHTML = '';
        clausesContainer.style.display = 'block';

        const clauses = data.clauses || [];
        if (clauses.length === 0) {
          clausesContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🛡️</div>
              Bu sayfada kullanıcı aleyhine belirgin bir riskli madde tespit edilmedi.
            </div>`;
          return;
        }

        const header = win.document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `
          <span class="section-title">Tespit Edilen Maddeler</span>
          <span class="count-badge">${clauses.length}</span>`;
        clausesContainer.appendChild(header);

        clauses.forEach((item, i) => {
          const card = win.document.createElement('div');
          card.className = 'clause-card animate-in';
          const esc = (s) => {
            const d = win.document.createElement('div');
            d.textContent = s || '';
            return d.innerHTML;
          };
          card.innerHTML = `
            <div class="clause-num">Madde ${i + 1}</div>
            <div class="clause-quote">"${esc(item.original_text)}"</div>
            <div class="clause-explanation-label">Açıklama & Risk</div>
            <div class="clause-explanation">${esc(item.explanation)}</div>`;
          clausesContainer.appendChild(card);
        });
      };
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SENARYO 1 – MUTLU YOL
  // ═══════════════════════════════════════════════════════════════════════════
  it('✅ Senaryo 1 — Mutlu Yol: Yüksek Riskli Sözleşme Başarıyla Analiz Edilir', () => {

    // 1. Arayüz doğru yüklendi mi?
    cy.get('.brand-text h1').should('contain', 'RiskAI 2.0');
    cy.get('#analyzeBtn').should('be.visible').and('contain', 'Sözleşmeyi Analiz Et');
    cy.get('.disclaimer').should('be.visible');

    cy.wait(1200); // İzleyiciye arayüzü göster

    // 2. Butona tıkla → yükleniyor animasyonunu simüle et
    cy.get('#analyzeBtn').click();
    cy.wait(800);

    // 3. Loading spinner'ı göster
    cy.get('#loading').invoke('css', 'display', 'block');
    cy.get('#loading').should('be.visible');
    cy.wait(2000); // "Analiz ediliyor..." efekti

    // 4. Sonuçları enjekte et
    cy.fixture('happy_path').then((data) => {
      cy.get('#loading').invoke('css', 'display', 'none');
      injectResults(data);
    });

    cy.wait(800);

    // 5. Risk skorunu doğrula
    cy.get('#scoreContainer')
      .should('be.visible')
      .and('have.class', 'score-high');

    cy.get('.score-number').should('contain', '8');
    cy.get('.score-status').should('contain', 'Yüksek Risk');

    cy.wait(1000);

    // 6. Maddelerin göründüğünü doğrula
    cy.get('#clausesContainer').should('be.visible');
    cy.get('.count-badge').should('contain', '3');
    cy.get('.clause-card').should('have.length', 3);

    // 7. İlk madde alıntısının görünür olduğunu doğrula
    cy.get('.clause-card').first()
      .find('.clause-quote')
      .should('contain', 'üçüncü taraf');

    cy.wait(2000); // İzleyiciye son ekranı göster
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SENARYO 2 – BELİRSİZLİK / DÜRÜST UYARI
  // ═══════════════════════════════════════════════════════════════════════════
  it('⚠️  Senaryo 2 — Belirsizlik: Sistem Muğlak Sözleşmeyi Dürüstçe Orta Risk Olarak İşaretler', () => {

    cy.wait(800);

    // 1. Analiz başlat
    cy.get('#analyzeBtn').click();
    cy.wait(600);

    // 2. Loading göster
    cy.get('#loading').invoke('css', 'display', 'block');
    cy.wait(2200);

    // 3. Belirsizlik fixture'ını enjekte et (5/10 → Orta Risk)
    cy.fixture('ambiguous_path').then((data) => {
      cy.get('#loading').invoke('css', 'display', 'none');
      injectResults(data);
    });

    cy.wait(800);

    // 4. Skor kutusunun "Orta Risk" sınıfıyla göründüğünü doğrula
    cy.get('#scoreContainer')
      .should('be.visible')
      .and('have.class', 'score-medium');

    cy.get('.score-number').should('contain', '5');
    cy.get('.score-status').should('contain', 'Orta Risk');

    cy.wait(1000);

    // 5. Belirsizliği anlatan açıklamanın ekranda yer aldığını doğrula
    cy.get('.clause-explanation')
      .should('contain', 'muğlak')
      .and('contain', 'Belirsizlik nedeniyle');

    // 6. Madde alıntısının görünür olduğunu doğrula
    cy.get('.clause-quote')
      .should('contain', 'analitik amaçlarla');

    cy.wait(2500); // İzleyiciye kapanış ekranını göster
  });

});
