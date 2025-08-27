-- Recriando o banco de dados
DROP DATABASE IF EXISTS site_agendamento;
CREATE DATABASE site_agendamento CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE site_agendamento;

-- Definição de ENUMs para melhor organização e consistência
-- Estes podem ser expandidos conforme necessário
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

-- Tabela Usuario: Armazena todos os tipos de usuários
CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(200) NOT NULL,
    nome_social VARCHAR(200) NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL COMMENT 'Armazenar hash da senha',
    data_nascimento DATE NULL,
    tipo_usuario ENUM('CLIENTE', 'ATENDENTE', 'ADMIN') NOT NULL,
    
    -- Campos de Identidade e Orientação (expandidos)
    identidade_genero ENUM(
        'MULHER_CIS', 'HOMEM_CIS', 'MULHER_TRANS', 'HOMEM_TRANS', 
        'NAO_BINARIE', 'AGENERO', 'GENERO_FLUIDO', 
        'TRAVESTI', 'OUTRA_IDENTIDADE', 'PREFIRO_NAO_DECLARAR_GENERO'
    ) NULL,
    orientacao_sexual ENUM(
        'ASSEXUAL', 'BISSEXUAL', 'HETEROSSEXUAL', 
        'LESBICA', 'GAY', 'PANSEXUAL', 'QUEER', 'OUTRA_ORIENTACAO', 'PREFIRO_NAO_DECLARAR_ORIENTACAO'
    ) NULL,
    pronomes VARCHAR(100) NULL COMMENT 'Ex: Ela/Dela, Ele/Dele, Elu/Delu, etc.',
    
    situacao ENUM(
        'ATIVO', -- Para clientes aprovados automaticamente e atendentes/admins aprovados
        'PENDENTE_APROVACAO', -- Para atendentes aguardando aprovação
        'BLOQUEADO',
        'INATIVO' -- Caso um usuário queira desativar a conta sem excluir
    ) NOT NULL DEFAULT 'PENDENTE_APROVACAO',
    
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ultimo_login TIMESTAMP NULL
) COMMENT 'Tabela central de usuários da plataforma.';

ALTER TABLE usuario ADD COLUMN senha_texto VARCHAR(255);

-- Tabela para armazenar múltiplos telefones por usuário
CREATE TABLE telefone (
    id_telefone INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    numero_telefone VARCHAR(20) NOT NULL,
    tipo_telefone ENUM('CELULAR', 'RESIDENCIAL', 'COMERCIAL', 'OUTRO') DEFAULT 'CELULAR',
    is_principal BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) COMMENT 'Telefones associados aos usuários.';

-- Tabela para armazenar múltiplos endereços por usuário
CREATE TABLE endereco (
    id_endereco INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    logradouro VARCHAR(255) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100) NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL COMMENT 'Sigla do estado, ex: SP',
    cep VARCHAR(9) NOT NULL COMMENT 'Formato XXXXX-XXX',
    tipo_endereco ENUM('RESIDENCIAL', 'COMERCIAL', 'ATENDIMENTO', 'OUTRO') DEFAULT 'RESIDENCIAL',
    is_principal BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) COMMENT 'Endereços associados aos usuários.';

-- Tabela AtendenteDetalhes: Informações específicas dos atendentes
CREATE TABLE atendente_detalhes (
    id_usuario INT PRIMARY KEY,
    area_atuacao ENUM(
        'SAUDE', 
        'JURIDICO', 
        'CARREIRA', 
        'CONTABIL', 
        'ASSISTENCIA_SOCIAL',
        'PSICOLOGIA', -- Adicionando como exemplo de especialização de saúde
        'TERAPIAS_ALTERNATIVAS' -- Adicionando como exemplo
    ) NOT NULL,
    qualificacao_descricao TEXT NOT NULL COMMENT 'Formação, experiência, abordagem de trabalho, etc.',
    especialidades TEXT NULL COMMENT 'Lista de especialidades mais específicas, separadas por vírgula ou ponto e vírgula. Ex: Direito de Família, Terapia Cognitivo-Comportamental, Consultoria para MEI.',
    registro_profissional VARCHAR(50) NULL COMMENT 'Ex: CRM, OAB, CRP. Incluir órgão emissor se necessário.',
    anos_experiencia INT NULL,
    curriculo_link VARCHAR(255) NULL,
    aceita_atendimento_online BOOLEAN DEFAULT TRUE,
    aceita_atendimento_presencial BOOLEAN DEFAULT FALSE,
    id_endereco_atendimento_presencial INT NULL COMMENT 'FK para a tabela endereco, caso o atendimento presencial seja em local fixo do atendente.',
    duracao_padrao_atendimento_min INT DEFAULT 60 COMMENT 'Duração padrão em minutos. Pode ser ajustada no agendamento.',
    observacoes_internas_admin TEXT NULL COMMENT 'Notas do admin sobre o atendente, não visível ao público.',
    
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_endereco_atendimento_presencial) REFERENCES endereco(id_endereco) ON DELETE SET NULL
) COMMENT 'Detalhes e qualificações específicas dos usuários do tipo ATENDENTE.';

-- Tabela Agendamento: Centraliza todos os agendamentos
CREATE TABLE agendamento (
    id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_atendente INT NOT NULL,
    
    data_hora_inicio DATETIME NOT NULL,
    duracao_minutos INT NOT NULL COMMENT 'Duração do agendamento em minutos.',
    
    assunto_solicitacao TEXT NULL COMMENT 'Breve descrição do cliente sobre o motivo do agendamento.',
    observacoes_cliente TEXT NULL COMMENT 'Observações adicionais do cliente.',
    observacoes_atendente TEXT NULL COMMENT 'Observações do atendente sobre o agendamento/cliente.',
    
    modalidade ENUM('ONLINE', 'PRESENCIAL') NOT NULL,
    link_atendimento_online VARCHAR(255) NULL COMMENT 'Para modalidade ONLINE.',
    id_local_atendimento_presencial INT NULL COMMENT 'FK para endereco, se presencial em local específico. Pode ser o do atendente ou outro combinado.',

    status_agendamento ENUM(
        'SOLICITADO',       -- Cliente solicitou, aguardando confirmação do atendente
        'CONFIRMADO',       -- Atendente confirmou
        'REALIZADO',        -- Atendimento concluído
        'CANCELADO_CLIENTE',
        'CANCELADO_ATENDENTE',
        'NAO_COMPARECEU_CLIENTE',
        'NAO_COMPARECEU_ATENDENTE',
        'REMARCADO_SOLICITADO' -- Nova solicitação após um cancelamento/não comparecimento
    ) NOT NULL DEFAULT 'SOLICITADO',
    
    id_agendamento_origem INT NULL COMMENT 'Para rastrear remarcações, FK para agendamento.id_agendamento',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_cliente) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_atendente) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_local_atendimento_presencial) REFERENCES endereco(id_endereco) ON DELETE SET NULL,
    FOREIGN KEY (id_agendamento_origem) REFERENCES agendamento(id_agendamento) ON DELETE SET NULL,
    
    CONSTRAINT chk_cliente_diferente_atendente CHECK (id_cliente <> id_atendente),
    CONSTRAINT uq_atendente_horario UNIQUE (id_atendente, data_hora_inicio), -- Garante que um atendente não tenha dois agendamentos no mesmo horário de início. Idealmente, verificar sobreposição com duração.
    CONSTRAINT uq_cliente_horario UNIQUE (id_cliente, data_hora_inicio) -- Garante que um cliente não tenha dois agendamentos no mesmo horário de início.
) COMMENT 'Registros de agendamentos entre clientes e atendentes.';

-- Tabela Avaliacao: Avaliações dos atendimentos
CREATE TABLE avaliacao (
    id_avaliacao INT AUTO_INCREMENT PRIMARY KEY,
    id_agendamento INT NOT NULL UNIQUE COMMENT 'Cada agendamento só pode ter uma avaliação.',
    id_avaliador INT NOT NULL COMMENT 'Quem está avaliando (normalmente o cliente). FK para usuario.id_usuario',
    id_avaliado INT NOT NULL COMMENT 'Quem está sendo avaliado (normalmente o atendente). FK para usuario.id_usuario',
    nota INT NOT NULL COMMENT 'Nota de 1 a 5.',
    comentario TEXT NULL,
    anonima BOOLEAN DEFAULT FALSE,
    data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_agendamento) REFERENCES agendamento(id_agendamento) ON DELETE CASCADE,
    FOREIGN KEY (id_avaliador) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_avaliado) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_nota CHECK (nota >= 1 AND nota <= 5)
) COMMENT 'Avaliações dos serviços prestados, vinculadas a um agendamento.';

-- Tabela LogUsuarioStatus: Histórico de mudanças de status dos usuários
CREATE TABLE usuario_status_log (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario_afetado INT NOT NULL,
    status_anterior ENUM('ATIVO', 'PENDENTE_APROVACAO', 'BLOQUEADO', 'INATIVO') NULL,
    novo_status ENUM('ATIVO', 'PENDENTE_APROVACAO', 'BLOQUEADO', 'INATIVO') NOT NULL,
    data_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_admin_responsavel INT NULL COMMENT 'Admin que realizou a alteração. NULL se automático.',
    motivo TEXT NULL,
    
    FOREIGN KEY (id_usuario_afetado) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_admin_responsavel) REFERENCES usuario(id_usuario) ON DELETE SET NULL -- Garante que o admin exista
) COMMENT 'Log de todas as alterações de status dos usuários.';

-- Tabela Notificacoes: Para comunicação com os usuários
CREATE TABLE notificacao (
    id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario_destino INT NOT NULL,
    titulo VARCHAR(100) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo_notificacao ENUM(
        'GERAL',
        'NOVO_AGENDAMENTO_SOLICITADO', 
        'AGENDAMENTO_CONFIRMADO', 
        'AGENDAMENTO_CANCELADO', 
        'LEMBRETE_AGENDAMENTO',
        'ATENDENTE_CADASTRO_APROVADO',
        'ATENDENTE_CADASTRO_REPROVADO',
        'ATENDENTE_CADASTRO_PENDENTE',
        'NOVA_AVALIACAO_RECEBIDA',
        'SOLICITACAO_MUDANCA_SENHA'
    ) NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    link_referencia VARCHAR(255) NULL COMMENT 'Link para a página relevante (ex: /agendamentos/123)',
    
    FOREIGN KEY (id_usuario_destino) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) COMMENT 'Notificações enviadas aos usuários da plataforma.';


-- Índices para otimizar consultas comuns
CREATE INDEX idx_usuario_tipo_situacao ON usuario(tipo_usuario, situacao);
CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_agendamento_cliente ON agendamento(id_cliente, data_hora_inicio);
CREATE INDEX idx_agendamento_atendente ON agendamento(id_atendente, data_hora_inicio);
CREATE INDEX idx_agendamento_status ON agendamento(status_agendamento);
CREATE INDEX idx_atendente_area ON atendente_detalhes(area_atuacao);
CREATE INDEX idx_notificacao_usuario_lida ON notificacao(id_usuario_destino, lida, data_criacao);

-- Triggers

DELIMITER $$

-- Trigger: Define a situação do usuário CLIENTE como ATIVO e ATENDENTE como PENDENTE_APROVACAO ao inserir
CREATE TRIGGER tg_definir_situacao_inicial_usuario
BEFORE INSERT ON usuario
FOR EACH ROW
BEGIN
    IF NEW.tipo_usuario = 'CLIENTE' THEN
        SET NEW.situacao = 'ATIVO';
    ELSEIF NEW.tipo_usuario = 'ATENDENTE' THEN
        SET NEW.situacao = 'PENDENTE_APROVACAO';
    ELSEIF NEW.tipo_usuario = 'ADMIN' THEN
        SET NEW.situacao = 'ATIVO'; -- Admins já entram ativos
    END IF;
END$$

-- Trigger: Loga mudança de status do usuário
CREATE TRIGGER tg_log_mudanca_status_usuario
AFTER UPDATE ON usuario
FOR EACH ROW
BEGIN
    IF NEW.situacao <> OLD.situacao THEN
        -- O id_admin_responsavel será preenchido pelo procedure que fizer a mudança
        -- Se a mudança for "manual" ou por outro trigger, id_admin_responsavel pode ser NULL
        -- ou podemos tentar obter de uma variável de sessão se definida.
        -- Para simplificar, deixamos NULL e os procedures devem preencher.
        INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, motivo, id_admin_responsavel)
        VALUES (NEW.id_usuario, OLD.situacao, NEW.situacao, 'Alteração de status via sistema.', NULL);
    END IF;
END$$

-- Trigger: Notificar atendente sobre novo agendamento solicitado
CREATE TRIGGER tg_notificar_novo_agendamento_solicitado
AFTER INSERT ON agendamento
FOR EACH ROW
BEGIN
    DECLARE nome_cliente VARCHAR(200);
    SELECT u.nome_completo INTO nome_cliente FROM usuario u WHERE u.id_usuario = NEW.id_cliente;

    INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
    VALUES (
        NEW.id_atendente, 
        'Nova Solicitação de Agendamento',
        CONCAT('Você recebeu uma nova solicitação de agendamento de ', IFNULL(nome_cliente, 'um cliente'), 
               ' para ', DATE_FORMAT(NEW.data_hora_inicio, '%d/%m/%Y às %H:%i'), '.'),
        'NOVO_AGENDAMENTO_SOLICITADO',
        CONCAT('/painel-atendente/agendamentos/', NEW.id_agendamento)
    );
END$$

-- Trigger: Notificar cliente e atendente sobre mudança de status do agendamento
CREATE TRIGGER tg_notificar_mudanca_status_agendamento
AFTER UPDATE ON agendamento
FOR EACH ROW
BEGIN
    DECLARE msg_cliente TEXT;
    DECLARE msg_atendente TEXT;
    DECLARE titulo_notificacao VARCHAR(100);
    DECLARE link_ref VARCHAR(255);
    DECLARE tipo_not_cliente ENUM(
        'GERAL', 'NOVO_AGENDAMENTO_SOLICITADO', 'AGENDAMENTO_CONFIRMADO', 'AGENDAMENTO_CANCELADO', 
        'LEMBRETE_AGENDAMENTO', 'ATENDENTE_CADASTRO_APROVADO', 'ATENDENTE_CADASTRO_REPROVADO', 
        'ATENDENTE_CADASTRO_PENDENTE', 'NOVA_AVALIACAO_RECEBIDA', 'SOLICITACAO_MUDANCA_SENHA'
    );
     DECLARE tipo_not_atendente ENUM(
        'GERAL', 'NOVO_AGENDAMENTO_SOLICITADO', 'AGENDAMENTO_CONFIRMADO', 'AGENDAMENTO_CANCELADO', 
        'LEMBRETE_AGENDAMENTO', 'ATENDENTE_CADASTRO_APROVADO', 'ATENDENTE_CADASTRO_REPROVADO', 
        'ATENDENTE_CADASTRO_PENDENTE', 'NOVA_AVALIACAO_RECEBIDA', 'SOLICITACAO_MUDANCA_SENHA'
    );

    SET link_ref = CONCAT('/meus-agendamentos/', NEW.id_agendamento);

    IF NEW.status_agendamento <> OLD.status_agendamento THEN
        CASE NEW.status_agendamento
            WHEN 'CONFIRMADO' THEN
                SET titulo_notificacao = 'Agendamento Confirmado!';
                SET msg_cliente = CONCAT('Seu agendamento para ', DATE_FORMAT(NEW.data_hora_inicio, '%d/%m/%Y às %H:%i'), ' foi confirmado.');
                SET tipo_not_cliente = 'AGENDAMENTO_CONFIRMADO';
                -- Pode notificar o atendente também, se relevante, que ele confirmou.
            WHEN 'CANCELADO_CLIENTE' THEN
                SET titulo_notificacao = 'Agendamento Cancelado';
                SET msg_atendente = CONCAT('O agendamento com o cliente para ', DATE_FORMAT(NEW.data_hora_inicio, '%d/%m/%Y às %H:%i'), ' foi cancelado pelo cliente.');
                SET tipo_not_atendente = 'AGENDAMENTO_CANCELADO';
            WHEN 'CANCELADO_ATENDENTE' THEN
                SET titulo_notificacao = 'Agendamento Cancelado';
                SET msg_cliente = CONCAT('Seu agendamento para ', DATE_FORMAT(NEW.data_hora_inicio, '%d/%m/%Y às %H:%i'), ' foi cancelado pelo atendente.');
                SET tipo_not_cliente = 'AGENDAMENTO_CANCELADO';
            -- Adicionar mais casos conforme necessário (REALIZADO, NAO_COMPARECEU, etc.)
            ELSE
                SET titulo_notificacao = NULL; -- Não envia notificação para outros status por este trigger
        END CASE;

        IF msg_cliente IS NOT NULL AND tipo_not_cliente IS NOT NULL THEN
            INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
            VALUES (NEW.id_cliente, titulo_notificacao, msg_cliente, tipo_not_cliente, link_ref);
        END IF;
        
        IF msg_atendente IS NOT NULL AND tipo_not_atendente IS NOT NULL THEN
            INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
            VALUES (NEW.id_atendente, titulo_notificacao, msg_atendente, tipo_not_atendente, CONCAT('/painel-atendente/agendamentos/', NEW.id_agendamento));
        END IF;
    END IF;
END$$

DELIMITER ;


-- Views Solicitadas e Adicionais

-- View: Histórico de todos os agendamentos (para admins ou relatórios)
CREATE VIEW vw_historico_agendamentos_completo AS
SELECT 
    ag.id_agendamento,
    ag.data_hora_inicio,
    ag.duracao_minutos,
    c.id_usuario AS id_cliente,
    c.nome_completo AS nome_cliente,
    c.email AS email_cliente,
    att.id_usuario AS id_atendente,
    att.nome_completo AS nome_atendente,
    att.email AS email_atendente,
    ad.area_atuacao AS area_atendente,
    ad.qualificacao_descricao AS qualificacao_atendente,
    ag.modalidade,
    ag.status_agendamento,
    ag.data_criacao AS data_solicitacao_agendamento,
    aval.nota AS nota_avaliacao,
    aval.comentario AS comentario_avaliacao
FROM agendamento ag
JOIN usuario c ON ag.id_cliente = c.id_usuario
JOIN usuario att ON ag.id_atendente = att.id_usuario
LEFT JOIN atendente_detalhes ad ON att.id_usuario = ad.id_usuario
LEFT JOIN avaliacao aval ON ag.id_agendamento = aval.id_agendamento
ORDER BY ag.data_hora_inicio DESC;

-- View: Clientes Cadastrados (ativos)
CREATE VIEW vw_clientes_cadastrados_ativos AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.nome_social,
    u.email,
    u.cpf,
    u.data_nascimento,
    u.identidade_genero,
    u.orientacao_sexual,
    u.pronomes,
    u.data_criacao
FROM usuario u
WHERE u.tipo_usuario = 'CLIENTE' AND u.situacao = 'ATIVO'
ORDER BY u.nome_completo;

-- View: Atendentes Pendentes de Aprovação
CREATE VIEW vw_atendentes_pendentes AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.email,
    u.cpf,
    ad.area_atuacao,
    ad.qualificacao_descricao,
    ad.registro_profissional,
    u.data_criacao AS data_cadastro_usuario,
    (SELECT GROUP_CONCAT(CONCAT(t.tipo_telefone, ': ', t.numero_telefone) SEPARATOR '; ') FROM telefone t WHERE t.id_usuario = u.id_usuario) AS contatos_telefonicos
FROM usuario u
JOIN atendente_detalhes ad ON u.id_usuario = ad.id_usuario
WHERE u.tipo_usuario = 'ATENDENTE' AND u.situacao = 'PENDENTE_APROVACAO'
ORDER BY u.data_criacao ASC;

-- View: Atendentes Aprovados (ativos)
CREATE VIEW vw_atendentes_aprovados AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.nome_social,
    u.email,
    u.cpf,
    ad.area_atuacao,
    ad.qualificacao_descricao,
    ad.especialidades,
    ad.registro_profissional,
    ad.anos_experiencia,
    ad.curriculo_link,
    (SELECT AVG(aval.nota) FROM agendamento ag_aval JOIN avaliacao aval ON ag_aval.id_agendamento = aval.id_agendamento WHERE ag_aval.id_atendente = u.id_usuario) AS media_avaliacoes,
    (SELECT COUNT(ag_aval.id_agendamento) FROM agendamento ag_aval WHERE ag_aval.id_atendente = u.id_usuario AND ag_aval.status_agendamento = 'REALIZADO') AS total_atendimentos_realizados,
    u.data_criacao,
    log_aprov.data_alteracao AS data_aprovacao
FROM usuario u
JOIN atendente_detalhes ad ON u.id_usuario = ad.id_usuario
LEFT JOIN (
    SELECT id_usuario_afetado, MAX(data_alteracao) as data_alteracao 
    FROM usuario_status_log 
    WHERE novo_status = 'ATIVO'
    GROUP BY id_usuario_afetado
) log_aprov ON u.id_usuario = log_aprov.id_usuario_afetado
WHERE u.tipo_usuario = 'ATENDENTE' AND u.situacao = 'ATIVO'
ORDER BY u.nome_completo;

-- View: Atendentes Bloqueados
CREATE VIEW vw_atendentes_bloqueados AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.email,
    u.cpf,
    ad.area_atuacao,
    log_block.data_alteracao AS data_bloqueio,
    log_block.motivo AS motivo_bloqueio,
    admin_resp.nome_completo AS admin_responsavel_bloqueio
FROM usuario u
JOIN atendente_detalhes ad ON u.id_usuario = ad.id_usuario
JOIN (
    SELECT usl.id_usuario_afetado, usl.data_alteracao, usl.motivo, usl.id_admin_responsavel,
           ROW_NUMBER() OVER(PARTITION BY usl.id_usuario_afetado ORDER BY usl.data_alteracao DESC) as rn
    FROM usuario_status_log usl
    WHERE usl.novo_status = 'BLOQUEADO'
) log_block ON u.id_usuario = log_block.id_usuario_afetado AND log_block.rn = 1
LEFT JOIN usuario admin_resp ON log_block.id_admin_responsavel = admin_resp.id_usuario
WHERE u.tipo_usuario = 'ATENDENTE' AND u.situacao = 'BLOQUEADO'
ORDER BY log_block.data_alteracao DESC;

-- View: Próximos Agendamentos (Geral - para Admin ou para filtrar por cliente/atendente na aplicação)
CREATE VIEW vw_proximos_agendamentos AS
SELECT
    ag.id_agendamento,
    ag.data_hora_inicio,
    ag.duracao_minutos,
    cli.nome_completo AS cliente_nome,
    cli.email AS cliente_email,
    ate.nome_completo AS atendente_nome,
    ate.email AS atendente_email,
    adet.area_atuacao,
    ag.modalidade,
    ag.status_agendamento
FROM agendamento ag
JOIN usuario cli ON ag.id_cliente = cli.id_usuario
JOIN usuario ate ON ag.id_atendente = ate.id_usuario
LEFT JOIN atendente_detalhes adet ON ate.id_usuario = adet.id_usuario
WHERE ag.data_hora_inicio >= CURDATE() AND ag.status_agendamento IN ('SOLICITADO', 'CONFIRMADO')
ORDER BY ag.data_hora_inicio ASC;

-- View: Média de avaliações por atendente
CREATE VIEW vw_media_avaliacoes_atendentes AS
SELECT
    u.id_usuario AS id_atendente,
    u.nome_completo AS nome_atendente,
    ad.area_atuacao,
    COUNT(aval.id_avaliacao) AS total_avaliacoes,
    ROUND(AVG(aval.nota), 2) AS media_geral_notas
FROM usuario u
JOIN atendente_detalhes ad ON u.id_usuario = ad.id_usuario
LEFT JOIN agendamento ag ON u.id_usuario = ag.id_atendente AND ag.status_agendamento = 'REALIZADO'
LEFT JOIN avaliacao aval ON ag.id_agendamento = aval.id_agendamento
WHERE u.tipo_usuario = 'ATENDENTE' AND u.situacao = 'ATIVO'
GROUP BY u.id_usuario, u.nome_completo, ad.area_atuacao
ORDER BY media_geral_notas DESC, total_avaliacoes DESC;

-- Configuração para Functions (se necessário no seu ambiente MySQL)
SET GLOBAL log_bin_trust_function_creators = 1;

-- Functions (Exemplos)

DELIMITER $$

-- Function: Verifica disponibilidade de um atendente para um novo agendamento
CREATE FUNCTION fn_verificar_disponibilidade_atendente(
    p_id_atendente INT,
    p_data_hora_inicio DATETIME,
    p_duracao_minutos INT,
    p_id_agendamento_editar INT -- Passar NULL para novo agendamento, ou ID do agendamento sendo editado
)
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE conflitos INT;
    DECLARE p_data_hora_fim DATETIME;

    SET p_data_hora_fim = DATE_ADD(p_data_hora_inicio, INTERVAL p_duracao_minutos MINUTE);

    SELECT COUNT(*) INTO conflitos
    FROM agendamento ag
    WHERE ag.id_atendente = p_id_atendente
      AND ag.status_agendamento IN ('SOLICITADO', 'CONFIRMADO', 'REALIZADO') -- Considerar também os realizados para evitar duplicação histórica no mesmo slot
      AND (p_id_agendamento_editar IS NULL OR ag.id_agendamento <> p_id_agendamento_editar) -- Ignora o próprio agendamento se estiver editando
      AND (
          -- Novo agendamento começa durante um existente
          (p_data_hora_inicio >= ag.data_hora_inicio AND p_data_hora_inicio < DATE_ADD(ag.data_hora_inicio, INTERVAL ag.duracao_minutos MINUTE)) OR
          -- Novo agendamento termina durante um existente
          (p_data_hora_fim > ag.data_hora_inicio AND p_data_hora_fim <= DATE_ADD(ag.data_hora_inicio, INTERVAL ag.duracao_minutos MINUTE)) OR
          -- Novo agendamento envolve completamente um existente
          (p_data_hora_inicio <= ag.data_hora_inicio AND p_data_hora_fim >= DATE_ADD(ag.data_hora_inicio, INTERVAL ag.duracao_minutos MINUTE))
      );

    IF conflitos > 0 THEN
        RETURN FALSE; -- Não disponível
    ELSE
        RETURN TRUE;  -- Disponível
    END IF;
END$$

-- Function: Calcula a média de notas de um atendente
CREATE FUNCTION fn_calcular_media_avaliacao_atendente(p_id_atendente INT)
RETURNS DECIMAL(3,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE media DECIMAL(3,2);
    SELECT ROUND(AVG(a.nota), 2)
    INTO media
    FROM avaliacao a
    JOIN agendamento ag ON a.id_agendamento = ag.id_agendamento
    WHERE ag.id_atendente = p_id_atendente AND ag.status_agendamento = 'REALIZADO'; -- Considerar apenas avaliações de atendimentos realizados
    RETURN IFNULL(media, 0.00);
END$$

DELIMITER ;

-- Procedures (Estrutura básica - a lógica interna pode ser mais complexa)

DELIMITER $$

-- Procedure: Aprovar Atendente
CREATE PROCEDURE sp_aprovar_atendente(
    IN p_id_atendente_aprovar INT,
    IN p_id_admin_aprovador INT,
    IN p_motivo_aprovacao VARCHAR(255)
)
BEGIN
    DECLARE v_situacao_anterior ENUM('ATIVO', 'PENDENTE_APROVACAO', 'BLOQUEADO', 'INATIVO');
    DECLARE v_tipo_usuario_check ENUM('CLIENTE', 'ATENDENTE', 'ADMIN');

    SELECT situacao, tipo_usuario INTO v_situacao_anterior, v_tipo_usuario_check
    FROM usuario WHERE id_usuario = p_id_atendente_aprovar;

    IF v_tipo_usuario_check IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atendente não encontrado.';
    ELSEIF v_tipo_usuario_check <> 'ATENDENTE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário não é um atendente.';
    ELSEIF v_situacao_anterior = 'ATIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atendente já está ativo/aprovado.';
    ELSE
        UPDATE usuario 
        SET situacao = 'ATIVO' 
        WHERE id_usuario = p_id_atendente_aprovar;

        INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, id_admin_responsavel, motivo)
        VALUES (p_id_atendente_aprovar, v_situacao_anterior, 'ATIVO', p_id_admin_aprovador, p_motivo_aprovacao);
        
        INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
        VALUES (
            p_id_atendente_aprovar,
            'Cadastro Aprovado!',
            'Parabéns! Seu cadastro como atendente na plataforma Connect+ foi aprovado. Você já pode configurar seu perfil e receber agendamentos.',
            'ATENDENTE_CADASTRO_APROVADO',
            '/perfil'
        );
        
        SELECT 'Atendente aprovado com sucesso.' AS resultado;
    END IF;
END$$

-- Procedure: Reprovar/Bloquear Atendente
CREATE PROCEDURE sp_reprovar_bloquear_atendente(
    IN p_id_atendente_reprovar INT,
    IN p_id_admin_responsavel INT,
    IN p_motivo_reprovacao VARCHAR(255)
)
BEGIN
    DECLARE v_situacao_anterior ENUM('ATIVO', 'PENDENTE_APROVACAO', 'BLOQUEADO', 'INATIVO');
    DECLARE v_tipo_usuario_check ENUM('CLIENTE', 'ATENDENTE', 'ADMIN');

    SELECT situacao, tipo_usuario INTO v_situacao_anterior, v_tipo_usuario_check
    FROM usuario WHERE id_usuario = p_id_atendente_reprovar;
    
    IF v_tipo_usuario_check IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atendente não encontrado.';
    ELSEIF v_tipo_usuario_check <> 'ATENDENTE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário não é um atendente.';
    ELSEIF v_situacao_anterior = 'BLOQUEADO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atendente já está bloqueado.';
    ELSE
        UPDATE usuario 
        SET situacao = 'BLOQUEADO' 
        WHERE id_usuario = p_id_atendente_reprovar;

        INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, id_admin_responsavel, motivo)
        VALUES (p_id_atendente_reprovar, v_situacao_anterior, 'BLOQUEADO', p_id_admin_responsavel, p_motivo_reprovacao);

        INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
        VALUES (
            p_id_atendente_reprovar,
            'Cadastro Não Aprovado/Bloqueado',
            CONCAT('Seu cadastro como atendente foi analisado e infelizmente não foi aprovado no momento, ou sua conta foi bloqueada. Motivo: ', p_motivo_reprovacao, '. Entre em contato para mais informações.'),
            'ATENDENTE_CADASTRO_REPROVADO'
        );
        SELECT 'Atendente reprovado/bloqueado com sucesso.' AS resultado;
    END IF;
END$$

-- Procedure: Criar Agendamento (simplificado, a verificação de disponibilidade deve ser robusta)
CREATE PROCEDURE sp_criar_agendamento(
    IN p_id_cliente INT,
    IN p_id_atendente INT,
    IN p_data_hora_inicio DATETIME,
    IN p_duracao_minutos INT,
    IN p_modalidade ENUM('ONLINE', 'PRESENCIAL'),
    IN p_assunto_solicitacao TEXT,
    IN p_link_online VARCHAR(255), -- Opcional
    IN p_id_local_presencial INT   -- Opcional
)
BEGIN
    DECLARE v_disponivel BOOLEAN;
    DECLARE v_cliente_tipo ENUM('CLIENTE', 'ATENDENTE', 'ADMIN');
    DECLARE v_atendente_tipo ENUM('CLIENTE', 'ATENDENTE', 'ADMIN');
    DECLARE v_atendente_situacao ENUM('ATIVO', 'PENDENTE_APROVACAO', 'BLOQUEADO', 'INATIVO');

    SELECT tipo_usuario INTO v_cliente_tipo FROM usuario WHERE id_usuario = p_id_cliente;
    SELECT tipo_usuario, situacao INTO v_atendente_tipo, v_atendente_situacao FROM usuario WHERE id_usuario = p_id_atendente;

    IF v_cliente_tipo <> 'CLIENTE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário solicitante não é um cliente.';
    END IF;
    IF v_atendente_tipo <> 'ATENDENTE' OR v_atendente_situacao <> 'ATIVO' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Atendente inválido ou não está ativo.';
    END IF;
    IF p_id_cliente = p_id_atendente THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cliente e atendente não podem ser a mesma pessoa.';
    END IF;
    IF p_data_hora_inicio < NOW() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Não é possível agendar no passado.';
    END IF;
    IF p_duracao_minutos <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duração do agendamento deve ser positiva.';
    END IF;


    SET v_disponivel = fn_verificar_disponibilidade_atendente(p_id_atendente, p_data_hora_inicio, p_duracao_minutos, NULL);

    IF v_disponivel THEN
        INSERT INTO agendamento (
            id_cliente, id_atendente, data_hora_inicio, duracao_minutos, 
            modalidade, assunto_solicitacao, link_atendimento_online, id_local_atendimento_presencial, 
            status_agendamento
        ) VALUES (
            p_id_cliente, p_id_atendente, p_data_hora_inicio, p_duracao_minutos,
            p_modalidade, p_assunto_solicitacao, p_link_online, p_id_local_presencial,
            'SOLICITADO' -- Estado inicial
        );
        SELECT LAST_INSERT_ID() AS id_novo_agendamento, 'Agendamento solicitado com sucesso.' AS mensagem;
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Horário indisponível para o atendente selecionado.';
    END IF;
END$$

DELIMITER ;

-- Inserção de dados iniciais (Exemplo)
INSERT INTO usuario (nome_completo, nome_social, cpf, email, senha, data_nascimento, tipo_usuario, identidade_genero, orientacao_sexual, pronomes, situacao) VALUES 
('Admin da Plataforma', 'Admin', '000.000.000-00', 'admin@amado.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '1990-01-01', 'ADMIN', 'NAO_BINARIE', 'PANSEXUAL', 'Elu/Delu', 'ATIVO'),
('Maria Silva Cliente', 'Maria', '111.111.111-11', 'maria.cliente@email.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '1985-05-10', 'CLIENTE', 'MULHER_CIS', 'HETEROSSEXUAL', 'Ela/Dela', 'ATIVO'),
('João Santos Atendente', 'Joca', '222.222.222-22', 'joao.atendente@email.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '1992-08-20', 'ATENDENTE', 'HOMEM_TRANS', 'BISSEXUAL', 'Ele/Dele', 'PENDENTE_APROVACAO'); -- Situação inicial para atendente

-- Detalhes para o atendente de exemplo
INSERT INTO atendente_detalhes (id_usuario, area_atuacao, qualificacao_descricao, especialidades, registro_profissional, anos_experiencia, duracao_padrao_atendimento_min)
VALUES (
    (SELECT id_usuario FROM usuario WHERE email = 'joao.atendente@email.com'),
    'SAUDE',
    'Psicólogo clínico com foco em terapia afirmativa para pessoas LGBTQIAPN+. Formado pela Universidade X, com especialização em Gênero e Sexualidade pela Instituição Y. Experiência com aconselhamento individual e de casais.',
    'Terapia Afirmativa, Aconselhamento LGBTQIAPN+, Saúde Mental Comunitária',
    'CRP 00/12345',
    5,
    50
);

-- Adicionar um telefone para o admin
INSERT INTO telefone (id_usuario, numero_telefone, tipo_telefone, is_principal) VALUES
((SELECT id_usuario FROM usuario WHERE email = 'admin@amado.com'), '(11) 99999-0000', 'CELULAR', TRUE);

-- Adicionar um endereço para o admin
INSERT INTO endereco (id_usuario, logradouro, numero, bairro, cidade, estado, cep, tipo_endereco, is_principal) VALUES
((SELECT id_usuario FROM usuario WHERE email = 'admin@amado.com'), 'Rua Principal', '123', 'Centro', 'Cidade Exemplo', 'SP', '01000-000', 'COMERCIAL', TRUE);


SELECT 'Banco de dados site_agendamento recriado e populado com estrutura e exemplos iniciais.' AS status_final;

SET SQL_MODE=@OLD_SQL_MODE;

select * from usuario;

select * from agendamento;

UPDATE usuario
SET 
    tipo_usuario = 'ADMIN',
    situacao = 'ATIVO'
WHERE 
    email = 'exemplo@gmail.com'; -- Substitua pelo email real;
    
CREATE TABLE IF NOT EXISTS codigos_recuperacao (
    id_usuario INT NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    data_expiracao DATETIME NOT NULL,
    tentativas INT DEFAULT 0,
    PRIMARY KEY (id_usuario),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
