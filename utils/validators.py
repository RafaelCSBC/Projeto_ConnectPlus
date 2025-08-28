import re
from flask import jsonify
from datetime import datetime
from utils.logger import setup_logger


logger = setup_logger(__name__)

def validate_email(email):
    """Valida o formato do email."""
    logger.debug(f'Validando email: {email}')
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_valid = re.match(pattern, email) is not None
    if not is_valid:
        logger.warning(f'Email inválido: {email}')
    return is_valid

def validate_cpf(cpf):
    """Valida o formato do CPF."""
    logger.debug(f'Validando CPF: {cpf}')

    cpf = re.sub(r'[^0-9]', '', cpf)
    

    if len(cpf) != 11:
        logger.warning(f'CPF com tamanho inválido: {len(cpf)} dígitos')
        return False
    

    if cpf == cpf[0] * 11:
        logger.warning('CPF com todos os dígitos iguais')
        return False
    

    soma = 0
    for i in range(9):
        soma += int(cpf[i]) * (10 - i)
    resto = soma % 11
    if resto < 2:
        dv1 = 0
    else:
        dv1 = 11 - resto
    
    if int(cpf[9]) != dv1:
        logger.warning('Primeiro dígito verificador do CPF inválido')
        return False
    

    soma = 0
    for i in range(10):
        soma += int(cpf[i]) * (11 - i)
    resto = soma % 11
    if resto < 2:
        dv2 = 0
    else:
        dv2 = 11 - resto
    
    is_valid = int(cpf[10]) == dv2
    if not is_valid:
        logger.warning('Segundo dígito verificador do CPF inválido')
    return is_valid

def validate_telefone(telefone):
    """Valida o formato do telefone."""
    logger.debug(f'Validando telefone: {telefone}')

    telefone = re.sub(r'[^0-9]', '', telefone)
    

    is_valid = 10 <= len(telefone) <= 11
    if not is_valid:
        logger.warning(f'Telefone com tamanho inválido: {len(telefone)} dígitos')
    return is_valid

def validate_senha(senha):
    """Valida a força da senha."""
    logger.debug('Validando força da senha')

    if len(senha) < 8:
        logger.warning('Senha muito curta')
        return False
    

    if not re.search(r'[A-Z]', senha):
        logger.warning('Senha sem letra maiúscula')
        return False
    if not re.search(r'[a-z]', senha):
        logger.warning('Senha sem letra minúscula')
        return False
    if not re.search(r'[0-9]', senha):
        logger.warning('Senha sem número')
        return False
    
    logger.debug('Senha atende aos requisitos mínimos')
    return True

def validate_user_data(data, is_update=False, user_type='CLIENTE'):
    """Valida os dados do usuário (tabela usuario)."""
    logger.debug(f'Validando dados de usuário. Update: {is_update}, Tipo: {user_type}')
    errors = {}
    

    if not is_update:
        required_fields = ['nome_completo', 'cpf', 'email', 'senha', 'tipo_usuario']
        for field in required_fields:
            if field not in data or not data[field]:
                logger.warning(f'Campo obrigatório ausente: {field}')
                errors[field] = f'O campo {field} é obrigatório.'
        
        if 'tipo_usuario' in data and data['tipo_usuario'] not in ['CLIENTE', 'ATENDENTE', 'ADMIN']:
            logger.warning(f'Tipo de usuário inválido: {data.get("tipo_usuario")}')
            errors['tipo_usuario'] = 'Tipo de usuário inválido (CLIENTE, ATENDENTE, ADMIN).'
        
        if 'senha' in data and data['senha'] and not validate_senha(data['senha']):
            errors['senha'] = 'A senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um número.'

    if 'email' in data and data['email']:
        if not validate_email(data['email']):
            errors['email'] = 'Email inválido.'
    
    if 'cpf' in data and data['cpf']:
        if not validate_cpf(data['cpf']):
            errors['cpf'] = 'CPF inválido.'


    allowed_identidades = [
        'MULHER_CIS', 'HOMEM_CIS', 'MULHER_TRANS', 'HOMEM_TRANS', 
        'NAO_BINARIE', 'AGENERO', 'GENERO_FLUIDO', 'TRAVESTI',
        'OUTRA_IDENTIDADE', 'PREFIRO_NAO_DECLARAR_GENERO', None, ''
    ]
    if 'identidade_genero' in data and data.get('identidade_genero') not in allowed_identidades:
        logger.warning(f'Identidade de gênero inválida: {data.get("identidade_genero")}')
        errors['identidade_genero'] = 'Identidade de gênero inválida.'

    allowed_orientacoes = [
        'ASSEXUAL', 'BISSEXUAL', 'HETEROSSEXUAL', 'LESBICA', 'GAY', 
        'PANSEXUAL', 'QUEER', 'OUTRA_ORIENTACAO', 
        'PREFIRO_NAO_DECLARAR_ORIENTACAO', None, ''
    ]
    if 'orientacao_sexual' in data and data.get('orientacao_sexual') not in allowed_orientacoes:
        logger.warning(f'Orientação sexual inválida: {data.get("orientacao_sexual")}')
        errors['orientacao_sexual'] = 'Orientação sexual inválida.'

    if 'data_nascimento' in data and data['data_nascimento']:
        try:
            datetime.strptime(data['data_nascimento'], '%Y-%m-%d')
        except ValueError:
            logger.warning(f'Data de nascimento inválida: {data.get("data_nascimento")}')
            errors['data_nascimento'] = 'Formato de data de nascimento inválido. Use YYYY-MM-DD.'
            
    if errors:
        logger.warning(f'Validação de usuário falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de usuário concluída sem erros')
    return errors

def validate_telefone_data(data, is_update=False):
    logger.debug(f'Validando dados de telefone. Update: {is_update}')
    errors = {}
    if not is_update:
        if 'numero_telefone' not in data or not data['numero_telefone']:
            logger.warning('Número de telefone obrigatório ausente')
            errors['numero_telefone'] = 'Número de telefone é obrigatório.'
    
    if 'numero_telefone' in data and data['numero_telefone']:
        if not validate_telefone(data['numero_telefone']):
            errors['numero_telefone'] = 'Número de telefone inválido.'
    
    if 'tipo_telefone' in data and data['tipo_telefone'] not in ['CELULAR', 'RESIDENCIAL', 'COMERCIAL', 'OUTRO', None, '']:
        logger.warning(f'Tipo de telefone inválido: {data.get("tipo_telefone")}')
        errors['tipo_telefone'] = 'Tipo de telefone inválido.'

    if errors:
        logger.warning(f'Validação de telefone falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de telefone concluída sem erros')
    return errors

def validate_endereco_data(data, is_update=False):
    logger.debug(f'Validando dados de endereço. Update: {is_update}')
    errors = {}
    required_fields_endereco = ['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep']
    if not is_update:
        for field in required_fields_endereco:
            if field not in data or not data[field]:
                logger.warning(f'Campo de endereço obrigatório ausente: {field}')
                errors[field] = f'O campo de endereço {field} é obrigatório.'
    
    if 'cep' in data and data['cep']:
        cep_limpo = re.sub(r'[^0-9]', '', data['cep'])
        if len(cep_limpo) != 8:
            logger.warning(f'CEP inválido: {data.get("cep")}')
            errors['cep'] = 'CEP deve conter 8 dígitos.'
            
    if 'estado' in data and data['estado'] and len(data['estado']) != 2:
        logger.warning(f'Estado (UF) inválido: {data.get("estado")}')
        errors['estado'] = 'Estado (UF) deve ter 2 caracteres.'

    if 'tipo_endereco' in data and data['tipo_endereco'] not in ['RESIDENCIAL', 'COMERCIAL', 'ATENDIMENTO', 'OUTRO', None, '']:
        logger.warning(f'Tipo de endereço inválido: {data.get("tipo_endereco")}')
        errors['tipo_endereco'] = 'Tipo de endereço inválido.'

    if errors:
        logger.warning(f'Validação de endereço falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de endereço concluída sem erros')
    return errors

def validate_atendente_detalhes_data(data, is_update=False):
    """Valida os dados de atendente_detalhes."""
    logger.debug(f'Validando dados profissionais de atendente. Update: {is_update}')
    errors = {}
    required_fields = ['area_atuacao', 'qualificacao_descricao', 'duracao_padrao_atendimento_min']
    
    if not is_update:
        for field in required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == "":
                logger.warning(f'Campo profissional obrigatório ausente: {field}')
                errors[field] = f'O campo {field} é obrigatório para atendentes.'
    
    allowed_areas = ['SAUDE', 'JURIDICO', 'CARREIRA', 'CONTABIL', 'ASSISTENCIA_SOCIAL']
    if 'area_atuacao' in data and data['area_atuacao'] not in allowed_areas:
        logger.warning(f'Área de atuação inválida: {data.get("area_atuacao")}')
        errors['area_atuacao'] = f'Área de atuação inválida. Permitidas: {", ".join(allowed_areas)}'

    if 'anos_experiencia' in data and data['anos_experiencia'] is not None:
        try:
            if int(data['anos_experiencia']) < 0:
                logger.warning(f'Anos de experiência inválido: {data.get("anos_experiencia")}')
                errors['anos_experiencia'] = 'Anos de experiência não podem ser negativos.'
        except ValueError:
            logger.warning(f'Anos de experiência não numérico: {data.get("anos_experiencia")}')
            errors['anos_experiencia'] = 'Anos de experiência deve ser um número.'
            
    if 'duracao_padrao_atendimento_min' in data and data['duracao_padrao_atendimento_min'] is not None:
        try:
            if int(data['duracao_padrao_atendimento_min']) <= 0:
                logger.warning(f'Duração padrão inválida: {data.get("duracao_padrao_atendimento_min")}')
                errors['duracao_padrao_atendimento_min'] = 'Duração padrão do atendimento deve ser positiva.'
        except ValueError:
            logger.warning(f'Duração padrão não numérica: {data.get("duracao_padrao_atendimento_min")}')
            errors['duracao_padrao_atendimento_min'] = 'Duração padrão do atendimento deve ser um número.'

    if 'curriculo_link' in data and data['curriculo_link']:
        if not re.match(r'^https?://', data['curriculo_link']):
            logger.warning(f'Link do currículo inválido: {data.get("curriculo_link")}')
            errors['curriculo_link'] = 'Link do currículo parece inválido.'

    if errors:
        logger.warning(f'Validação de dados profissionais falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de dados profissionais concluída sem erros')
    return errors

def validate_agendamento_data(data, is_update=False):
    """Valida os dados do agendamento."""
    logger.debug(f'Validando dados de agendamento. Update: {is_update}')
    errors = {}
    
    required_fields = ['id_cliente', 'id_atendente', 'data_hora_inicio', 'duracao_minutos', 'modalidade']
    if not is_update:
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.warning(f'Campo de agendamento obrigatório ausente: {field}')
                errors[field] = f'O campo {field} é obrigatório.'
    
    if 'data_hora_inicio' in data and data['data_hora_inicio']:
        try:
            agendamento_dt = datetime.fromisoformat(data['data_hora_inicio'])
            if not is_update and agendamento_dt < datetime.now():
                logger.warning(f'Data de agendamento no passado: {data.get("data_hora_inicio")}')
                errors['data_hora_inicio'] = 'Não é possível agendar no passado.'
        except ValueError:
            logger.warning(f'Formato de data/hora inválido: {data.get("data_hora_inicio")}')
            errors['data_hora_inicio'] = 'Formato de data e hora inválido. Use YYYY-MM-DDTHH:MM:SS'
    
    if 'duracao_minutos' in data and data['duracao_minutos'] is not None:
        try:
            if int(data['duracao_minutos']) <= 0:
                logger.warning(f'Duração inválida: {data.get("duracao_minutos")}')
                errors['duracao_minutos'] = 'Duração deve ser positiva.'
        except ValueError:
            logger.warning(f'Duração não numérica: {data.get("duracao_minutos")}')
            errors['duracao_minutos'] = 'Duração deve ser um número.'
            
    if 'modalidade' in data and data['modalidade'] not in ['ONLINE', 'PRESENCIAL']:
        logger.warning(f'Modalidade inválida: {data.get("modalidade")}')
        errors['modalidade'] = 'Modalidade inválida (ONLINE ou PRESENCIAL).'

    if errors:
        logger.warning(f'Validação de agendamento falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de agendamento concluída sem erros')
    return errors

def validate_avaliacao_data(data):
    """Valida os dados da avaliação."""
    logger.debug('Validando dados de avaliação')
    errors = {}
    
    required_fields = ['id_agendamento', 'id_avaliador', 'id_avaliado', 'nota']
    for field in ['id_agendamento', 'nota']:
        if field not in data or data[field] is None:
            logger.warning(f'Campo de avaliação obrigatório ausente: {field}')
            errors[field] = f'O campo {field} é obrigatório.'
    
    if 'nota' in data and data['nota'] is not None:
        try:
            nota = int(data['nota'])
            if not (1 <= nota <= 5):
                logger.warning(f'Nota fora do intervalo permitido: {nota}')
                errors['nota'] = 'A nota deve estar entre 1 e 5.'
        except ValueError:
            logger.warning(f'Nota não numérica: {data.get("nota")}')
            errors['nota'] = 'A nota deve ser um número inteiro.'

    if errors:
        logger.warning(f'Validação de avaliação falhou com {len(errors)} erros')
    else:
        logger.debug('Validação de avaliação concluída sem erros')
    return errors