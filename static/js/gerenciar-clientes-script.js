document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de gerenciamento de clientes...');
    const token = localStorage.getItem('amadoAuthToken');
    const userType = localStorage.getItem('amadoUserType');
    const adminId = localStorage.getItem('amadoUserId');

    if (!token || userType !== 'ADMIN') {
        console.warn('Acesso não autorizado ao painel de gerenciamento de clientes');
        window.location.href = '/static/login/login.html';
        return;
    }

    function showAlert(message, type = 'info') {
        console.log(`Exibindo alerta: ${message} (tipo: ${type})`);
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.filters-section'));
        setTimeout(() => alertDiv.remove(), 5000);
    }

    const fetchConfig = (method = 'GET', body = null) => {
        const config = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        if (body) config.body = JSON.stringify(body);
        return config;
    };

    // Elementos do DOM
    const statusFilterSelect = document.getElementById('client-status-filter');
    const searchInput = document.getElementById('client-search-input');
    const applyFiltersButton = document.getElementById('apply-client-filters-button');
    const clientsTbody = document.getElementById('clients-list-tbody');

    const actionModal = document.getElementById('client-action-modal');
    const modalCloseButton = document.getElementById('client-modal-close-button');
    const modalTitle = document.getElementById('client-modal-title');
    const clientDetailsModalContent = document.getElementById('client-details-modal-content');
    const motivoFormGroup = document.getElementById('client-motivo-form-group');
    const actionReasonTextarea = document.getElementById('client-action-reason');
    const cancelActionButton = document.getElementById('client-cancel-action-button');
    const confirmActionButton = document.getElementById('client-confirm-action-button');

    let currentClients = [];
    let selectedClientForAction = null;

    function fetchClients() {
        console.log('Iniciando busca de clientes...');
        clientsTbody.innerHTML = `<tr><td colspan="6" class="loading-message">Carregando clientes...</td></tr>`;

        const situacao = statusFilterSelect.value;
        const searchTerm = searchInput.value.trim();

        console.log(`Filtros aplicados - Situação: ${situacao}, Busca: ${searchTerm || 'nenhuma'}`);

        let apiUrl = `/api/usuarios?tipo=CLIENTE`;
        if (situacao !== 'TODOS') apiUrl += `&situacao=${situacao}`;
        if (searchTerm) apiUrl += `&busca=${encodeURIComponent(searchTerm)}`;
        
        console.log(`Buscando clientes na API: ${apiUrl}`);
        fetch(apiUrl, fetchConfig())
            .then(response => {
                if (!response.ok) {
                    console.error(`Erro na resposta da API: ${response.status} - ${response.statusText}`);
                    throw new Error(`Erro ao buscar clientes: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`${data.usuarios?.length || 0} clientes encontrados`);
                currentClients = data.usuarios || [];
                renderClientsTable(currentClients);
                showAlert('Lista de clientes atualizada com sucesso', 'success');
            })
            .catch(error => {
                console.error('Erro ao carregar clientes:', error);
                showAlert('Erro ao carregar lista de clientes', 'error');
                clientsTbody.innerHTML = `<tr><td colspan="6" class="error-message">Erro ao carregar clientes.</td></tr>`;
            });
    }

    function renderClientsTable(clients) {
        console.log(`Renderizando tabela com ${clients.length} clientes`);
        clientsTbody.innerHTML = ''; 

        if (clients.length === 0) {
            console.log('Nenhum cliente encontrado para exibir');
            clientsTbody.innerHTML = `<tr><td colspan="6" class="no-results-message">Nenhum cliente encontrado.</td></tr>`;
            return;
        }

        clients.forEach((client, index) => {
            console.log(`Renderizando cliente #${index + 1}: ${client.nome_completo}`);
            const row = clientsTbody.insertRow();
            row.insertCell().textContent = client.nome_completo;
            row.insertCell().textContent = client.email;
            row.insertCell().textContent = client.cpf || 'N/A';
            row.insertCell().textContent = new Date(client.data_criacao).toLocaleDateString('pt-BR');
            
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-${client.situacao}`;
            statusSpan.textContent = traduzirSituacao(client.situacao);
            statusCell.appendChild(statusSpan);

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            const viewButton = createActionButton('Visualizar', 'view-button', () => openClientActionModal('view', client));
            actionsCell.appendChild(viewButton);

            if (client.situacao === 'ATIVO') {
                const blockButton = createActionButton('Bloquear', 'block-button', () => openClientActionModal('block', client));
                actionsCell.appendChild(blockButton);
            } else if (client.situacao === 'BLOQUEADO') {
                const unblockButton = createActionButton('Desbloquear', 'unblock-button', () => openClientActionModal('unblock', client));
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
    
    async function openClientActionModal(actionType, client) {
        console.log(`Abrindo modal de ${actionType} para cliente: ${client.nome_completo}`);
        selectedClientForAction = client;
        actionReasonTextarea.value = ''; 
        confirmActionButton.dataset.actionType = actionType;

        let clientDetailsToDisplay = { ...client };

        if (actionType === 'view') {
            console.log('Buscando detalhes completos do cliente...');
            try {
                const response = await fetch(`/api/usuarios/${client.id_usuario}`, fetchConfig());
                if (response.ok) {
                    const detailedData = await response.json();
                    clientDetailsToDisplay = { ...client, ...detailedData.usuario };
                    console.log('Detalhes do cliente carregados com sucesso');
                } else {
                    console.warn('Não foi possível carregar detalhes completos do cliente');
                    showAlert('Alguns detalhes do cliente podem estar incompletos', 'warning');
                }
            } catch (err) {
                console.error("Erro ao buscar detalhes do cliente:", err);
                showAlert('Erro ao carregar detalhes completos do cliente', 'error');
            }
        }
        
        let detailsHtml = `
            <div class="detail-section">
                <h4>Informações Pessoais</h4>
                <p><strong>ID:</strong> ${clientDetailsToDisplay.id_usuario}</p>
                <p><strong>Nome Completo:</strong> ${clientDetailsToDisplay.nome_completo}</p>
                <p><strong>Nome Social:</strong> ${clientDetailsToDisplay.nome_social || 'Não informado'}</p>
                <p><strong>Email:</strong> ${clientDetailsToDisplay.email}</p>
                <p><strong>CPF:</strong> ${clientDetailsToDisplay.cpf || 'Não informado'}</p>
                <p><strong>Data de Nascimento:</strong> ${clientDetailsToDisplay.data_nascimento ? new Date(clientDetailsToDisplay.data_nascimento).toLocaleDateString('pt-BR') : 'Não informada'}</p>
                <p><strong>Gênero:</strong> ${traduzirIdentidadeGenero(clientDetailsToDisplay.identidade_genero)}</p>
                <p><strong>Orientação:</strong> ${traduzirOrientacaoSexual(clientDetailsToDisplay.orientacao_sexual)}</p>
                <p><strong>Pronomes:</strong> ${clientDetailsToDisplay.pronomes || 'Não informados'}</p>
                <p><strong>Data de Cadastro:</strong> ${new Date(clientDetailsToDisplay.data_criacao).toLocaleString('pt-BR')}</p>
                <p><strong>Status Atual:</strong> <span class="status-${clientDetailsToDisplay.situacao}">${traduzirSituacao(clientDetailsToDisplay.situacao)}</span></p>
            </div>`;
            
        if (clientDetailsToDisplay.telefones && clientDetailsToDisplay.telefones.length > 0) {
            console.log(`Exibindo ${clientDetailsToDisplay.telefones.length} telefones`);
            detailsHtml += `<div class="detail-section"><h4>Telefones</h4>`;
            clientDetailsToDisplay.telefones.forEach(tel => {
                detailsHtml += `<p>${tel.numero_telefone} (${tel.tipo_telefone || 'N/A'}) ${tel.is_principal ? '<strong>(Principal)</strong>' : ''}</p>`;
            });
            detailsHtml += `</div>`;
        }
        if (clientDetailsToDisplay.enderecos && clientDetailsToDisplay.enderecos.length > 0) {
            console.log(`Exibindo ${clientDetailsToDisplay.enderecos.length} endereços`);
            detailsHtml += `<div class="detail-section"><h4>Endereços</h4>`;
            clientDetailsToDisplay.enderecos.forEach(end => {
                detailsHtml += `<p>${end.logradouro}, ${end.numero} ${end.complemento || ''} - ${end.bairro}, ${end.cidade}/${end.estado} - CEP: ${end.cep} ${end.is_principal ? '<strong>(Principal)</strong>' : ''}</p>`;
            });
            detailsHtml += `</div>`;
        }

        clientDetailsModalContent.innerHTML = detailsHtml;
        motivoFormGroup.style.display = 'none';
        confirmActionButton.style.display = 'none';
        actionReasonTextarea.removeAttribute('required');

        switch (actionType) {
            case 'view':
                modalTitle.textContent = 'Detalhes do Cliente';
                break;
            case 'block':
                modalTitle.textContent = `Bloquear Cliente: ${client.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo do bloqueio (obrigatório).';
                actionReasonTextarea.setAttribute('required', 'required');
                confirmActionButton.textContent = 'Confirmar Bloqueio';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button block-button action-button';
                break;
            case 'unblock': 
                modalTitle.textContent = `Desbloquear Cliente: ${client.nome_completo}`;
                motivoFormGroup.style.display = 'block';
                actionReasonTextarea.placeholder = 'Motivo do desbloqueio (opcional).';
                confirmActionButton.textContent = 'Confirmar Desbloqueio';
                confirmActionButton.style.display = 'block';
                confirmActionButton.className = 'confirm-button approve-button action-button'; 
                break;
        }
        actionModal.style.display = 'block';
    }

    function closeClientModal() {
        console.log('Fechando modal de cliente');
        actionModal.style.display = 'none';
        selectedClientForAction = null;
    }

    confirmActionButton.addEventListener('click', function() {
        if (!selectedClientForAction) {
            console.error('Nenhum cliente selecionado para ação');
            return;
        }

        const action = this.dataset.actionType;
        const motivo = actionReasonTextarea.value.trim();
        console.log(`Executando ação ${action} para cliente ${selectedClientForAction.nome_completo}`);

        if (action === 'block' && !motivo) {
            console.warn('Tentativa de bloqueio sem motivo');
            showAlert('O motivo é obrigatório para bloquear.', 'error');
            actionReasonTextarea.focus();
            return;
        }

        let endpoint = '';
        let payload = { motivo: motivo, id_admin_responsavel: adminId };

        if (action === 'block') {
            endpoint = `/api/admin/usuarios/${selectedClientForAction.id_usuario}/alterar-status`;
            payload.novo_status = 'BLOQUEADO';
        } else if (action === 'unblock') {
            endpoint = `/api/admin/usuarios/${selectedClientForAction.id_usuario}/alterar-status`;
            payload.novo_status = 'ATIVO';
        } else {
            console.error('Ação desconhecida:', action);
            return;
        }
        
        console.log(`Enviando requisição para ${endpoint}`, payload);
        confirmActionButton.disabled = true;
        confirmActionButton.textContent = 'Processando...';

        fetch(endpoint, fetchConfig('PUT', payload))
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    console.error('Erro na resposta da API:', err);
                    throw new Error(err.message || `Erro ao ${action} cliente`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log(`Cliente ${action === 'block' ? 'bloqueado' : 'desbloqueado'} com sucesso`);
            showAlert(data.message || `Cliente ${action === 'block' ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'success');
            closeClientModal();
            fetchClients(); 
        })
        .catch(error => {
            console.error(`Erro ao ${action} cliente:`, error);
            showAlert(`Erro: ${error.message}`, 'error');
        })
        .finally(() => {
            confirmActionButton.disabled = false;
            confirmActionButton.textContent = action === 'block' ? 'Confirmar Bloqueio' : 'Confirmar Desbloqueio';
        });
    });
    
    // Tradutores
    function traduzirSituacao(situacao) {
        const situacoes = { 'ATIVO': 'Ativo', 'PENDENTE_APROVACAO': 'Pendente', 'BLOQUEADO': 'Bloqueado', 'INATIVO': 'Inativo' };
        return situacoes[situacao] || situacao || 'N/A';
    }
    function traduzirIdentidadeGenero(id) { return id || 'N/A'; }
    function traduzirOrientacaoSexual(id) { return id || 'N/A'; }

    applyFiltersButton.addEventListener('click', () => {
        console.log('Aplicando filtros...');
        fetchClients();
    });
    
    modalCloseButton.addEventListener('click', closeClientModal);
    cancelActionButton.addEventListener('click', closeClientModal);
    window.addEventListener('click', (event) => {
        if (event.target === actionModal) closeClientModal();
    });

    console.log('Iniciando carregamento inicial de clientes...');
    fetchClients();
});