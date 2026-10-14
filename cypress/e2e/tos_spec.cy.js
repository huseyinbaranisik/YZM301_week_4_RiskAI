describe('Sözleşme Dedektifi UI Testleri', () => {
  // Cypress'in Chrome eklenti ortamında olmamasından kaynaklanan API hatalarını yoksay
  Cypress.on('uncaught:exception', (err, runnable) => {
    return false;
  });

  it('Popup arayüzü hatasız yüklenmeli ve gerekli elemanları göstermeli', () => {
    cy.visit('../../popup.html'); 
    
    // Ana başlığın sayfada olduğunu doğrula
    cy.contains('Sözleşme Dedektifi').should('be.visible');
    
    // Butonun görünür ve doğru metne sahip olduğunu doğrula
    cy.get('#analyzeBtn').should('be.visible').and('contain', 'Sözleşmeyi Analiz Et');
    
    // Yasal uyarının görünür olduğunu kesin olarak doğrula
    cy.contains('DİKKAT: Bu uygulama hukuki tavsiye vermez.').should('be.visible');
  });
});