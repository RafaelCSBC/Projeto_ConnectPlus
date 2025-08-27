document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de perfil do cliente...');
    const token = localStorage.getItem('amadoAuthToken');
    const clienteId = localStorage.getItem('amadoUserId');

    if (!token || !clienteId) {
        console.warn('Usuário não autenticado. Redirecionando para login...');
        window.location.href = '/static/login/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    const currentYearSpan = document.getElementById('currentYearFooterPerfil');
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    const fetchConfig = (method = 'GET', body = null) => {
        const config = {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        };
        if (body) config.body = JSON.stringify(body);
        return config;
    };
    
    const perfilMessagesDiv = document.getElementById('perfil-messages');
    // Campos do formulário de perfil
    const nomeCompletoInput = document.getElementById('perfil-nome-completo');
    const nomeSocialInput = document.getElementById('perfil-nome-social');
    const emailInput = document.getElementById('perfil-email'); 
    const cpfInput = document.getElementById('perfil-cpf');    
    const dataNascimentoInput = document.getElementById('perfil-data-nascimento');
    const identidadeGeneroSelect = document.getElementById('perfil-identidade-genero');
    const orientacaoSexualSelect = document.getElementById('perfil-orientacao-sexual');
    const pronomesInput = document.getElementById('perfil-pronomes');
    const telefoneInput = document.getElementById('perfil-telefone');
    const cepInput = document.getElementById('perfil-cep');
    // Adicionar mais campos de endereço se for editar todos
    
    const perfilForm = document.getElementById('perfil-form');
    const alterarSenhaForm = document.getElementById('alterar-senha-form');
    const salvarPerfilButton = document.getElementById('salvar-perfil-button');
    const salvarNovaSenhaButton = document.getElementById('salvar-nova-senha-button');

    telefoneInput.addEventListener('input', maskTelefone);
    cepInput.addEventListener('input', maskCEP);

    function maskTelefone(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.substring(0, 11);
        if (value.length > 10) { value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        } else if (value.length > 6) { value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
        } else if (value.length > 2) { value = value.replace(/^(\d{2})(\d*)/, '($1) $2');
        } else if (value.length > 0) { value = value.replace(/^(\d*)/, '($1'); }
        e.target.value = value;
    }
    function maskCEP(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.substring(0, 8);
        value = value.replace(/^(\d{5})(\d)/, '$1-$2');
        e.target.value = value;
    }
    
    function mostrarMensagemPerfil(mensagem, tipo = 'success', formType = 'perfil') {
        console.log(`Exibindo mensagem: ${mensagem} (tipo: ${tipo}, form: ${formType})`);
        perfilMessagesDiv.textContent = mensagem;
        perfilMessagesDiv.className = `form-messages ${tipo}`;
        perfilMessagesDiv.style.display = 'block';
        setTimeout(() => { perfilMessagesDiv.style.display = 'none'; }, 5000);
    }

    async function carregarDadosPerfil() {
        console.log('Iniciando carregamento dos dados do perfil...');
        try {
            const response = await fetch(`/api/clientes/${clienteId}/perfil`, fetchConfig());
            if (!response.ok) {
                console.error('Erro na resposta da API de perfil');
                throw new Error('Falha ao carregar dados do perfil.');
            }
            const data = await response.json();
            console.log('Dados do perfil recebidos com sucesso');
            
            nomeCompletoInput.value = data.nome_completo || '';
            nomeSocialInput.value = data.nome_social || '';
            emailInput.value = data.email || '';
            cpfInput.value = data.cpf ? data.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
            dataNascimentoInput.value = data.data_nascimento ? data.data_nascimento.split('T')[0] : '';
            identidadeGeneroSelect.value = data.identidade_genero || '';
            orientacaoSexualSelect.value = data.orientacao_sexual || '';
            pronomesInput.value = data.pronomes || '';
            
            if (data.telefones && data.telefones.length > 0) {
                console.log(`${data.telefones.length} telefones encontrados`);
                const telPrincipal = data.telefones.find(t => t.is_principal) || data.telefones[0];
                telefoneInput.value = telPrincipal.numero_telefone.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }
            if (data.enderecos && data.enderecos.length > 0) {
                console.log(`${data.enderecos.length} endereços encontrados`);
                const endPrincipal = data.enderecos.find(e => e.is_principal) || data.enderecos[0];
                cepInput.value = endPrincipal.cep ? endPrincipal.cep.replace(/^(\d{5})(\d{3})/, '$1-$2') : '';
            }

            mostrarMensagemPerfil('Dados do perfil carregados com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            mostrarMensagemPerfil('Não foi possível carregar seu perfil. Tente novamente mais tarde.', 'error');
        }
    }

    perfilForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Iniciando atualização do perfil...');
        const originalButtonText = salvarPerfilButton.textContent;
        salvarPerfilButton.disabled = true;
        salvarPerfilButton.textContent = 'Salvando...';

        const payload = {
            nome_completo: nomeCompletoInput.value,
            nome_social: nomeSocialInput.value || null,
            data_nascimento: dataNascimentoInput.value || null,
            identidade_genero: identidadeGeneroSelect.value || null,
            orientacao_sexual: orientacaoSexualSelect.value || null,
            pronomes: pronomesInput.value || null,
            telefone_principal: telefoneInput.value.replace(/\D/g, ''),
            cep_principal: cepInput.value.replace(/\D/g, '')
        };

        try {
            console.log('Enviando dados atualizados para a API...');
            const response = await fetch(`/api/clientes/${clienteId}/perfil`, fetchConfig('PUT', payload));
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Erro na resposta da API:', data);
                throw new Error(data.message || 'Falha ao atualizar perfil.');
            }
            
            console.log('Perfil atualizado com sucesso');
            mostrarMensagemPerfil(data.message || 'Perfil atualizado com sucesso!', 'success');
            
            if (data.usuario && data.usuario.nome_completo) {
                console.log('Atualizando nome no localStorage');
                localStorage.setItem('amadoUserName', data.usuario.nome_completo);
            }
        } catch (error) {
            console.error('Erro na atualização do perfil:', error);
            mostrarMensagemPerfil(`Erro: ${error.message}`, 'error');
        } finally {
            salvarPerfilButton.disabled = false;
            salvarPerfilButton.textContent = originalButtonText;
        }
    });
    
    alterarSenhaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Iniciando processo de alteração de senha...');
        const senhaAtual = document.getElementById('senha-atual').value;
        const novaSenha = document.getElementById('nova-senha').value;
        const confirmarNovaSenha = document.getElementById('confirmar-nova-senha').value;

        if (novaSenha !== confirmarNovaSenha) {
            console.warn('Novas senhas não coincidem');
            mostrarMensagemPerfil('As novas senhas não coincidem.', 'error', 'senha');
            return;
        }
        if (novaSenha.length < 8) {
            console.warn('Nova senha muito curta');
            mostrarMensagemPerfil('A nova senha deve ter no mínimo 8 caracteres.', 'error', 'senha');
            return;
        }
        
        const originalButtonText = salvarNovaSenhaButton.textContent;
        salvarNovaSenhaButton.disabled = true;
        salvarNovaSenhaButton.textContent = 'Alterando...';

        try {
            console.log('Enviando requisição de alteração de senha...');
            const response = await fetch(`/api/usuarios/${clienteId}/alterar-senha`, 
                fetchConfig('POST', { senha_atual: senhaAtual, nova_senha: novaSenha }));
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Erro na resposta da API de alteração de senha:', data);
                throw new Error(data.message || 'Falha ao alterar senha.');
            }

            console.log('Senha alterada com sucesso');
            mostrarMensagemPerfil(data.message || 'Senha alterada com sucesso!', 'success', 'senha');
            alterarSenhaForm.reset();
        } catch (error) {
            console.error('Erro na alteração de senha:', error);
            mostrarMensagemPerfil(`Erro: ${error.message}`, 'error', 'senha');
        } finally {
            salvarNovaSenhaButton.disabled = false;
            salvarNovaSenhaButton.textContent = originalButtonText;
        }
    });

    console.log('Iniciando carregamento inicial do perfil...');
    carregarDadosPerfil();
});