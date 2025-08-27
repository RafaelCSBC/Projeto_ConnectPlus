document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script da página Quem Somos...');

    function showAlert(message, type = 'info') {
        console.log(`Exibindo alerta: ${message} (tipo: ${type})`);
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('section'));
        setTimeout(() => alertDiv.remove(), 5000);
    }

    const sections = document.querySelectorAll('section');
    console.log(`Encontradas ${sections.length} seções para animar`);
    
    // Função para verificar se um elemento está visível na tela
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        const isVisible = (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
            rect.bottom >= 0
        );
        return isVisible;
    }
    
    // Função para adicionar classes de animação aos elementos visíveis
    function handleScrollAnimation() {
        sections.forEach((section, index) => {
            if (isElementInViewport(section) && !section.classList.contains('fade-in')) {
                console.log(`Animando seção #${index + 1}`);
                section.classList.add('fade-in');
                
                const children = section.querySelectorAll('.mvv-card, .equipe-card, .numero-card');
                console.log(`Encontrados ${children.length} elementos para animar na seção #${index + 1}`);
                
                children.forEach((child, childIndex) => {
                    const delayClass = `delay-${(childIndex % 4) + 1}`;
                    child.classList.add('fade-in', delayClass);
                });
            }
        });
    }
    
    function startCounter() {
        console.log('Iniciando animação dos contadores');
        const numeroValores = document.querySelectorAll('.numero-valor');
        console.log(`Encontrados ${numeroValores.length} valores para animar`);
        
        numeroValores.forEach((valor, index) => {
            const target = parseInt(valor.getAttribute('data-count'));
            console.log(`Iniciando contador #${index + 1} até ${target}`);
            
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            
            const counter = setInterval(() => {
                current += step;
                
                if (current >= target) {
                    valor.textContent = target.toLocaleString();
                    console.log(`Contador #${index + 1} finalizado: ${target}`);
                    clearInterval(counter);
                } else {
                    valor.textContent = Math.floor(current).toLocaleString();
                }
            }, 16);
        });
    }
    
    console.log('Configurando slider de depoimentos');
    const depoimentosContainer = document.querySelector('.depoimentos-container');
    const dots = document.querySelectorAll('.dot');
    const prevButton = document.getElementById('prev-depoimento');
    const nextButton = document.getElementById('next-depoimento');
    let currentSlide = 0;
    
    function showSlide(index) {
        console.log(`Mostrando slide ${index + 1} de ${dots.length}`);
        currentSlide = index;
        
        depoimentosContainer.style.transform = `translateX(-${currentSlide * 33.333}%)`;
        
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            console.log('Botão anterior clicado');
            const newIndex = (currentSlide - 1 + dots.length) % dots.length;
            showSlide(newIndex);
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            console.log('Botão próximo clicado');
            const newIndex = (currentSlide + 1) % dots.length;
            showSlide(newIndex);
        });
    }
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            console.log(`Dot ${index + 1} clicado`);
            showSlide(index);
        });
    });
    
    console.log('Iniciando auto-play do slider');
    let slideInterval = setInterval(() => {
        const newIndex = (currentSlide + 1) % dots.length;
        showSlide(newIndex);
    }, 5000);
    
    const depoimentosSlider = document.querySelector('.depoimentos-slider');
    if (depoimentosSlider) {
        depoimentosSlider.addEventListener('mouseenter', () => {
            console.log('Mouse sobre o slider - pausando auto-play');
            clearInterval(slideInterval);
        });
        
        depoimentosSlider.addEventListener('mouseleave', () => {
            console.log('Mouse saiu do slider - retomando auto-play');
            slideInterval = setInterval(() => {
                const newIndex = (currentSlide + 1) % dots.length;
                showSlide(newIndex);
            }, 5000);
        });
    }
    
    console.log('Iniciando animações iniciais');
    handleScrollAnimation();
    
    window.addEventListener('scroll', () => {
        console.log('Scroll detectado - verificando animações');
        handleScrollAnimation();
    });
    
    const numerosSection = document.querySelector('.numeros-section');
    if (numerosSection) {
        console.log('Configurando observador para seção de números');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log('Seção de números visível - iniciando contadores');
                    startCounter();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(numerosSection);
    }

    console.log('Inicialização da página Quem Somos concluída');
});