document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de avaliações...');
    const token = localStorage.getItem('amadoAuthToken');
    const atendenteId = localStorage.getItem('amadoUserId');

    if (!token || !atendenteId || localStorage.getItem('amadoUserType') !== 'ATENDENTE') {
        console.warn('Acesso não autorizado ao painel de avaliações. Redirecionando para login...');
        window.location.href = '/static/login/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    const currentYearSpan = document.getElementById('currentYearFooterAtAval');
    if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    const fetchConfig = { headers: { 'Authorization': `Bearer ${token}` } };
    const listaAvaliacoesDiv = document.getElementById('lista-avaliacoes-recebidas');
    const mediaGeralDisplay = document.getElementById('media-geral-display');
    const totalAvaliacoesDisplay = document.getElementById('total-avaliacoes-display');

    function showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, listaAvaliacoesDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    function generateStarsDisplay(rating) {
        console.log(`Gerando display de estrelas para nota: ${rating}`);
        const totalStars = 5;
        let starsHtml = '';
        const numRating = parseFloat(rating);
        for (let i = 1; i <= totalStars; i++) {
            if (i <= numRating) starsHtml += '<i class="fas fa-star"></i>';
            else if (i - 0.5 <= numRating) starsHtml += '<i class="fas fa-star-half-alt"></i>';
            else starsHtml += '<i class="far fa-star"></i>';
        }
        return starsHtml;
    }

    async function carregarAvaliacoes() {
        console.log('Iniciando carregamento de avaliações...');
        listaAvaliacoesDiv.innerHTML = '<p class="loading-message">Carregando...</p>';
        try {
            console.log(`Buscando avaliações para atendente ID: ${atendenteId}`);
            const response = await fetch(`/api/atendentes/${atendenteId}/avaliacoes`, fetchConfig);
            
            if (!response.ok) {
                const error = await response.text();
                console.error('Erro na resposta da API:', error);
                throw new Error('Falha ao carregar avaliações.');
            }

            const data = await response.json();
            console.log(`Dados recebidos: ${data.total_avaliacoes} avaliações, média geral: ${data.media_geral}`);
            
            mediaGeralDisplay.innerHTML = data.media_geral ? 
                generateStarsDisplay(data.media_geral) + ` (${data.media_geral.toFixed(1)})` : 'N/A';
            totalAvaliacoesDisplay.textContent = data.total_avaliacoes || 0;

            renderAvaliacoes(data.avaliacoes || []);
            showAlert('Avaliações carregadas com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao carregar avaliações:", error);
            showAlert('Não foi possível carregar as avaliações. Tente novamente mais tarde.', 'error');
            listaAvaliacoesDiv.innerHTML = '<p class="error-message">Não foi possível carregar as avaliações.</p>';
            mediaGeralDisplay.textContent = 'Erro';
            totalAvaliacoesDisplay.textContent = 'Erro';
        }
    }

    function renderAvaliacoes(avaliacoes) {
        console.log(`Renderizando ${avaliacoes.length} avaliações`);
        listaAvaliacoesDiv.innerHTML = '';
        
        if (avaliacoes.length === 0) {
            console.log('Nenhuma avaliação encontrada');
            listaAvaliacoesDiv.innerHTML = '<p class="no-items-message">Você ainda não recebeu nenhuma avaliação.</p>';
            return;
        }

        avaliacoes.forEach((av, index) => {
            console.log(`Renderizando avaliação ${index + 1}, nota: ${av.nota}`);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'avaliacao-recebida-item';
            itemDiv.innerHTML = `
                <div class="rating-display">Nota: ${generateStarsDisplay(av.nota)} (${av.nota}/5)</div>
                ${av.comentario ? `<p class="comentario-texto">"${av.comentario}"</p>` : '<p class="comentario-texto"><em>Nenhum comentário fornecido.</em></p>'}
                <p class="avaliador-info">
                    ${av.anonima ? 'Por: Anônimo' : `Por: ${av.nome_avaliador || 'Cliente'}`} 
                    em ${new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}
                     (Referente ao agendamento de ${new Date(av.data_agendamento_avaliado).toLocaleDateString('pt-BR')})
                </p>
            `;
            listaAvaliacoesDiv.appendChild(itemDiv);
        });
    }

    console.log('Iniciando carregamento inicial de avaliações...');
    carregarAvaliacoes();
});