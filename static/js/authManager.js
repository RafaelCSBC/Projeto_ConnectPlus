document.addEventListener('DOMContentLoaded', () => {
    console.log('Iniciando AuthManager');
    
    const header = document.querySelector('header');
    if (!header) {
        console.error('Header não encontrado no DOM');
        return;
    }

    const token = localStorage.getItem('amadoAuthToken');
    const userType = localStorage.getItem('amadoUserType'); // 'CLIENTE', 'ATENDENTE', 'ADMIN'
    const userName = localStorage.getItem('amadoUserName') || 'Usuário'; // Pegar o nome do usuário
    const userStatus = localStorage.getItem('amadoUserStatus');

    console.log('Estado de autenticação:', {
        temToken: !!token,
        tipoUsuario: userType,
        status: userStatus
    });

    const navElement = header.querySelector('nav ul');
    const loginButtonContainer = header.querySelector('.login-button-container');
    const userMenuContainer = header.querySelector('.user-menu-container'); // Para o menu do usuário logado

    if (!navElement) {
        console.warn('Elemento de navegação não encontrado');
    }
    if (!loginButtonContainer) {
        console.warn('Container de botão de login não encontrado');
    }

    if (navElement) navElement.innerHTML = ''; // Limpa a navegação padrão para recriar
    if (loginButtonContainer) loginButtonContainer.innerHTML = ''; // Limpa o botão de login padrão

    let navLinks = [];
    let userSpecificNav = '';

    if (token && userType) {
        console.log('Configurando navegação para usuário autenticado:', {
            tipo: userType,
            nome: userName
        });

        // Usuário Logado
        navLinks = [
            { text: 'Home', href: '/static/index.html' },
        ];

        if (userType === 'CLIENTE') {
            console.log('Configurando navegação para cliente');
            navLinks.push(
                { text: 'Encontrar Profissionais', href: '/static/agendamento/agendamento.html' },
                { text: 'Meus Agendamentos', href: '/static/cliente/meus-agendamentos.html' },
                { text: 'Planos', href: '/static/planos/planos.html' },
                { text: 'Quem Somos', href: '/static/quem-somos/quem-somos.html' }
            );
            userSpecificNav = `
                <div class="user-menu">
                    <div class="user-dropdown">
                        <button class="user-button">
                            <i class="fas fa-user-circle"></i> ${userName.split(' ')[0]}
                        </button>
                        <div class="dropdown-content">
                            <a href="/static/cliente/perfil.html">Meu Perfil</a>
                            <a href="/static/cliente/meus-agendamentos.html">Meus Agendamentos</a>
                            <a href="/static/cliente/notificacoes.html">Notificações</a>
                            <a href="#" id="logoutButton">Sair</a>
                        </div>
                    </div>
                </div>
            `;
        } else if (userType === 'ATENDENTE') {
            console.log('Configurando navegação para atendente:', {
                status: userStatus
            });
            navLinks.push(
                { text: 'Minha Agenda', href: '/static/atendente/minha-agenda.html' },
                { text: 'Solicitações', href: '/static/atendente/solicitacoes.html' },
                { text: 'Planos', href: '/static/planos/planos.html' },
                { text: 'Quem Somos', href: '/static/quem-somos/quem-somos.html' }
            );
            userSpecificNav = `
                <div class="user-menu">
                    <div class="user-dropdown">
                        <button class="user-button">
                            <i class="fas fa-user-md"></i> ${userName.split(' ')[0]}
                        </button>
                        <div class="dropdown-content">
                            <a href="/static/atendente/perfil.html">Meu Perfil Profissional</a>
                            <a href="/static/atendente/minha-agenda.html">Minha Agenda</a>
                            <a href="/static/atendente/solicitacoes.html">Gerenciar Agendamentos</a>
                            <a href="/static/atendente/avaliacoes.html">Minhas Avaliações</a>
                            <a href="/static/atendente/notificacoes.html">Notificações</a>
                            <a href="#" id="logoutButton">Sair</a>
                        </div>
                    </div>
                </div>
            `;
        } else if (userType === 'ADMIN') {
            console.log('Configurando navegação para administrador');
            navLinks.push(
                { text: 'Gerenciar Atendentes', href: '/static/admin/admin-panel.html' },
                { text: 'Gerenciar Clientes', href: '/static/admin/gerenciar-clientes.html' },
                { text: 'Todos Agendamentos', href: '/static/admin/todos-agendamentos.html' },
                { text: 'Planos', href: '/static/planos/planos.html' },
                { text: 'Quem Somos', href: '/static/quem-somos/quem-somos.html' }
            );
            userSpecificNav = `
                <div class="user-menu">
                    <div class="user-dropdown">
                        <button class="user-button">
                            <i class="fas fa-user-shield"></i> Admin
                        </button>
                        <div class="dropdown-content">
                            <a href="/static/admin/admin-panel.html">Painel Principal</a>
                            <a href="/static/admin/configuracoes.html">Configurações</a>
                            <a href="#" id="logoutButton">Sair</a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            console.error('Tipo de usuário desconhecido:', userType);
        }
        
        // Adiciona links comuns para usuários logados, se houver
        navLinks.push({ text: 'Suporte', href: '/static/contato/contato.html' });

    } else {
        console.log('Configurando navegação para usuário não autenticado');
        // Usuário Deslogado
        navLinks = [
            { text: 'Home', href: '/static/index.html', active: true }, // Exemplo de active
            { text: 'Encontrar Profissionais', href: '/static/agendamento/agendamento.html' },
            { text: 'Planos', href: '/static/planos/planos.html' },
            { text: 'Quem Somos', href: '/static/quem-somos/quem-somos.html' },
            { text: 'Contato', href: '/static/contato/contato.html' }
        ];
        userSpecificNav = `
            <div class="login-button-container">
                <a href="/static/login/login.html" class="login-button">
                    <i class="fas fa-user-circle"></i>
                    Fazer login
                </a>
                <a href="/static/cadastro/cadastro.html" class="signup-button">
                    <i class="fas fa-user-plus"></i>
                    Cadastre-se
                </a>
            </div>
        `;
    }

    if (navElement) {
        console.log('Renderizando links de navegação:', navLinks);
        navLinks.forEach(link => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = link.href;
            a.textContent = link.text;
            // Verifica a URL atual para adicionar a classe 'active'
            if (window.location.pathname.endsWith(link.href.substring(link.href.lastIndexOf('/')))) {
                console.log('Link ativo encontrado:', link.text);
                a.classList.add('active');
            }
            li.appendChild(a);
            navElement.appendChild(li);
        });
    }
    
    // Insere a navegação específica do usuário (login/menu dropdown)
    const navContainer = header.querySelector('nav');
    if (navContainer) {
        // Remove o container antigo de login se existir (o do HTML original)
        const oldLoginContainer = header.querySelector('.login-button-container');
        if (oldLoginContainer) {
            console.log('Removendo container de login antigo');
            oldLoginContainer.remove();
        }
        navContainer.insertAdjacentHTML('afterend', userSpecificNav);
    } else {
        console.error('Container de navegação não encontrado');
    }

    // Lógica de Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Iniciando processo de logout');
            
            try {
                localStorage.removeItem('amadoAuthToken');
                localStorage.removeItem('amadoUserType');
                localStorage.removeItem('amadoUserId');
                localStorage.removeItem('amadoUserName');
                localStorage.removeItem('amadoUserEmail');
                localStorage.removeItem('amadoUserStatus');
                // Idealmente, chamar um endpoint /api/auth/logout no backend também
                console.log('Dados de autenticação removidos com sucesso');
                alert('Logout realizado com sucesso!');
                
                window.location.href = '/static/index.html';
            } catch (error) {
                const errorMsg = 'Erro ao realizar logout';
                console.error(errorMsg, {
                    erro: error.message,
                    stack: error.stack
                });
                alert(errorMsg);
            }
        });
    }

    // Ativar dropdown do menu do usuário
    const userDropdownButton = document.querySelector('.user-button');
    if (userDropdownButton) {
        userDropdownButton.addEventListener('click', function() {
            console.log('Toggle do menu dropdown');
            this.nextElementSibling.classList.toggle('show-dropdown');
        });
    }

    // Fechar dropdown se clicar fora
    window.onclick = function(event) {
        if (!event.target.matches('.user-button') && !event.target.closest('.user-button')) {
            var dropdowns = document.getElementsByClassName("dropdown-content");
            for (var i = 0; i < dropdowns.length; i++) {
                var openDropdown = dropdowns[i];
                if (openDropdown.classList.contains('show-dropdown')) {
                    console.log('Fechando dropdown do menu');
                    openDropdown.classList.remove('show-dropdown');
                }
            }
        }
    }

    // Atualizar links de navegação baseado no tipo de usuário
    if (navElement) {
        if (userType === 'ADMIN') {
            console.log('Atualizando navegação específica para administrador');
            navElement.innerHTML = `
                <li><a href="/static/admin/admin-panel.html">Painel Admin</a></li>
                <li><a href="/static/admin/gerenciar-clientes.html">Clientes</a></li>
                <li><a href="/static/admin/todos-agendamentos.html">Agendamentos</a></li>
                <li><a href="/static/admin/configuracoes.html">Configurações</a></li>`;
        } else if (userType === 'ATENDENTE') {
            if (userStatus === 'ATIVO') {
                console.log('Atualizando navegação específica para atendente ativo');
                navElement.innerHTML = `
                    <li><a href="/static/atendente/perfil.html">Meu Perfil</a></li>
                    <li><a href="/static/atendente/minha-agenda.html">Minha Agenda</a></li>
                    <li><a href="/static/atendente/solicitacoes.html">Solicitações</a></li>
                    <li><a href="/static/atendente/avaliacoes.html">Avaliações</a></li>`;
            } else {
                console.warn('Atendente não ativo tentando acessar navegação:', {
                    status: userStatus
                });
            }
        }
    }
});