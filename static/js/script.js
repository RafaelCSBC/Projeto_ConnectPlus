document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script principal...');

    function showAlert(message, type = 'info') {
        console.log(`Exibindo alerta: ${message} (tipo: ${type})`);
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('main'));
        setTimeout(() => alertDiv.remove(), 5000);
    }

    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }


    function animateProfessionalCards() {
        console.log('Configurando animações dos cards de profissionais');
        const professionalCards = document.querySelectorAll('.professional-card');
        console.log(`Encontrados ${professionalCards.length} cards para animar`);
        
        professionalCards.forEach((card, index) => {
            card.addEventListener('mouseenter', function() {
                console.log(`Mouse sobre o card #${index + 1}`);
                this.style.transform = 'translateY(-5px)';
            });
            
            card.addEventListener('mouseleave', function() {
                console.log(`Mouse saiu do card #${index + 1}`);
                this.style.transform = 'translateY(0)';
            });
        });
    }


    const featuredContainer = document.getElementById('featuredProfessionalsContainer');
    if (featuredContainer) {
        console.log('Iniciando carregamento de atendentes em destaque');
        fetch('/api/atendentes/destaque?limite=3')
            .then(response => {
                if (!response.ok) {
                    console.warn(`Resposta não-ok da API: ${response.status}`);
                    if (response.status === 404) return { atendentes: [] };
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Recebidos ${data.atendentes?.length || 0} atendentes em destaque`);
                featuredContainer.innerHTML = '';

                if (data.atendentes && data.atendentes.length > 0) {
                    data.atendentes.forEach((atendente, index) => {
                        console.log(`Renderizando card do atendente #${index + 1}: ${atendente.nome_completo}`);
                        const card = document.createElement('div');
                        card.className = 'professional-card';

                        const mediaAvaliacoes = atendente.media_avaliacoes ? parseFloat(atendente.media_avaliacoes).toFixed(1) : 'N/A';
                        const areaAtuacaoNome = traduzirAreaAtuacao(atendente.area_atuacao);

                        const nomes = atendente.nome_completo.split(' ');
                        const iniciais = nomes.length > 1 
                            ? (nomes[0][0] + nomes[nomes.length-1][0]).toUpperCase()
                            : nomes[0].substring(0, 2).toUpperCase();
                        
                        card.innerHTML = `
                            <div class="professional-icon">${iniciais}</div>
                            <h3>${atendente.nome_social || atendente.nome_completo}</h3>
                            <p class="professional-area">${areaAtuacaoNome}</p>
                            <div class="rating">★ ${mediaAvaliacoes} (${atendente.total_avaliacoes || 0} avaliações)</div>
                            <p style="font-size: 0.9em; color: #555; margin-bottom: 15px; min-height: 40px;">
                                ${atendente.qualificacao_descricao.substring(0, 70)}${atendente.qualificacao_descricao.length > 70 ? '...' : ''}
                            </p>
                            <button class="view-profile" data-id="${atendente.id_usuario}">Ver Perfil</button>
                        `;
                        featuredContainer.appendChild(card);
                    });
                    
                    console.log('Configurando interatividade dos cards');
                    addProfileButtonListeners();
                    animateProfessionalCards();
                    showAlert('Atendentes em destaque carregados com sucesso', 'success');
                } else {
                    console.log('Nenhum atendente em destaque encontrado');
                    featuredContainer.innerHTML = '<p>Nenhum atendente em destaque no momento.</p>';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar atendentes em destaque:', error);
                showAlert('Não foi possível carregar os atendentes em destaque', 'error');
                featuredContainer.innerHTML = '<p>Não foi possível carregar os atendentes. Tente novamente mais tarde.</p>';
            });
    }

    function traduzirAreaAtuacao(area) {
        const areas = {
            'SAUDE': 'Saúde',
            'JURIDICO': 'Jurídico',
            'CARREIRA': 'Carreira',
            'CONTABIL': 'Contábil',
            'ASSISTENCIA_SOCIAL': 'Assistência Social'
        };
        return areas[area] || area;
    }

    // Funcionalidade para os botões "Ver Perfil"
    function addProfileButtonListeners() {
        console.log('Adicionando listeners aos botões de perfil');
        const viewProfileButtons = document.querySelectorAll('.view-profile');
        viewProfileButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                const professionalId = this.getAttribute('data-id');
                console.log(`Botão Ver Perfil #${index + 1} clicado - ID: ${professionalId}`);
                viewProfessionalProfile(professionalId);
            });
        });
    }
    
    // Botão CTA "Encontre Apoio e Agende"
    const ctaAgendarButton = document.getElementById('ctaAgendarButton');
    if (ctaAgendarButton) {
        ctaAgendarButton.addEventListener('click', function() {
            console.log('Botão CTA principal clicado');
            window.location.href = '/static/agendamento/agendamento.html';
        });
    }

    // Botão "Ver todos os Atendentes"
    const viewAllButton = document.getElementById('viewAllProfessionalsButton');
    if (viewAllButton) {
        viewAllButton.addEventListener('click', function() {
            console.log('Botão Ver Todos os Atendentes clicado');
            window.location.href = '/static/agendamento/agendamento.html';
        });
    }


    const serviceItems = document.querySelectorAll('.service-item');
    console.log(`Configurando ${serviceItems.length} áreas de apoio`);
    serviceItems.forEach((item, index) => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function() {
            const area = this.getAttribute('data-area');
            console.log(`Área de apoio #${index + 1} clicada: ${area}`);
            window.location.href = `/static/agendamento/agendamento.html?area=${area}`;
        });
    });

    console.log('Inicialização do script principal concluída');
});

function viewProfessionalProfile(professionalId) {
    console.log(`Abrindo perfil do atendente ID: ${professionalId}`);
    mostrarPerfilAtendente(professionalId);
}