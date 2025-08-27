document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de administração de agendamentos...');
    const token = localStorage.getItem('amadoAuthToken');
    const userType = localStorage.getItem('amadoUserType');

    if (!token || userType !== 'ADMIN') {
        console.warn('Usuário não autorizado, redirecionando para login...');
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

    const statusFilterSelect = document.getElementById('ag-status-filter');
    const areaFilterSelect = document.getElementById('ag-area-filter');
    const dateFilterInput = document.getElementById('ag-date-filter');
    const searchInput = document.getElementById('ag-search-input');
    const applyFiltersButton = document.getElementById('apply-ag-filters-button');
    const appointmentsTbody = document.getElementById('appointments-list-tbody');

    const actionModal = document.getElementById('appointment-action-modal');
    const modalCloseButton = document.getElementById('appointment-modal-close-button');
    const modalTitle = document.getElementById('appointment-modal-title');
    const appointmentDetailsModalContent = document.getElementById('appointment-details-modal-content');
    const motivoFormGroup = document.getElementById('appointment-motivo-form-group');
    const actionReasonTextarea = document.getElementById('appointment-action-reason');
    const cancelActionButton = document.getElementById('appointment-cancel-action-button');
    const confirmActionButton = document.getElementById('appointment-confirm-action-button');

    let currentAppointments = [];
    let selectedAppointmentForAction = null;

    function fetchAllAppointments() {
        console.log('Iniciando busca de agendamentos...');
        appointmentsTbody.innerHTML = `<tr><td colspan="9" class="loading-message">Carregando agendamentos...</td></tr>`;

        const status = statusFilterSelect.value;
        const area = areaFilterSelect.value;
        const data = dateFilterInput.value;
        const searchTerm = searchInput.value.trim();

        console.log('Filtros aplicados:', { status, area, data, searchTerm });

        let apiUrl = `/api/agendamentos?admin_view=true`;
        if (status !== 'TODOS') apiUrl += `&status_agendamento=${status}`;
        if (area !== 'TODOS') apiUrl += `&area_atuacao=${area}`;
        if (data) apiUrl += `&data_selecionada=${data}`;
        if (searchTerm) apiUrl += `&busca=${encodeURIComponent(searchTerm)}`;
        
        console.log('Buscando agendamentos na API:', apiUrl);
        fetch(apiUrl, fetchConfig())
            .then(response => {
                if (!response.ok) {
                    console.error(`Erro na resposta da API: ${response.status}`);
                    throw new Error(`Erro ao buscar agendamentos: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                currentAppointments = data.agendamentos_futuros.concat(data.agendamentos_passados) || data.agendamentos || [];
                console.log(`Recebidos ${currentAppointments.length} agendamentos`);
                renderAppointmentsTable(currentAppointments);
                showAlert('Agendamentos atualizados com sucesso', 'success');
            })
            .catch(error => {
                console.error('Erro ao carregar agendamentos:', error);
                showAlert('Erro ao carregar agendamentos', 'error');
                appointmentsTbody.innerHTML = `<tr><td colspan="9" class="error-message">Erro ao carregar agendamentos.</td></tr>`;
            });
    }

    function renderAppointmentsTable(appointments) {
        console.log(`Renderizando tabela com ${appointments.length} agendamentos`);
        appointmentsTbody.innerHTML = ''; 

        if (appointments.length === 0) {
            console.log('Nenhum agendamento encontrado');
            appointmentsTbody.innerHTML = `<tr><td colspan="9" class="no-results-message">Nenhum agendamento encontrado.</td></tr>`;
            return;
        }
        
        appointments.sort((a, b) => new Date(b.data_hora_inicio) - new Date(a.data_hora_inicio));
        console.log('Agendamentos ordenados por data mais recente');

        appointments.forEach((ag, index) => {
            console.log(`Renderizando agendamento #${index + 1}: ID ${ag.id_agendamento}`);
            const row = appointmentsTbody.insertRow();
            row.insertCell().textContent = ag.id_agendamento;
            row.insertCell().textContent = ag.nome_cliente || 'N/A';
            row.insertCell().textContent = ag.nome_atendente || 'N/A';
            row.insertCell().textContent = new Date(ag.data_hora_inicio).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'});
            row.insertCell().textContent = `${ag.duracao_minutos} min`;
            row.insertCell().textContent = ag.modalidade;
            row.insertCell().textContent = traduzirArea(ag.area_atendente) || 'N/A';
            
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-${ag.status_agendamento}`;
            statusSpan.textContent = traduzirStatusAgendamento(ag.status_agendamento);
            statusCell.appendChild(statusSpan);

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');
            const viewButton = createActionButton('Detalhes', 'view-button', () => openAppointmentActionModal('view', ag));
            actionsCell.appendChild(viewButton);

            if (!['REALIZADO', 'CANCELADO_CLIENTE', 'CANCELADO_ATENDENTE'].includes(ag.status_agendamento)) {
                const cancelButton = createActionButton('Cancelar', 'reject-button', () => openAppointmentActionModal('cancel_admin', ag));
                actionsCell.appendChild(cancelButton);
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

    function openAppointmentActionModal(actionType, appointment) {
        console.log(`Abrindo modal para agendamento ${appointment.id_agendamento} (ação: ${actionType})`);
        selectedAppointmentForAction = appointment;
        actionReasonTextarea.value = ''; 
        confirmActionButton.dataset.actionType = actionType;

        let detailsHtml = `
            <div class="detail-section">
                <h4>Detalhes do Agendamento</h4>
                <p><strong>ID Agendamento:</strong> ${appointment.id_agendamento}</p>
                <p><strong>Data/Hora:</strong> ${new Date(appointment.data_hora_inicio).toLocaleString('pt-BR')}</p>
                <p><strong>Duração:</strong> ${appointment.duracao_minutos} min</p>
                <p><strong>Modalidade:</strong> ${appointment.modalidade}</p>
                <p><strong>Status:</strong> <span class="status-${appointment.status_agendamento}">${traduzirStatusAgendamento(appointment.status_agendamento)}</span></p>
                <p><strong>Assunto Cliente:</strong> ${appointment.assunto_solicitacao || 'N/A'}</p>
                <p><strong>Link Online:</strong> ${appointment.link_atendimento_online ? `<a href="${appointment.link_atendimento_online}" target="_blank">${appointment.link_atendimento_online}</a>` : 'N/A'}</p>
                <p><strong>Observações Atendente:</strong> ${appointment.observacoes_atendente || 'N/A'}</p>
            </div>
            <div class="detail-section">
                <h4>Cliente</h4>
                <p><strong>Nome:</strong> ${appointment.nome_cliente || 'N/A'} (ID: ${appointment.id_cliente})</p>
            </div>
            <div class="detail-section">
                <h4>Atendente</h4>
                <p><strong>Nome:</strong> ${appointment.nome_atendente || 'N/A'} (ID: ${appointment.id_atendente})</p>
                <p><strong>Área:</strong> ${traduzirArea(appointment.area_atendente) || 'N/A'}</p>
            </div>
        `;

        if (appointment.avaliacao_existente) {
            console.log('Agendamento possui avaliação');
            detailsHtml += `<div class="detail-section"><h4>Avaliação Recebida</h4><p>Este agendamento foi avaliado.</p></div>`;
        }

        appointmentDetailsModalContent.innerHTML = detailsHtml;
        motivoFormGroup.style.display = 'none';
        confirmActionButton.style.display = 'none';
        actionReasonTextarea.removeAttribute('required');

        if (actionType === 'cancel_admin') {
            console.log('Configurando modal para cancelamento administrativo');
            modalTitle.textContent = 'Cancelar Agendamento (Admin)';
            motivoFormGroup.style.display = 'block';
            actionReasonTextarea.placeholder = 'Motivo do cancelamento (obrigatório).';
            actionReasonTextarea.setAttribute('required', 'required');
            confirmActionButton.textContent = 'Confirmar Cancelamento';
            confirmActionButton.style.display = 'block';
            confirmActionButton.className = 'confirm-button reject-button action-button';
        } else {
            modalTitle.textContent = 'Detalhes do Agendamento';
        }
        actionModal.style.display = 'block';
    }

    function closeAppointmentModal() {
        console.log('Fechando modal de agendamento');
        actionModal.style.display = 'none';
        selectedAppointmentForAction = null;
    }

    confirmActionButton.addEventListener('click', function() {
        if (!selectedAppointmentForAction) {
            console.warn('Tentativa de ação sem agendamento selecionado');
            return;
        }

        const action = this.dataset.actionType;
        if (action !== 'cancel_admin') {
            console.warn(`Ação não suportada: ${action}`);
            return;
        }

        const motivo = actionReasonTextarea.value.trim();
        if (!motivo) {
            console.warn('Tentativa de cancelar sem informar motivo');
            showAlert('O motivo é obrigatório para cancelar.', 'error');
            actionReasonTextarea.focus();
            return;
        }

        console.log(`Iniciando cancelamento do agendamento ${selectedAppointmentForAction.id_agendamento}`);
        const endpoint = `/api/agendamentos/${selectedAppointmentForAction.id_agendamento}/cancelar/admin`;
        const payload = { 
            motivo: motivo, 
            id_admin_responsavel: localStorage.getItem('amadoUserId') 
        };
        
        confirmActionButton.disabled = true;
        confirmActionButton.textContent = 'Processando...';

        console.log('Enviando requisição de cancelamento:', endpoint);
        fetch(endpoint, fetchConfig('POST', payload))
        .then(response => {
            if (!response.ok) {
                console.error(`Erro na resposta da API: ${response.status}`);
                return response.json().then(err => { throw new Error(err.message || 'Erro ao cancelar agendamento') });
            }
            return response.json();
        })
        .then(data => {
            console.log('Agendamento cancelado com sucesso');
            showAlert(data.message || 'Agendamento cancelado com sucesso!', 'success');
            closeAppointmentModal();
            fetchAllAppointments();
        })
        .catch(error => {
            console.error('Erro ao cancelar agendamento:', error);
            showAlert(`Erro: ${error.message}`, 'error');
        })
        .finally(() => {
            confirmActionButton.disabled = false;
            confirmActionButton.textContent = 'Confirmar Cancelamento';
        });
    });
    
    function traduzirArea(area) {
        const areas = {
            'SAUDE': 'Saúde',
            'JURIDICO': 'Jurídico',
            'CARREIRA': 'Carreira',
            'CONTABIL': 'Contábil',
            'ASSISTENCIA_SOCIAL': 'Assistência Social'
        };
        return areas[area] || area || 'N/A';
    }

    function traduzirStatusAgendamento(status) {
        const mapa = {
            'SOLICITADO': 'Solicitado',
            'CONFIRMADO': 'Confirmado',
            'REALIZADO': 'Realizado',
            'CANCELADO_CLIENTE': 'Cancelado pelo Cliente',
            'CANCELADO_ATENDENTE': 'Cancelado pelo Atendente',
            'CANCELADO_ADMIN': 'Cancelado pelo Admin',
            'NAO_COMPARECEU_CLIENTE': 'Cliente Não Compareceu',
            'NAO_COMPARECEU_ATENDENTE': 'Atendente Não Compareceu'
        };
        return mapa[status] || status || 'N/A';
    }

    applyFiltersButton.addEventListener('click', () => {
        console.log('Aplicando filtros...');
        fetchAllAppointments();
    });

    modalCloseButton.addEventListener('click', closeAppointmentModal);
    cancelActionButton.addEventListener('click', closeAppointmentModal);
    window.addEventListener('click', (event) => {
        if (event.target === actionModal) closeAppointmentModal();
    });

    console.log('Iniciando carregamento inicial de agendamentos...');
    fetchAllAppointments();
});