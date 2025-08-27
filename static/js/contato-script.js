document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script da página de contato...');

    // Formulário de contato
    const contactForm = document.getElementById('contact-form');
    const successModal = document.getElementById('success-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const closeSuccessBtn = document.getElementById('close-success');
    
    function showAlert(message, type = 'info') {
        console.log(`Exibindo alerta: ${message} (tipo: ${type})`);
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, contactForm);
        setTimeout(() => alertDiv.remove(), 5000);
    }
    
    // Formatação de telefone
    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput) {
        console.log('Configurando máscara para campo de telefone');
        telefoneInput.addEventListener('input', function(e) {
            let value = e.target.value;
            
            // Remove caracteres não numéricos
            value = value.replace(/\D/g, '');
            
            // Aplica a máscara de telefone: (XX) XXXXX-XXXX
            if (value.length <= 11) {
                value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                value = value.replace(/(\d)(\d{4})$/, '$1-$2');
            }
            
            console.log(`Telefone formatado: ${value}`);
            e.target.value = value;
        });
    } else {
        console.warn('Campo de telefone não encontrado no formulário');
    }
    
    // Envio do formulário
    if (contactForm) {
        console.log('Configurando handler do formulário de contato');
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Formulário de contato submetido');
            
            // Coleta dados do formulário
            const formData = new FormData(contactForm);
            const formDataObj = {};
            formData.forEach((value, key) => {
                formDataObj[key] = value;
            });
            console.log('Dados do formulário:', formDataObj);
            
            // Simulação de envio do formulário
            // Em um ambiente real, você enviaria os dados para um servidor
            console.log('Simulando envio do formulário para o servidor...');
            showAlert('Enviando sua mensagem...', 'info');
            
            setTimeout(() => {
                // Simula resposta bem-sucedida
                console.log('Mensagem enviada com sucesso');
                showAlert('Mensagem enviada com sucesso!', 'success');
                
                // Exibe o modal de sucesso após "enviar" o formulário
                successModal.style.display = 'block';
                
                // Limpa o formulário
                contactForm.reset();
                console.log('Formulário resetado');
            }, 1000);
        });
    } else {
        console.error('Formulário de contato não encontrado na página');
    }
    
    // Fecha o modal quando o usuário clica no X
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            console.log('Fechando modal (X)');
            successModal.style.display = 'none';
        });
    }
    
    // Fecha o modal quando o usuário clica no botão "Fechar"
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', function() {
            console.log('Fechando modal (botão Fechar)');
            successModal.style.display = 'none';
        });
    }
    
    // Fecha o modal quando o usuário clica fora do conteúdo
    window.addEventListener('click', function(event) {
        if (event.target === successModal) {
            console.log('Fechando modal (clique fora)');
            successModal.style.display = 'none';
        }
    });
    
    const faqItems = document.querySelectorAll('.faq-item');
    console.log(`Configurando ${faqItems.length} itens de FAQ`);
    
    faqItems.forEach((item, index) => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            // Verifica se o item clicado já está ativo
            const isActive = item.classList.contains('active');
            console.log(`FAQ #${index + 1} clicado (estava ${isActive ? 'aberto' : 'fechado'})`);
            
            // Fecha todos os itens
            faqItems.forEach(faqItem => {
                faqItem.classList.remove('active');
            });
            
            // Se o item clicado não estava ativo, abre-o
            if (!isActive) {
                item.classList.add('active');
                console.log(`FAQ #${index + 1} aberto`);
            } else {
                console.log(`FAQ #${index + 1} fechado`);
            }
        });
    });
    
    // Animação de entrada para os elementos
    const sections = document.querySelectorAll('section');
    console.log(`Configurando animações para ${sections.length} seções`);
    
    // Função para verificar se um elemento está visível na tela
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
            rect.bottom >= 0
        );
    }
    
    // Função para adicionar classes de animação aos elementos visíveis
    function handleScrollAnimation() {
        sections.forEach((section, index) => {
            if (isElementInViewport(section) && !section.classList.contains('animate')) {
                console.log(`Animando seção #${index + 1}`);
                section.classList.add('animate');
            }
        });
    }
    
    // Inicia as animações ao carregar a página
    console.log('Iniciando animações iniciais');
    handleScrollAnimation();
    
    // Adiciona o event listener para o scroll
    window.addEventListener('scroll', handleScrollAnimation);
    console.log('Script de contato inicializado com sucesso');
});