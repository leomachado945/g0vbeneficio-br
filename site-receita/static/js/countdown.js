// Countdown Timer Script
function startPixCountdown() {
    const countdownElement = document.getElementById('pixCountdown');
    if (!countdownElement) return;

    let timeLeft = 20 * 60; // 20 minutos em segundos

    const interval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        countdownElement.innerHTML = `<i class="fas fa-clock"></i> Prazo de pagamento expira em: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            countdownElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Prazo expirado!';
            countdownElement.style.background = '#dc3545';
        }
        
        timeLeft--;
    }, 1000);
}

// Função para copiar código PIX do modal de aguardando
function copyWaitingPixCode() {
    const pixCode = document.getElementById('waitingPixCode').textContent;
    const button = document.getElementById('waitingCopyButton');
    
    navigator.clipboard.writeText(pixCode).then(() => {
        button.innerHTML = '<i class="fas fa-check"></i> Código Copiado';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i> Copiar código PIX';
            button.style.background = '#0c326f';
        }, 3000);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar código. Por favor, copie manualmente.');
    });
}

// Função para redirecionar para página de multa
function redirectToMulta() {
    console.log('Redirecionando para multa.html...');
    window.location.href = 'multa.html';
}

// Fechar modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Adicionar event listeners quando o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para fechar modais ao clicar fora
    window.onclick = function(event) {
        const paymentModal = document.getElementById('paymentModal');
        const waitingModal = document.getElementById('waitingPaymentModal');
        
        if (event.target === paymentModal) {
            paymentModal.style.display = 'none';
        }
        if (event.target === waitingModal) {
            // Não fechar automaticamente o modal de aguardando
            // waitingModal.style.display = 'none';
        }
    };
});
