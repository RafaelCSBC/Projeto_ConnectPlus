import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from config import Config
from utils.db import execute_query
from utils.logger import setup_logger


logger = setup_logger(__name__)

def hash_password(password):
    """Cria um hash da senha fornecida."""
    logger.debug('Iniciando hash de senha')
    try:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        logger.debug('Hash de senha criado com sucesso')
        return hashed
    except Exception as e:
        logger.error(f'Erro ao criar hash de senha: {str(e)}')
        raise

def check_password(password, hashed_password):
    """Verifica se a senha corresponde ao hash armazenado."""
    logger.debug('Verificando senha')
    try:
        result = bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        logger.debug('Verificação de senha concluída')
        return result
    except Exception as e:
        logger.error(f'Erro ao verificar senha: {str(e)}')
        return False

def generate_token(user_id, tipo_usuario):
    """Gera um token JWT para o usuário."""
    logger.debug(f'Gerando token JWT para usuário {user_id} do tipo {tipo_usuario}')
    try:
        payload = {
            'user_id': user_id,
            'tipo_usuario': tipo_usuario,
            'exp': datetime.utcnow() + timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)
        }
        token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
        logger.info(f'Token JWT gerado com sucesso para usuário {user_id}')
        return token
    except Exception as e:
        logger.error(f'Erro ao gerar token JWT: {str(e)}')
        raise

def decode_token(token):
    """Decodifica um token JWT."""
    logger.debug('Tentando decodificar token JWT')
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        logger.debug(f'Token JWT decodificado com sucesso para usuário {payload.get("user_id")}')
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning('Token JWT expirado')
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f'Token JWT inválido: {str(e)}')
        return None
    except Exception as e:
        logger.error(f'Erro ao decodificar token JWT: {str(e)}')
        return None

def token_required(f):
    """Decorador para verificar se o token JWT é válido."""
    @wraps(f)
    def decorated(*args, **kwargs):
        logger.debug('Verificando token de autenticação')
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            logger.warning('Tentativa de acesso sem token de autenticação')
            return jsonify({'message': 'Token de autenticação não fornecido!'}), 401
        
        payload = decode_token(token)
        if not payload:
            logger.warning('Tentativa de acesso com token inválido ou expirado')
            return jsonify({'message': 'Token inválido ou expirado!'}), 401
        
        logger.debug(f'Buscando dados do usuário {payload["user_id"]}')
        user_data = execute_query(
            "SELECT id_usuario, nome_completo, email, tipo_usuario, situacao FROM usuario WHERE id_usuario = %s",
            (payload['user_id'],),
            fetch_all=False
        )
        
        if not user_data:
            logger.warning(f'Usuário {payload["user_id"]} do token não encontrado no banco')
            return jsonify({'message': 'Usuário do token não encontrado!'}), 401
        
        if user_data['tipo_usuario'] != 'ADMIN' and user_data['situacao'] != 'ATIVO':
            if user_data['situacao'] == 'PENDENTE_APROVACAO':
                logger.info(f'Usuário {user_data["id_usuario"]} pendente de aprovação tentando acessar')
                pass
            elif user_data['situacao'] == 'BLOQUEADO':
                logger.warning(f'Usuário bloqueado {user_data["id_usuario"]} tentando acessar')
                return jsonify({'message': 'Sua conta está bloqueada.'}), 403
            elif user_data['situacao'] == 'INATIVO':
                logger.warning(f'Usuário inativo {user_data["id_usuario"]} tentando acessar')
                return jsonify({'message': 'Sua conta está inativa.'}), 403

        logger.debug(f'Usuário {user_data["id_usuario"]} autenticado com sucesso')
        request.current_user = user_data
        return f(*args, **kwargs)
    
    return decorated

def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        logger.debug('Verificando permissão de administrador')
        if not request.current_user or request.current_user['tipo_usuario'] != 'ADMIN':
            logger.warning(f'Usuário {request.current_user["id_usuario"]} tentou acessar rota de admin sem permissão')
            return jsonify({'message': 'Acesso restrito a administradores!'}), 403
        logger.debug(f'Admin {request.current_user["id_usuario"]} autorizado')
        return f(*args, **kwargs)
    return decorated

def atendente_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        logger.debug('Verificando permissão de atendente')
        if not request.current_user or request.current_user['tipo_usuario'] != 'ATENDENTE':
            logger.warning(f'Usuário {request.current_user["id_usuario"]} tentou acessar rota de atendente sem permissão')
            return jsonify({'message': 'Acesso restrito a atendentes!'}), 403
        
        if request.current_user['situacao'] != 'ATIVO':
            logger.info(f'Atendente {request.current_user["id_usuario"]} não ativo tentando acessar')
            pass
            
        logger.debug(f'Atendente {request.current_user["id_usuario"]} autorizado')
        return f(*args, **kwargs)
    return decorated

def cliente_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        logger.debug('Verificando permissão de cliente')
        if not request.current_user or request.current_user['tipo_usuario'] != 'CLIENTE':
            logger.warning(f'Usuário {request.current_user["id_usuario"]} tentou acessar rota de cliente sem permissão')
            return jsonify({'message': 'Acesso restrito a clientes!'}), 403
        if request.current_user['situacao'] != 'ATIVO':
            logger.warning(f'Cliente {request.current_user["id_usuario"]} não ativo tentando acessar')
            return jsonify({'message': 'Sua conta não está ativa.'}), 403
        logger.debug(f'Cliente {request.current_user["id_usuario"]} autorizado')
        return f(*args, **kwargs)
    return decorated