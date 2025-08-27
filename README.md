# Connect+

**Connect+** é uma iniciativa dedicada a fornecer um espaço seguro e acolhedor, facilitando o acesso a serviços de apoio qualificados nas áreas de saúde, jurídica, carreira, contábil e assistência social. Nossa missão é conectar pessoas a profissionais que compreendem suas vivências e necessidades específicas.

---

## 📋 Índice

- [✨ Funcionalidades](#-funcionalidades)
- [🛠️ Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [🚀 Como Executar o Projeto](#-como-executar-o-projeto)
  - [Pré-requisitos](#pré-requisitos)
  - [Instalação](#instalação)
- [🏗️ Estrutura do Projeto](#️-estrutura-do-projeto)
- [🌐 Endpoints da API](#-endpoints-da-api)
- [📄 Licença](#-licença)

---

## ✨ Funcionalidades

A plataforma é dividida em três perfis de usuário, cada um com suas funcionalidades específicas:

#### 👤 Para Clientes:
- **Cadastro Seguro:** Processo de cadastro simples e seguro.
- **Busca de Profissionais:** Encontre atendentes por área de atuação ou nome.
- **Agendamento Online:** Visualize a disponibilidade e agende atendimentos de forma intuitiva.
- **Painel de Controle:** Gerencie seus agendamentos futuros e passados.
- **Sistema de Avaliação:** Avalie os atendimentos realizados para ajudar a comunidade.

#### 🧑‍⚕️ Para Atendentes (Profissionais):
- **Perfil Profissional Detalhado:** Cadastre suas qualificações, especialidades, experiência e mais.
- **Gestão de Agenda:** Gerencie sua disponibilidade e horários de atendimento.
- **Gerenciamento de Solicitações:** Receba, confirme ou recuse solicitações de agendamento.
- **Feedback e Reputação:** Visualize as avaliações recebidas pelos clientes.

#### 🛡️ Para Administradores:
- **Painel de Gerenciamento:** Interface para aprovar, reprovar ou bloquear o cadastro de atendentes.
- **Visão Geral:** Acesse listas de usuários, agendamentos e outras informações da plataforma.
- **Configurações do Sistema:** Gerencie parâmetros básicos da aplicação.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando as seguintes tecnologias:

- **Backend:**
  - [Python](https://www.python.org/) 3.x
  - [Flask](https://flask.palletsprojects.com/)
  - [Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io/) para autenticação com JSON Web Tokens.
  - [PyMySQL](https://github.com/PyMySQL/PyMySQL) para conexão com o banco de dados.
  - [Bcrypt](https://pypi.org/project/bcrypt/) para hashing de senhas.

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (Vanilla)

- **Banco de Dados:**
  - [MySQL](https://www.mysql.com/)

---

## 🚀 Como Executar o Projeto

Siga os passos abaixo para configurar e executar o projeto em seu ambiente local.

### Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:
- [Python 3.8+](https://www.python.org/downloads/)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) ou um container Docker com a imagem do MySQL.
- [Git](https://git-scm.com/)

### Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/connect-plus.git
   cd connect-plus
   ```

2. **Crie e ative um ambiente virtual:**
   ```bash
   # Para Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Para macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Instale as dependências:**
   Crie um arquivo `requirements.txt` com as bibliotecas necessárias e execute:
   ```
   # requirements.txt
   Flask
   Flask-JWT-Extended
   PyMySQL
   bcrypt
   python-dotenv
   ```
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure o Banco de Dados:**
   - Crie um banco de dados no seu servidor MySQL.
   - Renomeie o arquivo `README.md` original que contém o script SQL para `database.sql`.
   - Execute o script `database.sql` para criar todas as tabelas, views e procedures.
     ```bash
     mysql -u seu_usuario -p seu_database < database.sql
     ```

5. **Configure as Variáveis de Ambiente:**
   - Crie um arquivo `.env` na raiz do projeto, baseado em um `.env.example` (se houver) ou do zero.
   - Adicione as credenciais do banco de dados e a chave secreta do JWT:
     ```env
     DB_HOST=localhost
     DB_USER=seu_usuario_mysql
     DB_PASSWORD=sua_senha_mysql
     DB_NAME=site_agendamento
     JWT_SECRET_KEY=sua-chave-secreta-super-segura
     ```

6. **Execute a aplicação:**
   ```bash
   flask run
   ```
   A aplicação estará disponível em `http://127.0.0.1:5000`.

---

## 🏗️ Estrutura do Projeto

```
connect-plus/
├── routes/                 # Contém os blueprints do Flask com as rotas da API
│   ├── auth.py             # Rotas de autenticação (registro, login, etc.)
│   └── atendentes.py       # Rotas para gerenciar atendentes
│   └── ...                 # Outros arquivos de rotas
├── static/                 # Arquivos estáticos (CSS, JS, imagens)
│   ├── css/
│   ├── js/
│   │   ├── authManager.js  # Gerencia estado de autenticação no frontend
│   │   └── ...
│   ├── admin/              # Páginas HTML do painel de admin
│   └── ...
├── utils/                  # Módulos utilitários
│   ├── auth.py             # Funções de JWT, hash de senha
│   ├── db.py               # Funções para conexão com o banco de dados
│   └── validators.py       # Funções de validação de dados
├── templates/              # (Opcional) Se houver templates renderizados pelo servidor
├── app.py                  # Ponto de entrada da aplicação Flask
├── requirements.txt        # Dependências do Python
├── .env                    # Variáveis de ambiente (não versionado)
└── README.md               # Este arquivo
```

---

## 🌐 Endpoints da API

Abaixo estão alguns dos principais endpoints da API.

| Método | Rota                                  | Descrição                                         | Acesso      |
|:-------|:--------------------------------------|:----------------------------------------------------|:------------|
| `POST` | `/api/auth/registrar`                 | Registra um novo usuário (Cliente ou Atendente).    | Público     |
| `POST` | `/api/auth/login`                     | Autentica um usuário e retorna um token JWT.        | Público     |
| `POST` | `/api/auth/recuperar-senha`           | Inicia o processo de recuperação de senha.          | Público     |
| `GET`  | `/api/atendentes`                     | Lista todos os atendentes ativos (com filtros).     | Público     |
| `GET`  | `/api/atendentes/<id>/perfil`         | Obtém o perfil detalhado de um atendente.         | Autenticado |
| `PUT`  | `/api/atendentes/<id>/perfil`         | Atualiza o perfil do atendente logado.              | Atendente   |
| `GET`  | `/api/atendentes/<id>/disponibilidade`| Retorna os horários disponíveis para um atendente.  | Público     |
| `POST` | `/api/atendentes/<id>/aprovar`        | Aprova o cadastro de um atendente.                  | Admin       |
| `POST` | `/api/atendentes/<id>/bloquear`       | Bloqueia (ou reprova) um atendente.                 | Admin       |
| `GET`  | `/api/agendamentos`                   | Obtém os agendamentos do cliente logado.          | Cliente     |
| `POST` | `/api/agendamentos`                   | Cria uma nova solicitação de agendamento.           | Cliente     |
| `POST` | `/api/agendamentos/avaliacoes`        | Envia uma avaliação para um agendamento concluído.  | Cliente     |
