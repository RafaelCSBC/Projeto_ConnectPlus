document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script da agenda do atendente...');
    const token = localStorage.getItem('amadoAuthToken');
    const atendenteId = localStorage.getItem('amadoUserId');
    const userStatus = localStorage.getItem('amadoUserStatus');

    if (!token || !atendenteId || localStorage.getItem('amadoUserType') !== 'ATENDENTE') {
        console.warn('Usuário não autenticado ou não é atendente, redirecionando...');
        window.location.href = '/static/login/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }
    if (userStatus === 'PENDENTE_APROVACAO') {
        console.warn('Atendente pendente de aprovação, redirecionando...');
        window.location.href = '/static/atendente/aguardando-aprovacao.html';
        return;
    }
    if (userStatus === 'BLOQUEADO') {
        console.warn('Atendente bloqueado, redirecionando...');
        window.location.href = '/static/atendente/conta-bloqueada.html';
        return;
    }

    function showAlert(message, type = 'info') {
        console.log(`Exibindo alerta: ${message} (tipo: ${type})`);
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.panel-tabs'));
        setTimeout(() => alertDiv.remove(), 5000);
    }

    const currentYearSpan = document.getElementById('currentYearFooterAgenda');
    if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    const fetchConfig = (method = 'GET', body = null) => {
        const config = {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        };
        if (body) config.body = JSON.stringify(body);
        return config;
    };

    const listaConfirmadosDiv = document.getElementById('lista-agenda-confirmados');
    const listaRealizadosDiv = document.getElementById('lista-agenda-realizados');
    
    const detalheModal = document.getElementById('detalhe-agendamento-modal');
    const detalheModalClose = document.getElementById('detalhe-modal-close');
    const detalheAgendamentoConteudo = document.getElementById('detalhe-agendamento-conteudo');
    const observacoesEdicaoTextarea = document.getElementById('observacoes-atendente-edicao');
    const salvarObservacoesButton = document.getElementById('salvar-observacoes-ag-button');
    const marcarRealizadoButton = document.getElementById('marcar-realizado-button');
    let agendamentoAbertoNoModal = null;

    const tabLinks = document.querySelectorAll('.panel-tabs .tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`Alterando para aba: ${this.textContent}`);
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.querySelector(this.dataset.tabTarget).classList.add('active');
        });
    });

    function traduzirStatusAgendamento(status) {
        const mapa = {
            'SOLICITADO': 'Solicitado', 'CONFIRMADO': 'Confirmado', 'REALIZADO': 'Realizado',
            'CANCELADO_CLIENTE': 'Cancelado pelo Cliente', 'CANCELADO_ATENDENTE': 'Cancelado por Você',
            'NAO_COMPARECEU_CLIENTE': 'Cliente Não Compareceu', 'NAO_COMPARECEU_ATENDENTE': 'Você Não Compareceu'
        };
        return mapa[status] || status;
    }

    async function carregarMinhaAgenda() {
        console.log('Iniciando carregamento da agenda...');
        listaConfirmadosDiv.innerHTML = '<p class="loading-message">Carregando...</p>';
        listaRealizadosDiv.innerHTML = '<p class="loading-message">Carregando...</p>';
        
        try {
            console.log('Buscando agendamentos confirmados...');
            const responseConfirmados = await fetch(`/api/atendentes/${atendenteId}/agendamentos?status=CONFIRMADO`, fetchConfig());
            if (!responseConfirmados.ok) {
                console.error(`Erro na resposta da API (confirmados): ${responseConfirmados.status}`);
                throw new Error('Falha ao carregar agendamentos confirmados.');
            }
            const dataConfirmados = await responseConfirmados.json();
            console.log(`Recebidos ${dataConfirmados.agendamentos?.length || 0} agendamentos confirmados`);
            renderAgendaItems(dataConfirmados.agendamentos || [], listaConfirmadosDiv, true);

            console.log('Buscando agendamentos realizados...');
            const responseRealizados = await fetch(`/api/atendentes/${atendenteId}/agendamentos?status=REALIZADO`, fetchConfig());
            if (!responseRealizados.ok) {
                console.error(`Erro na resposta da API (realizados): ${responseRealizados.status}`);
                throw new Error('Falha ao carregar histórico.');
            }
            const dataRealizados = await responseRealizados.json();
            console.log(`Recebidos ${dataRealizados.agendamentos?.length || 0} agendamentos realizados`);
            renderAgendaItems(dataRealizados.agendamentos || [], listaRealizadosDiv, false);

            showAlert('Agenda atualizada com sucesso', 'success');
        } catch (error) {
            console.error("Erro ao carregar agenda:", error);
            showAlert('Erro ao carregar sua agenda', 'error');
            listaConfirmadosDiv.innerHTML = '<p class="error-message">Erro ao carregar.</p>';
            listaRealizadosDiv.innerHTML = '<p class="error-message">Erro ao carregar.</p>';
        }
    }

    function renderAgendaItems(agendamentos, divElement, isConfirmado) {
        console.log(`Renderizando ${agendamentos.length} agendamentos ${isConfirmado ? 'confirmados' : 'realizados'}`);
        divElement.innerHTML = '';
        
        if (agendamentos.length === 0) {
            console.log(`Nenhum agendamento ${isConfirmado ? 'confirmado' : 'realizado'} encontrado`);
            divElement.innerHTML = `<p class="no-items-message">Nenhum agendamento ${isConfirmado ? 'confirmado' : 'realizado'} encontrado.</p>`;
            return;
        }

        agendamentos.forEach((ag, index) => {
            console.log(`Renderizando agendamento #${index + 1} com ${ag.nome_cliente}`);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'agenda-evento-item';
            const dataHoraInicio = new Date(ag.data_hora_inicio);

            itemDiv.innerHTML = `
                <div class="agenda-evento-info">
                    <h4>Atendimento com ${ag.nome_cliente}</h4>
                    <p><strong>Data:</strong> ${dataHoraInicio.toLocaleDateString('pt-BR')} às ${dataHoraInicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                    <p><strong>Duração:</strong> ${ag.duracao_minutos} min</p>
                    <p><strong>Modalidade:</strong> ${ag.modalidade}</p>
                    ${ag.assunto_solicitacao ? `<p><strong>Assunto do Cliente:</strong> ${ag.assunto_solicitacao}</p>` : ''}
                    ${ag.link_atendimento_online && isConfirmado ? `<p><strong>Link:</strong> <a href="${ag.link_atendimento_online}" target="_blank" rel="noopener noreferrer">Acessar Atendimento</a></p>` : ''}
                    ${ag.observacoes_atendente ? `<p style="font-style:italic; color:#007bff;"><strong>Suas Obs:</strong> ${ag.observacoes_atendente}</p>` : ''}
                </div>
                <div class="agenda-evento-actions">
                    <button class="action-button view-details-button" data-id="${ag.id_agendamento}">Ver/Editar Detalhes</button>
                    ${isConfirmado && dataHoraInicio < new Date() ? `<button class="action-button marcar-realizado-quick-button" data-id="${ag.id_agendamento}">Marcar Realizado</button>` : ''}
                </div>
            `;
            divElement.appendChild(itemDiv);

            itemDiv.querySelector('.view-details-button').addEventListener('click', () => abrirModalDetalhes(ag));
            const marcarRealizadoQuickBtn = itemDiv.querySelector('.marcar-realizado-quick-button');
            if(marcarRealizadoQuickBtn) {
                marcarRealizadoQuickBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleMarcarComoRealizado(ag.id_agendamento);
                });
            }
        });
    }

    function abrirModalDetalhes(agendamento) {
        console.log('Abrindo modal de detalhes para agendamento:', agendamento.id_agendamento);
        agendamentoAbertoNoModal = agendamento;
        const dataHoraInicio = new Date(agendamento.data_hora_inicio);
        detalheAgendamentoConteudo.innerHTML = `
            <p><strong>Cliente:</strong> ${agendamento.nome_cliente} (${agendamento.email_cliente || 'Email não disponível'})</p>
            <p><strong>Data/Hora:</strong> ${dataHoraInicio.toLocaleString('pt-BR')}</p>
            <p><strong>Duração:</strong> ${agendamento.duracao_minutos} minutos</p>
            <p><strong>Modalidade:</strong> ${agendamento.modalidade}</p>
            ${agendamento.assunto_solicitacao ? `<p><strong>Assunto Cliente:</strong> ${agendamento.assunto_solicitacao}</p>` : ''}
            ${agendamento.link_atendimento_online ? `<p><strong>Link Online:</strong> <a href="${agendamento.link_atendimento_online}" target="_blank">${agendamento.link_atendimento_online}</a></p>` : ''}
        `;
        observacoesEdicaoTextarea.value = agendamento.observacoes_atendente || '';
        
        if (agendamento.status_agendamento === 'CONFIRMADO' && dataHoraInicio < new Date()) {
            console.log('Habilitando botão de marcar como realizado');
            marcarRealizadoButton.style.display = 'inline-block';
        } else {
            console.log('Ocultando botão de marcar como realizado');
            marcarRealizadoButton.style.display = 'none';
        }
        detalheModal.style.display = 'block';
    }
    
    detalheModalClose.addEventListener('click', () => {
        console.log('Fechando modal de detalhes');
        detalheModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === detalheModal) {
            console.log('Fechando modal de detalhes (clique fora)');
            detalheModal.style.display = 'none';
        }
    });

    salvarObservacoesButton.addEventListener('click', async () => {
        if (!agendamentoAbertoNoModal) {
            console.warn('Tentativa de salvar observações sem agendamento selecionado');
            return;
        }

        console.log('Salvando observações para agendamento:', agendamentoAbertoNoModal.id_agendamento);
        const payload = { observacoes_atendente: observacoesEdicaoTextarea.value.trim() };
        
        salvarObservacoesButton.disabled = true;
        salvarObservacoesButton.textContent = 'Salvando...';
        try {
            const response = await fetch(`/api/agendamentos/${agendamentoAbertoNoModal.id_agendamento}/observacoes`, fetchConfig('PUT', payload));
            const data = await response.json();
            if (!response.ok) {
                console.error('Erro na resposta da API:', data);
                throw new Error(data.message || 'Falha ao salvar observações.');
            }
            console.log('Observações salvas com sucesso');
            showAlert(data.message || 'Observações salvas!', 'success');
            agendamentoAbertoNoModal.observacoes_atendente = payload.observacoes_atendente;
            carregarMinhaAgenda();
        } catch (error) {
            console.error('Erro ao salvar observações:', error);
            showAlert(`Erro: ${error.message}`, 'error');
        } finally {
            salvarObservacoesButton.disabled = false;
            salvarObservacoesButton.textContent = 'Salvar Observações';
        }
    });

    marcarRealizadoButton.addEventListener('click', () => {
        if(agendamentoAbertoNoModal) {
            console.log('Iniciando processo de marcar como realizado via modal');
            handleMarcarComoRealizado(agendamentoAbertoNoModal.id_agendamento);
        }
    });

    async function handleMarcarComoRealizado(agendamentoId) {
        console.log(`Iniciando processo de marcar agendamento ${agendamentoId} como realizado`);
        if (!confirm('Tem certeza que deseja marcar este agendamento como REALIZADO?')) {
            console.log('Operação cancelada pelo usuário');
            return;
        }
        
        try {
            console.log('Enviando requisição para marcar como realizado...');
            const response = await fetch(`/api/agendamentos/${agendamentoId}/marcar-realizado`, fetchConfig('POST'));
            const data = await response.json();
            if (!response.ok) {
                console.error('Erro na resposta da API:', data);
                throw new Error(data.message || 'Falha ao marcar como realizado.');
            }

            console.log('Agendamento marcado como realizado com sucesso');
            showAlert(data.message || 'Agendamento marcado como realizado!', 'success');
            detalheModal.style.display = 'none';
            carregarMinhaAgenda();
        } catch (error) {
            console.error('Erro ao marcar como realizado:', error);
            showAlert(`Erro: ${error.message}`, 'error');
        }
    }
    
    console.log('Iniciando carregamento inicial da agenda...');
    carregarMinhaAgenda();
});