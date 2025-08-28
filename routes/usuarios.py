from flask import Blueprint, request, jsonify
from utils.db import execute_query, get_connection 
from utils.auth import token_required, admin_required, hash_password, check_password
from utils.validators import validate_user_data, validate_telefone_data, validate_endereco_data

usuarios_bp = Blueprint('usuarios', __name__)

@usuarios_bp.route('/me', methods=['GET'])
@token_required
def get_meu_perfil():
    user_id = request.current_user['id_usuario']
    connection = get_connection()
    try:
        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT id_usuario, nome_completo, nome_social, cpf, email, data_nascimento, 
                    tipo_usuario, identidade_genero, orientacao_sexual, pronomes, situacao
                FROM usuario WHERE id_usuario = %s
            """, (user_id,))
            usuario_info = cursor.fetchone()

            if not usuario_info:
                return jsonify({'message': 'Usuário não encontrado.'}), 404

            cursor.execute("SELECT numero_telefone, tipo_telefone FROM telefone WHERE id_usuario = %s AND is_principal = TRUE", (user_id,))
            telefone_info = cursor.fetchone()
            if not telefone_info:
                cursor.execute("SELECT numero_telefone, tipo_telefone FROM telefone WHERE id_usuario = %s LIMIT 1", (user_id,))
                telefone_info = cursor.fetchone()


            cursor.execute("""
                SELECT logradouro, numero, complemento, bairro, cidade, estado, cep, tipo_endereco 
                FROM endereco WHERE id_usuario = %s AND is_principal = TRUE
            """, (user_id,))
            endereco_info = cursor.fetchone()
            if not endereco_info:
                cursor.execute("""
                    SELECT logradouro, numero, complemento, bairro, cidade, estado, cep, tipo_endereco 
                    FROM endereco WHERE id_usuario = %s LIMIT 1
                """, (user_id,))
                endereco_info = cursor.fetchone()


            usuario_info['telefones'] = [telefone_info] if telefone_info else []
            usuario_info['enderecos'] = [endereco_info] if endereco_info else []

            if usuario_info['tipo_usuario'] == 'ATENDENTE':
                cursor.execute("""
                    SELECT area_atuacao, qualificacao_descricao, especialidades, registro_profissional,
                        anos_experiencia, curriculo_link, aceita_atendimento_online, 
                        aceita_atendimento_presencial, duracao_padrao_atendimento_min
                    FROM atendente_detalhes WHERE id_usuario = %s
                """, (user_id,))
                detalhes_atendente = cursor.fetchone()
                usuario_info['atendente_detalhes'] = detalhes_atendente if detalhes_atendente else {}
            
            return jsonify({'message': 'Dados do perfil carregados.', 'usuario': usuario_info}), 200
    finally:
        if connection:
            connection.close()


@usuarios_bp.route('/<int:user_id>/perfil', methods=['PUT'])
@token_required
def update_meu_perfil(user_id):
    if request.current_user['tipo_usuario'] != 'ADMIN' and request.current_user['id_usuario'] != user_id:
        return jsonify({'message': 'Acesso negado para atualizar este perfil.'}), 403

    data = request.json
    connection = None

    try:
        connection = get_connection()
        connection.begin()
        with connection.cursor() as cursor:
            usuario_update_data = data.get('usuario', data)

            user_errors = validate_user_data(usuario_update_data, is_update=True)
            if user_errors:
                connection.rollback()
                return jsonify({'message': 'Dados de usuário inválidos.', 'errors': user_errors}), 400

            campos_usuario_para_atualizar = {}
            if 'nome_completo' in usuario_update_data: campos_usuario_para_atualizar['nome_completo'] = usuario_update_data['nome_completo']
            if 'nome_social' in usuario_update_data: campos_usuario_para_atualizar['nome_social'] = usuario_update_data['nome_social']
            if 'data_nascimento' in usuario_update_data: campos_usuario_para_atualizar['data_nascimento'] = usuario_update_data.get('data_nascimento')
            if 'identidade_genero' in usuario_update_data: campos_usuario_para_atualizar['identidade_genero'] = usuario_update_data.get('identidade_genero')
            if 'orientacao_sexual' in usuario_update_data: campos_usuario_para_atualizar['orientacao_sexual'] = usuario_update_data.get('orientacao_sexual')
            if 'pronomes' in usuario_update_data: campos_usuario_para_atualizar['pronomes'] = usuario_update_data.get('pronomes')

            if campos_usuario_para_atualizar:
                set_clauses_usuario = ", ".join([f"{key} = %s" for key in campos_usuario_para_atualizar])
                sql_update_usuario = f"UPDATE usuario SET {set_clauses_usuario} WHERE id_usuario = %s"
                params_usuario = list(campos_usuario_para_atualizar.values()) + [user_id]
                cursor.execute(sql_update_usuario, params_usuario)

            tel_principal_num = usuario_update_data.get('telefone_principal') or usuario_update_data.get('telefone_numero')

            if tel_principal_num:
                tel_payload = {'numero_telefone': tel_principal_num.replace("\D", "")}
                tel_errors = validate_telefone_data(tel_payload, is_update=True)
                if tel_errors:
                    connection.rollback()
                    return jsonify({'message': 'Dados de telefone inválidos.', 'errors': tel_errors}), 400
                
                cursor.execute("SELECT id_telefone FROM telefone WHERE id_usuario = %s AND is_principal = TRUE", (user_id,))
                tel_existente = cursor.fetchone()
                if tel_existente:
                    cursor.execute("UPDATE telefone SET numero_telefone = %s WHERE id_telefone = %s", (tel_payload['numero_telefone'], tel_existente['id_telefone']))
                else:
                    cursor.execute("SELECT id_telefone FROM telefone WHERE id_usuario = %s LIMIT 1", (user_id,))
                    tel_qualquer = cursor.fetchone()
                    if tel_qualquer:
                        cursor.execute("UPDATE telefone SET numero_telefone = %s, is_principal = TRUE WHERE id_telefone = %s", (tel_payload['numero_telefone'], tel_qualquer['id_telefone']))
                    else:
                        cursor.execute("INSERT INTO telefone (id_usuario, numero_telefone, tipo_telefone, is_principal) VALUES (%s, %s, %s, %s)",
                                    (user_id, tel_payload['numero_telefone'], 'CELULAR', True))
            
            cep_principal_num = usuario_update_data.get('cep_principal')
            if cep_principal_num:
                cursor.execute("UPDATE endereco SET cep = %s WHERE id_usuario = %s AND is_principal = TRUE", (cep_principal_num.replace("\D", ""), user_id))


            if request.current_user['tipo_usuario'] == 'ATENDENTE' and 'detalhes' in data:
                detalhes_data = data['detalhes']
                at_det_errors = validate_atendente_detalhes_data(detalhes_data, is_update=True)
                if at_det_errors:
                    connection.rollback()
                    return jsonify({'message': 'Dados profissionais do atendente inválidos.', 'errors': at_det_errors}), 400

                campos_detalhes_para_atualizar = {}
                allowed_detalhes_fields = [
                    'area_atuacao', 'qualificacao_descricao', 'especialidades', 
                    'registro_profissional', 'anos_experiencia', 'curriculo_link',
                    'aceita_atendimento_online', 'aceita_atendimento_presencial', 
                    'duracao_padrao_atendimento_min'
                ]
                for field in allowed_detalhes_fields:
                    if field in detalhes_data:
                        campos_detalhes_para_atualizar[field] = detalhes_data[field]
                
                if campos_detalhes_para_atualizar:
                    set_clauses_detalhes = ", ".join([f"{key} = %s" for key in campos_detalhes_para_atualizar])
                    sql_update_detalhes = f"UPDATE atendente_detalhes SET {set_clauses_detalhes} WHERE id_usuario = %s"
                    params_detalhes = list(campos_detalhes_para_atualizar.values()) + [user_id]
                    
                    cursor.execute("SELECT id_usuario FROM atendente_detalhes WHERE id_usuario = %s", (user_id,))
                    if cursor.fetchone():
                        cursor.execute(sql_update_detalhes, params_detalhes)
                    else:
                        insert_fields = list(campos_detalhes_para_atualizar.keys())
                        insert_values_placeholders = ", ".join(["%s"] * len(insert_fields))
                        sql_insert_detalhes = f"INSERT INTO atendente_detalhes (id_usuario, {', '.join(insert_fields)}) VALUES (%s, {insert_values_placeholders})"
                        insert_params = [user_id] + list(campos_detalhes_para_atualizar.values())
                        cursor.execute(sql_insert_detalhes, insert_params)

            connection.commit()
            
            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (user_id,))
            usuario_atualizado = cursor.fetchone()

            return jsonify({'message': 'Perfil atualizado com sucesso!', 'usuario_atualizado': usuario_atualizado}), 200

    except Exception as e:
        if connection:
            connection.rollback()
        print(f"Erro ao atualizar perfil: {e}")
        return jsonify({'message': f'Erro interno ao atualizar perfil. {str(e)}'}), 500
    finally:
        if connection:
            connection.close()

@usuarios_bp.route('/<int:user_id>/alterar-senha', methods=['POST'])
@token_required
def alterar_senha_usuario(user_id):
    if request.current_user['id_usuario'] != user_id and request.current_user['tipo_usuario'] != 'ADMIN':
        return jsonify({'message': 'Acesso negado.'}), 403

    data = request.json
    senha_atual = data.get('senha_atual')
    nova_senha = data.get('nova_senha')

    if not senha_atual or not nova_senha:
        return jsonify({'message': 'Senha atual e nova senha são obrigatórias.'}), 400
    
    if not validate_senha(nova_senha):
        return jsonify({'message': 'Nova senha inválida. Verifique os requisitos.'}), 400

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT senha FROM usuario WHERE id_usuario = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return jsonify({'message': 'Usuário não encontrado.'}), 404
            
            if not check_password(senha_atual, user['senha']):
                return jsonify({'message': 'Senha atual incorreta.'}), 403
            
            hashed_nova_senha = hash_password(nova_senha)
            cursor.execute("UPDATE usuario SET senha = %s WHERE id_usuario = %s", (hashed_nova_senha, user_id))
            connection.commit()
            return jsonify({'message': 'Senha alterada com sucesso!'}), 200
    except Exception as e:
        if connection: connection.rollback()
        print(f"Erro ao alterar senha: {e}")
        return jsonify({'message': 'Erro interno ao alterar senha.'}), 500
    finally:
        if connection: connection.close()


@usuarios_bp.route('', methods=['GET'])
@admin_required
def get_todos_usuarios():
    tipo_usuario_filtro = request.args.get('tipo')
    situacao_filtro = request.args.get('situacao')
    busca_filtro = request.args.get('busca')

    query = "SELECT id_usuario, nome_completo, email, cpf, tipo_usuario, situacao, data_criacao FROM usuario WHERE 1=1"
    params = []

    if tipo_usuario_filtro:
        query += " AND tipo_usuario = %s"
        params.append(tipo_usuario_filtro)
    if situacao_filtro:
        query += " AND situacao = %s"
        params.append(situacao_filtro)
    if busca_filtro:
        query += " AND (nome_completo LIKE %s OR email LIKE %s OR cpf LIKE %s)"
        term = f"%{busca_filtro}%"
        params.extend([term, term, term])
    
    query += " ORDER BY data_criacao DESC"
    
    usuarios = execute_query(query, tuple(params))
    return jsonify({'usuarios': usuarios}), 200

@usuarios_bp.route('/<int:user_id>', methods=['GET'])
@admin_required
def get_usuario_especifico_admin(user_id):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id_usuario, nome_completo, nome_social, cpf, email, data_nascimento, 
                    tipo_usuario, identidade_genero, orientacao_sexual, pronomes, situacao
                FROM usuario WHERE id_usuario = %s
            """, (user_id,))
            usuario_info = cursor.fetchone()
            if not usuario_info:
                return jsonify({'message': 'Usuário não encontrado.'}), 404
            return jsonify({'usuario': usuario_info}), 200
    finally:
        if connection: connection.close()


@usuarios_bp.route('/<int:user_id>/notificacoes', methods=['GET'])
@token_required
def get_minhas_notificacoes(user_id):
    if request.current_user['id_usuario'] != user_id and request.current_user['tipo_usuario'] != 'ADMIN':
        return jsonify({'message': 'Acesso negado.'}), 403
    
    query = "SELECT id_notificacao, titulo, mensagem, tipo_notificacao, lida, data_criacao, link_referencia FROM notificacao WHERE id_usuario_destino = %s ORDER BY data_criacao DESC"
    notificacoes = execute_query(query, (user_id,))
    return jsonify({'notificacoes': notificacoes}), 200

@usuarios_bp.route('/notificacoes/<int:notificacao_id>/marcar-lida', methods=['POST'])
@token_required
def marcar_notificacao_lida(notificacao_id):
    user_id = request.current_user['id_usuario']
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_usuario_destino FROM notificacao WHERE id_notificacao = %s", (notificacao_id,))
            notif = cursor.fetchone()
            if not notif or notif['id_usuario_destino'] != user_id:
                return jsonify({'message': 'Notificação não encontrada ou acesso negado.'}), 404
            
            cursor.execute("UPDATE notificacao SET lida = TRUE WHERE id_notificacao = %s", (notificacao_id,))
            connection.commit()
            return jsonify({'message': 'Notificação marcada como lida.'}), 200
    finally:
        if connection: connection.close()

@usuarios_bp.route('/admin/usuarios/<int:user_id>/alterar-status', methods=['PUT'])
@admin_required
def admin_alterar_status_usuario(user_id):
    data = request.json
    novo_status = data.get('novo_status')
    motivo = data.get('motivo', 'Status alterado pelo administrador.')
    id_admin_logado = request.current_user['id_usuario']

    if not novo_status or novo_status not in ['ATIVO', 'BLOQUEADO', 'INATIVO']:
        return jsonify({'message': 'Novo status inválido ou não fornecido.'}), 400
    
    if novo_status == 'BLOQUEADO' and not motivo:
        return jsonify({'message': 'Motivo é obrigatório para bloquear um usuário.'}), 400

    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT situacao, tipo_usuario FROM usuario WHERE id_usuario = %s", (user_id,))
            usuario_atual = cursor.fetchone()

            if not usuario_atual:
                return jsonify({'message': 'Usuário não encontrado.'}), 404
            
            status_anterior = usuario_atual['situacao']
            if status_anterior == novo_status:
                return jsonify({'message': f'Usuário já está {novo_status}. Nenhuma alteração feita.'}), 200

            cursor.execute("UPDATE usuario SET situacao = %s WHERE id_usuario = %s", (novo_status, user_id))
            
            cursor.execute("""
                INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, id_admin_responsavel, motivo)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, status_anterior, novo_status, id_admin_logado, motivo))
            
            titulo_notif = 'Atualização de Status da Conta'
            msg_notif = f'O status da sua conta foi alterado para {novo_status}.'
            if novo_status == 'BLOQUEADO':
                msg_notif += f' Motivo: {motivo}'
            
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
                VALUES (%s, %s, %s, %s)
            """, (user_id, titulo_notif, msg_notif, 'CONTA_STATUS_ALTERADO'))


            connection.commit()
        return jsonify({'message': f'Status do usuário {user_id} alterado para {novo_status} com sucesso.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        print(f"Erro ao alterar status do usuário {user_id}: {e}")
        return jsonify({'message': f'Erro interno ao alterar status. {str(e)}'}), 500
    finally:
        if connection: connection.close()