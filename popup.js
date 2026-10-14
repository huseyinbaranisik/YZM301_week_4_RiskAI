document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn      = document.getElementById('analyzeBtn');
  const loadingDiv      = document.getElementById('loading');
  const errorContainer  = document.getElementById('errorContainer');
  const errorText       = document.getElementById('errorText');
  const scoreContainer  = document.getElementById('scoreContainer');
  const clausesContainer = document.getElementById('clausesContainer');

  analyzeBtn.addEventListener('click', async () => {
    resetUI();
    setLoadingState(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showError('Aktif sekme tespit edilemedi.');
        setLoadingState(false);
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'analyze_tos' }, (response) => {
        setLoadingState(false);

        if (chrome.runtime.lastError) {
          showError(
            'İçerik scripti ile iletişim kurulamadı. Sayfayı yenileyip tekrar deneyin. (Hata: ' +
            chrome.runtime.lastError.message + ')'
          );
          return;
        }

        if (!response) {
          showError('Sayfadan veya arka plan servisinden geçerli bir yanıt alınamadı.');
          return;
        }

        if (response.status === 'success' && response.data) {
          displayResults(response.data);
        } else if (response.status === 'error') {
          showError(response.message || 'Analiz sırasında bilinmeyen bir hata oluştu.');
        } else {
          showError('Beklenmeyen bir yanıt formatı alındı.');
        }
      });
    } catch (err) {
      setLoadingState(false);
      showError('İşlem başlatılırken bir hata oluştu: ' + err.message);
    }
  });

  // ── Yükleniyor durumunu aç/kapa ─────────────────
  function setLoadingState(isLoading) {
    if (isLoading) {
      loadingDiv.style.display = 'block';
      analyzeBtn.disabled = true;
    } else {
      loadingDiv.style.display = 'none';
      analyzeBtn.disabled = false;
    }
  }

  // ── Arayüzü sıfırla ─────────────────────────────
  function resetUI() {
    errorContainer.style.display  = 'none';
    if (errorText) errorText.textContent = '';
    scoreContainer.style.display   = 'none';
    scoreContainer.innerHTML        = '';
    clausesContainer.style.display  = 'none';
    clausesContainer.innerHTML      = '';
  }

  // ── Hata göster ─────────────────────────────────
  function showError(message) {
    if (errorText) {
      errorText.textContent = message;
    } else {
      errorContainer.textContent = message;
    }
    errorContainer.style.display = 'flex';
  }

  // ── Sonuçları render et ─────────────────────────
  function displayResults(data) {
    renderRiskScore(data.risk_score);
    renderClauses(data.clauses);
  }

  // ── Risk skoru kartı ─────────────────────────────
  function renderRiskScore(score) {
    const numericScore = typeof score === 'number' ? score : parseInt(score, 10) || 0;
    scoreContainer.style.display = 'block';
    scoreContainer.className = '';  // önceki sınıfları temizle

    let statusText, colorClass;

    if (numericScore <= 3) {
      statusText = 'Düşük Risk — Güvenli Görünüyor';
      colorClass = 'score-low';
    } else if (numericScore <= 7) {
      statusText = 'Orta Risk — Dikkat Edilmeli';
      colorClass = 'score-medium';
    } else {
      statusText = 'Yüksek Risk — Tehlikeli Maddeler Var';
      colorClass = 'score-high';
    }

    scoreContainer.classList.add(colorClass);
    scoreContainer.innerHTML = `
      <div class="score-box">
        <div class="score-meta">
          <span class="score-label">Sözleşme Risk Seviyesi</span>
          <span class="score-status">${statusText}</span>
        </div>
        <div class="score-right">
          <span class="score-number">${numericScore}</span>
          <span class="score-denom">/ 10</span>
        </div>
      </div>
      <div class="score-bar-wrap">
        <div class="score-bar-fill" style="width:${numericScore * 10}%"></div>
      </div>
    `;
  }

  // ── Madde kartları ───────────────────────────────
  function renderClauses(clauses) {
    clausesContainer.innerHTML = '';

    if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
      clausesContainer.style.display = 'block';
      clausesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛡️</div>
          Bu sayfada kullanıcı aleyhine belirgin bir riskli madde tespit edilmedi.
        </div>
      `;
      return;
    }

    clausesContainer.style.display = 'block';

    // Bölüm başlığı
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-title">Tespit Edilen Maddeler</span>
      <span class="count-badge">${clauses.length}</span>
    `;
    clausesContainer.appendChild(header);

    clauses.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'clause-card animate-in';

      // Prompt Injection tespiti
      const isPromptInjection = item.explanation &&
        item.explanation.includes('Prompt Injection');

      if (isPromptInjection) {
        card.classList.add('injection-alert');
      }

      const originalText    = item.original_text  ? escapeHtml(item.original_text)  : 'Metin alıntılanmadı';
      const explanationText = item.explanation     ? escapeHtml(item.explanation)    : 'Açıklama belirtilmedi';

      card.innerHTML = `
        ${isPromptInjection
          ? '<div class="injection-badge">🚨 GÜVENLİK TEHDİDİ — PROMPT INJECTION</div>'
          : ''}
        <div class="clause-num">Madde ${index + 1}</div>
        <div class="clause-quote">"${originalText}"</div>
        <div class="clause-explanation-label">Açıklama &amp; Risk</div>
        <div class="clause-explanation">${explanationText}</div>
      `;

      clausesContainer.appendChild(card);
    });
  }

  // ── XSS önleme ──────────────────────────────────
  function escapeHtml(string) {
    if (typeof string !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = string;
    return div.innerHTML;
  }
});
