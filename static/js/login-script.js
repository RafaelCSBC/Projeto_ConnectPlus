// static/login/login-script.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando script de login...');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const loginMessagesDiv = document.getElementById('login-messages');
    const loginSubmitButton = document.getElementById('login-submit-button');

    const currentYearSpanFooter = document.getElementById('currentYearFooterLogin');
    if (currentYearSpanFooter) {
        currentYearSpanFooter.textContent = new Date().getFullYear();
    }

    const token = localStorage.getItem('amadoAuthToken');
    const userType = localStorage.getItem('amadoUserType');
    const userStatus = localStorage.getItem('amadoUserStatus');
    
    if (token && userType) {
        console.log('Usuário já autenticado, redirecionando...');
        redirectToPanel(userType, userStatus);
        return;
    }

    function mostrarMensagemLogin(mensagem, tipo = 'error') {
        console.log(`Exibindo mensagem de login: ${mensagem} (tipo: ${tipo})`);
        loginMessagesDiv.textContent = mensagem;
        loginMessagesDiv.className = `form-messages ${tipo}`;
        loginMessagesDiv.style.display = 'block';
        
        if (tipo === 'error') {
            console.error('Erro no login:', mensagem);
        }
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Formulário de login submetido');
        loginMessagesDiv.style.display = 'none';

        const email = emailInput.value.trim();
        const senha = senhaInput.value;

        if (!email || !senha) {
            console.warn('Tentativa de login com campos vazios');
            mostrarMensagemLogin('Por favor, preencha email e senha.');
            return;
        }

        const originalButtonText = loginSubmitButton.textContent;
        loginSubmitButton.disabled = true;
        loginSubmitButton.textContent = 'Entrando...';

        console.log('Enviando requisição de login para a API...');
        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        })
        .then(response => {
            if (!response.ok) {
                console.warn(`Resposta de erro da API: ${response.status}`);
                return response.json().then(err => {
                    throw new Error(err.message || 'Email ou senha inválidos.');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.token && data.usuario) {
                console.log('Login bem-sucedido:', {
                    userId: data.usuario.id_usuario,
                    userType: data.usuario.tipo_usuario,
                    userStatus: data.usuario.situacao
                });
                
                // Armazenar o token e informações do usuário no localStorage
                localStorage.setItem('amadoAuthToken', data.token);
                localStorage.setItem('amadoUserId', data.usuario.id_usuario);
                localStorage.setItem('amadoUserType', data.usuario.tipo_usuario);
                localStorage.setItem('amadoUserName', data.usuario.nome_completo);
                localStorage.setItem('amadoUserEmail', data.usuario.email);
                localStorage.setItem('amadoUserStatus', data.usuario.situacao);

                // Verificar se há um redirecionamento pendente
                const urlParams = new URLSearchParams(window.location.search);
                const redirectUrl = urlParams.get('redirect');

                if (redirectUrl) {
                    console.log(`Redirecionando para URL original: ${redirectUrl}`);
                    window.location.href = redirectUrl;
                } else {
                    console.log('Redirecionando para painel padrão');
                    redirectToPanel(data.usuario.tipo_usuario, data.usuario.situacao);
                }
            } else {
                console.error('Resposta da API sem token ou dados do usuário');
                mostrarMensagemLogin('Resposta inesperada do servidor.');
            }
        })
        .catch(error => {
            console.error('Erro no processo de login:', error);
            mostrarMensagemLogin(error.message || 'Ocorreu um erro. Tente novamente.');
        })
        .finally(() => {
            loginSubmitButton.disabled = false;
            loginSubmitButton.textContent = originalButtonText;
        });
    });

    function redirectToPanel(tipoUsuario, situacaoUsuario) {
        console.log(`Redirecionando usuário - Tipo: ${tipoUsuario}, Situação: ${situacaoUsuario}`);
        
        let destino = '';
        if (tipoUsuario === 'ADMIN') {
            destino = '/static/admin/admin-panel.html';
        } else if (tipoUsuario === 'ATENDENTE') {
            if (situacaoUsuario === 'PENDENTE_APROVACAO') {
                destino = '/static/atendente/aguardando-aprovacao.html';
            } else if (situacaoUsuario === 'BLOQUEADO') {
                destino = '/static/atendente/conta-bloqueada.html';
            } else {
                destino = '/static/atendente/minha-agenda.html';
            }
        } else if (tipoUsuario === 'CLIENTE') {
            destino = '/static/cliente/meus-agendamentos.html';
        } else {
            console.warn(`Tipo de usuário desconhecido: ${tipoUsuario}`);
            destino = '/static/index.html';
        }
        
        console.log(`Redirecionando para: ${destino}`);
        window.location.href = destino;
    }

    console.log('Script de login inicializado com sucesso');
});