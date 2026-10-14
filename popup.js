document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingDiv = document.getElementById('loading');
  const errorContainer = document.getElementById('errorContainer');
  const scoreContainer = document.getElementById('scoreContainer');
  const clausesContainer = document.getElementById('clausesContainer');

  analyzeBtn.addEventListener('click', async () => {
    // Önceki sonuç ve hata alanlarını sıfırla
    resetUI();

    // Yükleniyor durumunu aktif et
    setLoadingState(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showError('Aktif sekme tespit edilemedi.');
        setLoadingState(false);
        return;
      }

      // content.js scriptine mesaj gönder
      chrome.tabs.sendMessage(tab.id, { action: 'analyze_tos' }, (response) => {
        setLoadingState(false);

        if (chrome.runtime.lastError) {
          showError(
            'İçerik scripti ile iletişim kurulamadı. Lütfen sayfayı yenileyip eklentiyi tekrar çalıştırın. (Hata: ' +
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

  function setLoadingState(isLoading) {
    if (isLoading) {
      loadingDiv.style.display = 'block';
      analyzeBtn.disabled = true;
      analyzeBtn.style.opacity = '0.65';
    } else {
      loadingDiv.style.display = 'none';
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = '1';
    }
  }

  function resetUI() {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    scoreContainer.style.display = 'none';
    scoreContainer.innerHTML = '';
    clausesContainer.style.display = 'none';
    clausesContainer.innerHTML = '';
  }

  function showError(message) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }

  function displayResults(data) {
    // 1. Risk Puanını Göster ve Renklendir
    renderRiskScore(data.risk_score);

    // 2. Tespit Edilen Maddeleri Listele
    renderClauses(data.clauses);
  }

  function renderRiskScore(score) {
    const numericScore = typeof score === 'number' ? score : parseInt(score, 10) || 0;
    scoreContainer.style.display = 'block';
    scoreContainer.className = ''; // Eski sınıfları temizle

    let statusText = '';
    let colorClass = '';

    if (numericScore <= 3) {
      statusText = 'Düşük Risk (Güvenli)';
      colorClass = 'score-low';
    } else if (numericScore <= 7) {
      statusText = 'Orta Risk (Dikkat Edilmeli)';
      colorClass = 'score-medium';
    } else {
      statusText = 'Yüksek Risk (Tehlikeli Maddeler)';
      colorClass = 'score-high';
    }

    scoreContainer.classList.add(colorClass);
    scoreContainer.innerHTML = `
      <div class="score-box">
        <div class="score-meta">
          <span class="score-title">Sözleşme Risk Seviyesi</span>
          <span class="score-status">${statusText}</span>
        </div>
        <div class="score-number">${numericScore} / 10</div>
      </div>
    `;
  }

  function renderClauses(clauses) {
    clausesContainer.innerHTML = '';

    if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
      clausesContainer.style.display = 'block';
      clausesContainer.innerHTML = `
        <div class="empty-state">
          🛡️ Bu sayfada kullanıcı aleyhine belirgin bir riskli madde tespit edilmedi.
        </div>
      `;
      return;
    }

    clausesContainer.style.display = 'block';

    const header = document.createElement('div');
    header.className = 'section-title';
    header.textContent = `Tespit Edilen Maddeler (${clauses.length})`;
    clausesContainer.appendChild(header);

    clauses.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'clause-card';

      const isPromptInjection = item.explanation && item.explanation.includes('Prompt Injection');
      if (isPromptInjection) {
        card.classList.add('injection-alert');
      }

      const originalText = item.original_text ? escapeHtml(item.original_text) : 'Metin alıntılanmadı';
      const explanationText = item.explanation ? escapeHtml(item.explanation) : 'Açıklama belirtilmedi';

      card.innerHTML = `
        ${isPromptInjection ? '<div class="injection-badge">🚨 GÜVENLİK TEHDİDİ (PROMPT INJECTION)</div>' : ''}
        <span class="clause-label" style="color: #64748b;">Madde ${index + 1} - Orijinal Metin:</span>
        <div class="clause-quote">"${originalText}"</div>
        <span class="clause-label" style="color: #0f172a;">Açıklama & Risk:</span>
        <div class="clause-explanation">${explanationText}</div>
      `;

      clausesContainer.appendChild(card);
    });
  }

  function escapeHtml(string) {
    if (typeof string !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = string;
    return div.innerHTML;
  }
});
