document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de solicitações...');
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

    const currentYearSpan = document.getElementById('currentYearFooterSolic');
    if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    const fetchConfig = (method = 'GET', body = null) => {
        const config = {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        };
        if (body) config.body = JSON.stringify(body);
        return config;
    };

    const listaSolicitacoesContainer = document.getElementById('lista-solicitacoes-container');
    
    // Modais e seus elementos
    const confirmarModal = document.getElementById('confirmar-agendamento-modal');
    const confirmarModalClose = document.getElementById('confirmar-modal-close');
    const confirmarClienteNomeSpan = document.getElementById('confirmar-cliente-nome');
    const confirmarDataHoraSpan = document.getElementById('confirmar-data-hora');
    const linkAtendimentoInput = document.getElementById('link-atendimento-online');
    const observacoesConfirmarTextarea = document.getElementById('observacoes-atendente-confirmar');
    const botaoFinalConfirmar = document.getElementById('botao-final-confirmar');

    const recusarModal = document.getElementById('recusar-agendamento-modal');
    const recusarModalClose = document.getElementById('recusar-modal-close');
    const recusarClienteNomeSpan = document.getElementById('recusar-cliente-nome');
    const recusarDataHoraSpan = document.getElementById('recusar-data-hora');
    const motivoRecusaTextarea = document.getElementById('motivo-recusa');
    const botaoFinalRecusar = document.getElementById('botao-final-recusar');
    
    let agendamentoSelecionadoParaAcao = null;

    function formatarDataHora(dataISOString) {
        if (!dataISOString) {
            console.warn('Tentativa de formatar data nula ou indefinida');
            return 'Data não disponível';
        }
        
        try {
            const data = new Date(dataISOString);
            const dataFormatada = data.toLocaleDateString('pt-BR');
            const horaMinuto = dataISOString.split('T')[1].substring(0, 5);
            
            return `${dataFormatada} às ${horaMinuto}`;
        } catch (error) {
            console.error("Erro ao formatar data:", error);
            return String(dataISOString);
        }
    }

    function traduzirModalidade(modalidade) {
        return modalidade === 'ONLINE' ? 'Online' : 'Presencial';
    }

    async function carregarSolicitacoes() {
        console.log('Iniciando carregamento de solicitações...');
        listaSolicitacoesContainer.innerHTML = '<p class="loading-message">Carregando...</p>';
        
        try {
            console.log('Buscando solicitações na API...');
            const response = await fetch(`/api/atendentes/${atendenteId}/agendamentos?status=SOLICITADO`, fetchConfig());
            if (!response.ok) {
                console.error(`Erro na resposta da API: ${response.status}`);
                throw new Error('Falha ao carregar solicitações.');
            }
            const data = await response.json();
            console.log(`Recebidas ${data.agendamentos?.length || 0} solicitações`);
            renderSolicitacoes(data.agendamentos || []);
            showAlert('Solicitações atualizadas com sucesso', 'success');
        } catch (error) {
            console.error("Erro ao carregar solicitações:", error);
            showAlert('Erro ao carregar solicitações', 'error');
            listaSolicitacoesContainer.innerHTML = '<p class="error-message">Não foi possível carregar as solicitações.</p>';
        }
    }

    function renderSolicitacoes(solicitacoes) {
        console.log(`Renderizando ${solicitacoes.length} solicitações`);
        listaSolicitacoesContainer.innerHTML = '';
        
        if (solicitacoes.length === 0) {
            console.log('Nenhuma solicitação encontrada');
            listaSolicitacoesContainer.innerHTML = '<p class="no-items-message">Nenhuma solicitação de agendamento pendente.</p>';
            return;
        }

        solicitacoes.forEach((ag, index) => {
            console.log(`Renderizando solicitação #${index + 1} de ${ag.nome_cliente}`);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'solicitacao-item';

            itemDiv.innerHTML = `
                <div class="solicitacao-info">
                    <h4>Solicitação de ${ag.nome_cliente}</h4>
                    <p><strong>Data:</strong> ${formatarDataHora(ag.data_hora_inicio)}</p>
                    <p><strong>Duração:</strong> ${ag.duracao_minutos} min</p>
                    <p><strong>Modalidade:</strong> ${traduzirModalidade(ag.modalidade)}</p>
                    ${ag.assunto_solicitacao ? `<p><strong>Assunto do Cliente:</strong> ${ag.assunto_solicitacao}</p>` : ''}
                </div>
                <div class="solicitacao-actions">
                    <button class="action-button confirmar-button" data-id="${ag.id_agendamento}">Confirmar</button>
                    <button class="action-button recusar-button" data-id="${ag.id_agendamento}">Recusar</button>
                </div>
            `;
            listaSolicitacoesContainer.appendChild(itemDiv);

            // Event listeners para os botões
            itemDiv.querySelector('.confirmar-button').addEventListener('click', () => {
                console.log(`Botão confirmar clicado para agendamento ${ag.id_agendamento}`);
                agendamentoSelecionadoParaAcao = ag;
                confirmarClienteNomeSpan.textContent = ag.nome_cliente;
                confirmarDataHoraSpan.textContent = formatarDataHora(ag.data_hora_inicio);
                linkAtendimentoInput.value = '';
                observacoesConfirmarTextarea.value = '';
                confirmarModal.style.display = 'block';
            });

            itemDiv.querySelector('.recusar-button').addEventListener('click', () => {
                console.log(`Botão recusar clicado para agendamento ${ag.id_agendamento}`);
                agendamentoSelecionadoParaAcao = ag;
                recusarClienteNomeSpan.textContent = ag.nome_cliente;
                recusarDataHoraSpan.textContent = formatarDataHora(ag.data_hora_inicio);
                motivoRecusaTextarea.value = '';
                recusarModal.style.display = 'block';
            });
        });
    }
    
    confirmarModalClose.addEventListener('click', () => {
        console.log('Fechando modal de confirmação');
        confirmarModal.style.display = 'none';
    });

    recusarModalClose.addEventListener('click', () => {
        console.log('Fechando modal de recusa');
        recusarModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === confirmarModal) {
            console.log('Fechando modal de confirmação (clique fora)');
            confirmarModal.style.display = 'none';
        }
        if (event.target === recusarModal) {
            console.log('Fechando modal de recusa (clique fora)');
            recusarModal.style.display = 'none';
        }
    });

    botaoFinalConfirmar.addEventListener('click', async () => {
        if (!agendamentoSelecionadoParaAcao) {
            console.warn('Tentativa de confirmar sem agendamento selecionado');
            return;
        }
        
        console.log(`Iniciando confirmação do agendamento ${agendamentoSelecionadoParaAcao.id_agendamento}`);
        const payload = {
            link_atendimento_online: linkAtendimentoInput.value.trim() || null,
            observacoes_atendente: observacoesConfirmarTextarea.value.trim() || null
        };
        
        botaoFinalConfirmar.disabled = true;
        botaoFinalConfirmar.textContent = 'Confirmando...';

        try {
            console.log('Enviando requisição de confirmação...');
            const response = await fetch(`/api/agendamentos/${agendamentoSelecionadoParaAcao.id_agendamento}/confirmar/atendente`, fetchConfig('POST', payload));
            const data = await response.json();
            if (!response.ok) {
                console.error('Erro na resposta da API:', data);
                throw new Error(data.message || 'Falha ao confirmar agendamento.');
            }

            console.log('Agendamento confirmado com sucesso');
            showAlert(data.message || 'Agendamento confirmado com sucesso!', 'success');
            confirmarModal.style.display = 'none';
            carregarSolicitacoes();
        } catch (error) {
            console.error('Erro ao confirmar agendamento:', error);
            showAlert(`Erro: ${error.message}`, 'error');
        } finally {
            botaoFinalConfirmar.disabled = false;
            botaoFinalConfirmar.textContent = 'Confirmar Agendamento';
        }
    });

    botaoFinalRecusar.addEventListener('click', async () => {
        if (!agendamentoSelecionadoParaAcao) {
            console.warn('Tentativa de recusar sem agendamento selecionado');
            return;
        }

        const motivo = motivoRecusaTextarea.value.trim();
        if (!motivo) {
            console.warn('Tentativa de recusar sem informar motivo');
            showAlert('Por favor, informe o motivo da recusa.', 'error');
            motivoRecusaTextarea.focus();
            return;
        }

        console.log(`Iniciando recusa do agendamento ${agendamentoSelecionadoParaAcao.id_agendamento}`);
        const payload = { motivo_recusa: motivo };
        
        botaoFinalRecusar.disabled = true;
        botaoFinalRecusar.textContent = 'Enviando...';

        try {
            console.log('Enviando requisição de recusa...');
            const response = await fetch(`/api/agendamentos/${agendamentoSelecionadoParaAcao.id_agendamento}/recusar/atendente`, fetchConfig('POST', payload));
            const data = await response.json();
            if (!response.ok) {
                console.error('Erro na resposta da API:', data);
                throw new Error(data.message || 'Falha ao recusar agendamento.');
            }
            
            console.log('Agendamento recusado com sucesso');
            showAlert(data.message || 'Agendamento recusado com sucesso.', 'success');
            recusarModal.style.display = 'none';
            carregarSolicitacoes();
        } catch (error) {
            console.error('Erro ao recusar agendamento:', error);
            showAlert(`Erro: ${error.message}`, 'error');
        } finally {
            botaoFinalRecusar.disabled = false;
            botaoFinalRecusar.textContent = 'Enviar Recusa';
        }
    });

    console.log('Iniciando carregamento inicial de solicitações...');
    carregarSolicitacoes();
});