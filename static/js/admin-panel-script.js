// static/admin/admin-panel-script.js
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('amadoAuthToken');
    const userType = localStorage.getItem('amadoUserType');
    const adminId = localStorage.getItem('amadoUserId'); // Assumindo que o ID do admin está salvo

    if (!token || userType !== 'ADMIN') {
        console.error('Erro de autenticação: Token ausente ou tipo de usuário inválido', {
            hasToken: !!token,
            userType: userType
        });
        alert('Erro de autenticação: Você não tem permissão para acessar esta página. Redirecionando para o login...');
        window.location.href = '/static/login/login.html';
        return;
    }

    if (!adminId) {
        console.error('ID do administrador não encontrado no localStorage');
        alert('Erro: ID do administrador não encontrado. Por favor, faça login novamente.');
        window.location.href = '/static/login/login.html';
        return;
    }

    const fetchConfig = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    // Elementos do DOM
    const areaFilterSelect = document.getElementById('area-filter');
    const statusFilterSelect = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    const applyFiltersButton = document.getElementById('apply-filters-button');
    const attendantsTbody = document.getElementById('attendants-list-tbody');

    const actionModal = document.getElementById('action-modal');
    const modalCloseButton = document.getElementById('modal-close-button');
    const modalTitle = document.getElementById('modal-title');
    const attendantDetailsModalContent = document.getElementById('attendant-details-modal-content');
    const motivoFormGroup = document.getElementById('motivo-form-group');
    const actionReasonTextarea = document.getElementById('action-reason');
    const cancelActionButton = document.getElementById('cancel-action-button');
    const confirmActionButton = document.getElementById('confirm-action-button');

    let currentAttendants = [];
    let selectedAttendantForAction = null;

    function fetchAttendants() {
        try {
            attendantsTbody.innerHTML = `<tr><td colspan="7" class="loading-message">Carregando atendentes...</td></tr>`;

            const area = areaFilterSelect.value;
            const situacao = statusFilterSelect.value;
            const searchTerm = searchInput.value.trim();

            let apiUrl = `/api/atendentes?situacao=TODOS`;
            if (area !== 'TODOS') apiUrl += `&area_atuacao=${area}`;
            if (situacao !== 'TODOS') apiUrl += `&situacao=${situacao}`;
            if (searchTerm) apiUrl += `&busca=${encodeURIComponent(searchTerm)}`;

            console.log('Iniciando busca de atendentes:', {
                url: apiUrl,
                filtros: { area, situacao, searchTerm }
            });

            fetch(apiUrl, fetchConfig)
                .then(response => {
                    if (!response.ok) {
                        const errorMsg = `Erro ao buscar atendentes: ${response.statusText}`;
                        console.error('Erro na resposta da API:', {
                            status: response.status,
                            statusText: response.statusText,
                            url: apiUrl
                        });
                        throw new Error(errorMsg);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Dados recebidos da API:', {
                        quantidade: Array.isArray(data) ? data.length : (data.atendentes ? data.atendentes.length : 0),
                        estrutura: Object.keys(data)
                    });
                    
                    if (data.atendentes) {
                        currentAttendants = data.atendentes;
                    } else if (Array.isArray(data)) {
                        currentAttendants = data;
                    } else {
                        const errorMsg = 'Erro: Formato de dados inesperado recebido do servidor';
                        console.error(errorMsg, {
                            tipoRecebido: typeof data,
                            estrutura: Object.keys(data)
                        });
                        alert(errorMsg);
                        currentAttendants = [];
                    }
                    
                    renderAttendantsTable(currentAttendants);
                })
                .catch(error => {
                    const errorMsg = `Erro ao carregar atendentes: ${error.message}`;
                    console.error(errorMsg, {
                        mensagem: error.message,
                        stack: error.stack,
                        filtrosAplicados: { area, situacao, searchTerm }
                    });
                    alert(errorMsg);
                    attendantsTbody.innerHTML = `<tr><td colspan="7" class="error-message">${errorMsg}</td></tr>`;
                });
        } catch (error) {
            const errorMsg = 'Erro inesperado ao tentar buscar atendentes. Por favor, recarregue a página.';
            console.error(errorMsg, {
                mensagem: error.message,
                stack: error.stack
            });
            alert(errorMsg);
            attendantsTbody.innerHTML = `<tr><td colspan="7" class="error-message">${errorMsg}</td></tr>`;
        }
    }

    function renderAttendantsTable(atendentes) {
        attendantsTbody.innerHTML = ''; // Limpa a tabela

        if (atendentes.length === 0) {
            attendantsTbody.innerHTML = `<tr><td colspan="7" class="no-results-message">Nenhum atendente encontrado com os filtros aplicados.</td></tr>`;
            return;
        }

        atendentes.forEach(atendente => {
            const row = attendantsTbody.insertRow();
            row.insertCell().textContent = atendente.nome_completo;
            row.insertCell().textContent = atendente.email;
            row.insertCell().textContent = atendente.cpf;
            row.insertCell().textContent = traduzirArea(atendente.area_atuacao);
            row.insertCell().textContent = new Date(atendente.data_criacao_usuario).toLocaleDateString('pt-BR');
            
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-${atendente.situacao_usuario}`;
            statusSpan.textContent = traduzirSituacao(atendente.situacao_usuario);
            statusCell.appendChild(statusSpan);

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            const viewButton = createActionButton('Visualizar', 'view-button', () => openActionModal('view', atendente));
            actionsCell.appendChild(viewButton);

            if (atendente.situacao_usuario === 'PENDENTE_APROVACAO') {
                const approveButton = createActionButton('Aprovar', 'approve-button', () => openActionModal('approve', atendente));
                const rejectButton = createActionButton('Reprovar', 'reject-button', () => openActionModal('reject', atendente));
                actionsCell.appendChild(approveButton);
                actionsCell.appendChild(rejectButton);
            } else if (atendente.situacao_usuario === 'ATIVO') {
                const blockButton = createActionButton('Bloquear', 'block-button', () => openActionModal('block', atendente));
                actionsCell.appendChild(blockButton);
            } else if (atendente.situacao_usuario === 'BLOQUEADO') {
                const unblockButton = createActionButton('Desbloquear', 'unblock-button', () => openActionModal('unblock', atendente));
                actionsCell.appendChild(unblockButton);
            }
        });
    }

    function createActionButton(text, className, onClickHandler) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `action-button ${className}`;
        button.addEventListener('click', onClickHandler);
        return button;
    }
    
    function openActionModal(actionType, attendant) {
        selectedAttendantForAction = attendant;
        actionReasonTextarea.value = ''; // Limpa o motivo
        confirmActionButton.dataset.actionType = actionType; // Armazena a ação no botão

        
        let detailsHtml = `
            <div class="detail-section">
                <h4>Informações Pessoais</h4>
                <p><strong>ID:</strong> ${attendant.id_usuario}</p>
                <p><strong>Nome Completo:</strong> ${attendant.nome_completo}</p>
                <p><strong>Nome Social:</strong> ${attendant.nome_social || 'Não informado'}</p>
                <p><strong>Email:</strong> ${attendant.email}</p>
                <p><strong>CPF:</strong> ${attendant.cpf}</p>
                <p><strong>Data de Nascimento:</strong> ${attendant.data_nascimento ? new Date(attendant.data_nascimento).toLocaleDateString('pt-BR') : 'Não informada'}</p>
                <p><strong>Identidade de Gênero:</strong> ${traduzirIdentidadeGenero(attendant.identidade_genero)}</p>
                <p><strong>Orientação Sexual:</strong> ${traduzirOrientacaoSexual(attendant.orientacao_sexual)}</p>
                <p><strong>Pronomes:</strong> ${attendant.pronomes || 'Não informados'}</p>
                <p><strong>Data de Cadastro:</strong> ${new Date(attendant.data_criacao_usuario).toLocaleString('pt-BR')}</p>
                <p><strong>Status Atual:</strong> <span class="status-${attendant.situacao_usuario}">${traduzirSituacao(attendant.situacao_usuario)}</span></p>
            </div>
            <div class="detail-section">
                <h4>Detalhes Profissionais (Atendente)</h4>
                <p><strong>Área de Atuação:</strong> ${traduzirArea(attendant.area_atuacao)}</p>
                <p><strong>Qualificação/Descrição:</strong> ${attendant.qualificacao_descricao || 'Não informada'}</p>
                <p><strong>Especialidades:</strong> ${attendant.especialidades || 'Não informadas'}</p>
                <p><strong>Registro Profissional:</strong> ${attendant.registro_profissional || 'Não informado'}</p>
                <p><strong>Anos de Experiência:</strong> ${attendant.anos_experiencia === null ? 'Não informado' : attendant.anos_experiencia}</p>
                <p><strong>Link Currículo:</strong> ${attendant.curriculo_link ? `<a href="${attendant.curriculo_link}" target="_blank" rel="noopener noreferrer">${attendant.curriculo_link}</a>` : 'Não informado'}</p>
                <p><strong>Atende Online:</strong> ${attendant.aceita_atendimento_online ? 'Sim' : 'Não'}</p>
                <p><strong>Atende Presencial:</strong> ${attendant.aceita_atendimento_presencial ? 'Sim' : 'Não'}</p>
                <p><strong>Duração Padrão (min):</strong> ${attendant.duracao_padrao_atendimento_min || 'N/A'}</p>
            </div>
        `;
        // Adicionar telefones e endereços se vierem na view
        if (attendant.contatos_telefonicos) { // Exemplo, se a view trouxer
             detailsHtml += `<div class="detail-section"><h4>Contatos Telefônicos</h4><p>${attendant.contatos_telefonicos.replace(/;/g, '<br>')}</p></div>`;
        }


        attendantDetailsModalContent.innerHTML = detailsHtml;

        motivoFormGroup.style.display = 'none';
        confirmActionButton.style.display = 'none';
        actionReasonTextarea.removeAttribute('required');

        switch (actionType) {
            case 'view':
                modalTitle.textContent = 'Detalhes do Atendente';
                break;
            case 'approve':
                modalTitle.textContent = `Aprovar Atendente: ${attendant.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo da aprovação (opcional, mas recomendado).';
                confirmActionButton.textContent = 'Confirmar Aprovação';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button approve-button action-button';
                break;
            case 'reject':
                modalTitle.textContent = `Reprovar Atendente: ${attendant.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo da reprovação (obrigatório).';
                actionReasonTextarea.setAttribute('required', 'required');
                confirmActionButton.textContent = 'Confirmar Reprovação';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button reject-button action-button';
                break;
            case 'block':
                modalTitle.textContent = `Bloquear Atendente: ${attendant.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo do bloqueio (obrigatório).';
                actionReasonTextarea.setAttribute('required', 'required');
                confirmActionButton.textContent = 'Confirmar Bloqueio';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button block-button action-button';
                break;
            case 'unblock': // Desbloquear é basicamente aprovar novamente
                modalTitle.textContent = `Desbloquear Atendente: ${attendant.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo do desbloqueio (opcional, mas recomendado).';
                confirmActionButton.textContent = 'Confirmar Desbloqueio';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button approve-button action-button'; // Reutiliza estilo de aprovar
                break;
        }
        actionModal.style.display = 'block';
    }

    function closeModal() {
        actionModal.style.display = 'none';
        selectedAttendantForAction = null;
    }

    confirmActionButton.addEventListener('click', function() {
        if (!selectedAttendantForAction) {
            const errorMsg = 'Erro: Nenhum atendente selecionado para a ação';
            console.error(errorMsg);
            alert(errorMsg);
            return;
        }

        const action = this.dataset.actionType;
        const motivo = actionReasonTextarea.value.trim();

        if ((action === 'reject' || action === 'block') && !motivo) {
            const warningMsg = 'O motivo é obrigatório para esta ação.';
            console.warn('Tentativa de rejeitar/bloquear sem motivo:', {
                acao: action,
                idAtendente: selectedAttendantForAction.id_usuario
            });
            alert(warningMsg);
            actionReasonTextarea.focus();
            return;
        }

        let endpoint = '';
        let novoStatus = '';

        try {
            switch(action) {
                case 'approve':
                    endpoint = `/api/atendentes/${selectedAttendantForAction.id_usuario}/aprovar`;
                    novoStatus = 'ATIVO';
                    break;
                case 'reject':
                case 'block':
                    endpoint = `/api/atendentes/${selectedAttendantForAction.id_usuario}/bloquear`;
                    novoStatus = 'BLOQUEADO';
                    break;
                case 'unblock':
                    endpoint = `/api/atendentes/${selectedAttendantForAction.id_usuario}/aprovar`;
                    novoStatus = 'ATIVO';
                    break;
                default:
                    const errorMsg = `Erro: Ação desconhecida '${action}'`;
                    console.error(errorMsg, {
                        acao: action,
                        idAtendente: selectedAttendantForAction.id_usuario
                    });
                    alert(errorMsg);
                    return;
            }
        } catch (error) {
            const errorMsg = `Erro ao processar a ação: ${error.message}`;
            console.error(errorMsg, {
                acao: action,
                erro: error.message,
                stack: error.stack
            });
            alert(errorMsg);
            return;
        }
        
        const payload = {
            motivo: motivo,
            id_admin_responsavel: adminId
        };

        console.log('Iniciando requisição de ação:', {
            acao: action,
            endpoint: endpoint,
            idAtendente: selectedAttendantForAction.id_usuario,
            idAdmin: adminId
        });

        confirmActionButton.disabled = true;
        confirmActionButton.textContent = 'Processando...';

        fetch(endpoint, {
            ...fetchConfig,
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                console.error('Erro na resposta da API de ação:', {
                    status: response.status,
                    statusText: response.statusText,
                    endpoint: endpoint,
                    acao: action
                });
                return response.json().then(err => { 
                    throw new Error(err.message || `Erro ao executar ação ${action}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Ação realizada com sucesso:', {
                acao: action,
                idAtendente: selectedAttendantForAction.id_usuario,
                resposta: data
            });
            const successMsg = data.message || `Ação '${action}' realizada com sucesso para ${selectedAttendantForAction.nome_completo}!`;
            alert(successMsg);
            closeModal();
            fetchAttendants();
        })
        .catch(error => {
            const errorMsg = `Erro ao ${action} atendente: ${error.message}`;
            console.error(errorMsg, {
                mensagem: error.message,
                stack: error.stack,
                payload: payload,
                endpoint: endpoint
            });
            alert(errorMsg);
        })
        .finally(() => {
            confirmActionButton.disabled = false;
            confirmActionButton.textContent = action === 'approve' ? 'Confirmar Aprovação' : 
                                        action === 'reject' ? 'Confirmar Reprovação' :
                                        action === 'block' ? 'Confirmar Bloqueio' : 'Confirmar Desbloqueio';
        });
    });

    // Tradutores (ajuste conforme ENUMs no seu BD e as remoções que você fez)
    function traduzirArea(area) {
        const areas = { 'SAUDE': 'Saúde', 'JURIDICO': 'Jurídico', 'CARREIRA': 'Carreira', 'CONTABIL': 'Contábil', 'ASSISTENCIA_SOCIAL': 'Assistência Social' };
        return areas[area] || area || 'N/A';
    }
    function traduzirSituacao(situacao) {
        const situacoes = { 'ATIVO': 'Ativo', 'PENDENTE_APROVACAO': 'Pendente', 'BLOQUEADO': 'Bloqueado', 'INATIVO': 'Inativo' };
        return situacoes[situacao] || situacao || 'N/A';
    }
    function traduzirIdentidadeGenero(id) {
        const map = {
            'MULHER_CIS': 'Mulher Cis', 'HOMEM_CIS': 'Homem Cis', 'MULHER_TRANS': 'Mulher Trans', 
            'HOMEM_TRANS': 'Homem Trans', 'NAO_BINARIE': 'Não Binárie', 'AGENERO': 'Agênero', 
            'GENERO_FLUIDO': 'Gênero Fluido', 'TRAVESTI': 'Travesti', 
            'OUTRA_IDENTIDADE': 'Outra', 'PREFIRO_NAO_DECLARAR_GENERO': 'Prefiro Não Declarar'
        };
        return map[id] || id || 'Não informado';
    }
    function traduzirOrientacaoSexual(id) {
        const map = {
            'ASSEXUAL': 'Assexual', 'BISSEXUAL': 'Bissexual', 'HETEROSSEXUAL': 'Heterossexual', 
            'LESBICA': 'Lésbica', 'GAY': 'Gay', 'PANSEXUAL': 'Pansexual', 'QUEER': 'Queer', 
            'OUTRA_ORIENTACAO': 'Outra', 'PREFIRO_NAO_DECLARAR_ORIENTACAO': 'Prefiro Não Declarar'
        };
        return map[id] || id || 'Não informado';
    }


    // Event Listeners
    applyFiltersButton.addEventListener('click', fetchAttendants);
    modalCloseButton.addEventListener('click', closeModal);
    cancelActionButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { // Fechar modal clicando fora
        if (event.target === actionModal) {
            closeModal();
        }
    });

    // Carregar atendentes inicialmente
    fetchAttendants();
});