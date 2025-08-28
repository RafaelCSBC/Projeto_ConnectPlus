from flask import Blueprint, request, jsonify
from utils.db import execute_query, get_connection
from utils.auth import token_required, admin_required, atendente_required
from utils.validators import validate_atendente_detalhes_data
from datetime import datetime, timedelta

atendentes_bp = Blueprint('atendentes', __name__)

@atendentes_bp.route('', methods=['GET'])
def get_atendentes_publico():
    situacao_filtro = request.args.get('situacao', 'ATIVO')
    area_filtro = request.args.get('area_atuacao')
    busca_filtro = request.args.get('busca')


    query = """
        SELECT
            u.id_usuario, u.nome_completo, u.nome_social, u.email, u.identidade_genero,
            ad.area_atuacao, ad.qualificacao_descricao, ad.especialidades,
            ad.registro_profissional, ad.anos_experiencia, ad.curriculo_link,
            ad.aceita_atendimento_online, ad.aceita_atendimento_presencial,
            ad.duracao_padrao_atendimento_min,
            (SELECT ROUND(AVG(aval.nota), 1) FROM avaliacao aval
             JOIN agendamento ag_aval ON aval.id_agendamento = ag_aval.id_agendamento
             WHERE ag_aval.id_atendente = u.id_usuario AND ag_aval.status_agendamento = 'REALIZADO') AS media_avaliacoes,
            (SELECT COUNT(aval.id_avaliacao) FROM avaliacao aval
             JOIN agendamento ag_aval ON aval.id_agendamento = ag_aval.id_agendamento
             WHERE ag_aval.id_atendente = u.id_usuario AND ag_aval.status_agendamento = 'REALIZADO') AS total_avaliacoes,
            u.data_criacao AS data_criacao_usuario, u.situacao AS situacao_usuario

        FROM usuario u
        JOIN atendente_detalhes ad ON u.id_usuario = ad.id_usuario
        WHERE u.tipo_usuario = 'ATENDENTE'
    """
    params = []

    if situacao_filtro and situacao_filtro != 'TODOS':
        query += " AND u.situacao = %s"
        params.append(situacao_filtro)

    if area_filtro and area_filtro != 'TODAS':
        query += " AND ad.area_atuacao = %s"
        params.append(area_filtro)

    if busca_filtro:
        term = f"%{busca_filtro}%"
        query += " AND (u.nome_completo LIKE %s OR u.nome_social LIKE %s OR ad.qualificacao_descricao LIKE %s OR ad.especialidades LIKE %s)"
        params.extend([term, term, term, term])

    query += " ORDER BY media_avaliacoes DESC, u.nome_completo ASC"

    limite = request.args.get('limite')
    if limite:
        try:
            query += " LIMIT %s"
            params.append(int(limite))
        except ValueError:
            pass

    atendentes = execute_query(query, tuple(params))
    return jsonify({'atendentes': atendentes}), 200


@atendentes_bp.route('/<int:atendente_id>/perfil', methods=['GET'])
@token_required
def get_perfil_atendente(atendente_id):

    connection = get_connection()
    try:
        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT id_usuario, nome_completo, nome_social, email, data_nascimento,
                       identidade_genero, orientacao_sexual, pronomes, situacao
                FROM usuario WHERE id_usuario = %s AND tipo_usuario = 'ATENDENTE'
            """, (atendente_id,))
            usuario_info = cursor.fetchone()

            if not usuario_info:
                return jsonify({'message': 'Perfil de atendente não encontrado.'}), 404

            cursor.execute("""
                SELECT area_atuacao, qualificacao_descricao, especialidades, registro_profissional,
                       anos_experiencia, curriculo_link, aceita_atendimento_online,
                       aceita_atendimento_presencial, duracao_padrao_atendimento_min
                FROM atendente_detalhes WHERE id_usuario = %s
            """, (atendente_id,))
            detalhes_atendente = cursor.fetchone()

            telefones_info = []
            enderecos_info = []
            if request.current_user and (request.current_user['id_usuario'] == atendente_id or request.current_user['tipo_usuario'] == 'ADMIN'):
                cursor.execute("SELECT numero_telefone, tipo_telefone, is_principal FROM telefone WHERE id_usuario = %s", (atendente_id,))
                telefones_info = cursor.fetchall()
                cursor.execute("SELECT logradouro, numero, complemento, bairro, cidade, estado, cep, tipo_endereco, is_principal FROM endereco WHERE id_usuario = %s", (atendente_id,))
                enderecos_info = cursor.fetchall()


            return jsonify({
                'usuario': usuario_info,
                'detalhes': detalhes_atendente or {},
                'telefones': telefones_info,
                'enderecos': enderecos_info
            }), 200
    finally:
        if connection: connection.close()


@atendentes_bp.route('/<int:atendente_id>/perfil', methods=['PUT'])
@atendente_required
def update_perfil_atendente(atendente_id):
    if request.current_user['id_usuario'] != atendente_id:
        return jsonify({'message': 'Você só pode editar seu próprio perfil profissional.'}), 403


    data = request.json
    usuario_data = data.get('usuario', {})
    detalhes_data = data.get('detalhes', {})
    connection = None

    try:
        connection = get_connection()
        connection.begin()
        with connection.cursor() as cursor:
            user_errors = validate_user_data(usuario_data, is_update=True)
            if user_errors:
                connection.rollback()
                return jsonify({'message': 'Dados pessoais inválidos.', 'errors': user_errors}), 400

            allowed_user_fields = ['nome_completo', 'nome_social', 'data_nascimento', 'identidade_genero', 'orientacao_sexual', 'pronomes']
            user_update_payload = {k: v for k, v in usuario_data.items() if k in allowed_user_fields and v is not None}
            if user_update_payload:
                set_clauses = ", ".join([f"{key} = %s" for key in user_update_payload])
                sql_update_user = f"UPDATE usuario SET {set_clauses} WHERE id_usuario = %s"
                params_user = list(user_update_payload.values()) + [atendente_id]
                cursor.execute(sql_update_user, params_user)

            tel_principal_num = usuario_data.get('telefone_principal')
            if tel_principal_num:
                tel_payload = {'numero_telefone': tel_principal_num.replace("\D", "")}
                tel_errors = validate_telefone_data(tel_payload, is_update=True)
                if tel_errors: connection.rollback(); return jsonify({'message': 'Dados de telefone inválidos.', 'errors': tel_errors}), 400

                cursor.execute("UPDATE telefone SET is_principal = FALSE WHERE id_usuario = %s", (atendente_id,))
                cursor.execute("SELECT id_telefone FROM telefone WHERE id_usuario = %s AND numero_telefone = %s", (atendente_id, tel_payload['numero_telefone']))
                tel_existente = cursor.fetchone()
                if tel_existente:
                    cursor.execute("UPDATE telefone SET is_principal = TRUE WHERE id_telefone = %s", (tel_existente['id_telefone'],))
                else:
                    cursor.execute("INSERT INTO telefone (id_usuario, numero_telefone, tipo_telefone, is_principal) VALUES (%s, %s, %s, %s)",
                                   (atendente_id, tel_payload['numero_telefone'], 'CELULAR', True))


            at_det_errors = validate_atendente_detalhes_data(detalhes_data, is_update=True)
            if at_det_errors:
                connection.rollback()
                return jsonify({'message': 'Dados profissionais inválidos.', 'errors': at_det_errors}), 400

            allowed_details_fields = [
                'area_atuacao', 'qualificacao_descricao', 'especialidades', 'registro_profissional',
                'anos_experiencia', 'curriculo_link', 'aceita_atendimento_online',
                'aceita_atendimento_presencial', 'duracao_padrao_atendimento_min'
            ]
            details_update_payload = {k: v for k, v in detalhes_data.items() if k in allowed_details_fields}
            if details_update_payload:
                set_clauses_details = ", ".join([f"{key} = %s" for key in details_update_payload])
                sql_update_details = f"UPDATE atendente_detalhes SET {set_clauses_details} WHERE id_usuario = %s"
                params_details = list(details_update_payload.values()) + [atendente_id]

                cursor.execute("SELECT id_usuario FROM atendente_detalhes WHERE id_usuario = %s", (atendente_id,))
                if cursor.fetchone():
                    cursor.execute(sql_update_details, params_details)
                else:
                    insert_fields = ['id_usuario'] + list(details_update_payload.keys())
                    placeholders = ", ".join(["%s"] * len(insert_fields))
                    sql_insert = f"INSERT INTO atendente_detalhes ({', '.join(insert_fields)}) VALUES ({placeholders})"
                    insert_params = [atendente_id] + list(details_update_payload.values())
                    cursor.execute(sql_insert, insert_params)

            connection.commit()
            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (atendente_id,))
            usuario_atualizado_nome = cursor.fetchone()
            return jsonify({'message': 'Perfil profissional atualizado com sucesso!', 'usuario_atualizado': usuario_atualizado_nome}), 200

    except Exception as e:
        if connection: connection.rollback()
        print(f"Erro ao atualizar perfil do atendente: {e}")
        return jsonify({'message': f'Erro interno ao atualizar perfil. {str(e)}'}), 500
    finally:
        if connection: connection.close()


@atendentes_bp.route('/<int:id_atendente>/aprovar', methods=['POST'])
@admin_required
def aprovar_atendente_admin(id_atendente):
    data = request.json
    motivo = data.get('motivo', 'Aprovado pelo administrador.')
    id_admin_responsavel = request.current_user['id_usuario']
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT situacao FROM usuario WHERE id_usuario = %s AND tipo_usuario = 'ATENDENTE'", (id_atendente,))
            atendente = cursor.fetchone()
            if not atendente:
                return jsonify({'message': 'Atendente não encontrado.'}), 404
            if atendente['situacao'] != 'PENDENTE_APROVACAO':
                return jsonify({'message': f'Este atendente já está {atendente["situacao"]}.'}), 400

            cursor.execute("UPDATE usuario SET situacao = 'ATIVO' WHERE id_usuario = %s", (id_atendente,))

            cursor.execute("""
                INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, id_admin_responsavel, motivo)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_atendente, 'PENDENTE_APROVACAO', 'ATIVO', id_admin_responsavel, motivo))

            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
                VALUES (%s, %s, %s, %s)
            """, (id_atendente, 'Cadastro Aprovado!', 'Seu cadastro como atendente foi aprovado.', 'ATENDENTE_CADASTRO_APROVADO'))

            connection.commit()
        return jsonify({'message': 'Atendente aprovado com sucesso!'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao aprovar atendente: {str(e)}'}), 500
    finally:
        if connection: connection.close()

@atendentes_bp.route('/<int:id_atendente>/bloquear', methods=['POST'])
@admin_required
def bloquear_atendente_admin(id_atendente):
    data = request.json
    motivo = data.get('motivo')
    if not motivo:
        return jsonify({'message': 'Motivo é obrigatório para bloquear/reprovar.'}), 400
    id_admin_responsavel = request.current_user['id_usuario']
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT situacao FROM usuario WHERE id_usuario = %s AND tipo_usuario = 'ATENDENTE'", (id_atendente,))
            atendente = cursor.fetchone()
            if not atendente: return jsonify({'message': 'Atendente não encontrado.'}), 404

            status_anterior = atendente['situacao']
            if status_anterior == 'BLOQUEADO':
                 return jsonify({'message': 'Este atendente já está bloqueado.'}), 400

            cursor.execute("UPDATE usuario SET situacao = 'BLOQUEADO' WHERE id_usuario = %s", (id_atendente,))
            cursor.execute("""
                INSERT INTO usuario_status_log (id_usuario_afetado, status_anterior, novo_status, id_admin_responsavel, motivo)
                VALUES (%s, %s, %s, %s, %s)
            """, (id_atendente, status_anterior, 'BLOQUEADO', id_admin_responsavel, motivo))

            tipo_notificacao_msg = 'Seu cadastro de atendente foi reprovado.' if status_anterior == 'PENDENTE_APROVACAO' else 'Sua conta de atendente foi bloqueada.'
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
                VALUES (%s, %s, %s, %s)
            """, (id_atendente, 'Aviso sobre sua Conta', f'{tipo_notificacao_msg} Motivo: {motivo}', 'ATENDENTE_CADASTRO_REPROVADO'))

            connection.commit()
        return jsonify({'message': f'Atendente { "reprovado" if status_anterior == "PENDENTE_APROVACAO" else "bloqueado"} com sucesso!'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao processar atendente: {str(e)}'}), 500
    finally:
        if connection: connection.close()


@atendentes_bp.route('/<int:id_atendente>/avaliacoes', methods=['GET'])
@token_required
def get_avaliacoes_do_atendente(id_atendente):
    if request.current_user['tipo_usuario'] == 'ATENDENTE' and request.current_user['id_usuario'] != id_atendente:
        return jsonify({'message': 'Você só pode ver suas próprias avaliações.'}), 403

    if request.current_user['tipo_usuario'] not in ['ADMIN', 'ATENDENTE']:
         return jsonify({'message': 'Acesso negado.'}), 403


    query_avaliacoes = """
        SELECT
            av.id_avaliacao, av.nota, av.comentario, av.anonima, av.data_avaliacao,
            ag.data_hora_inicio AS data_agendamento_avaliado,
            CASE WHEN av.anonima = FALSE THEN cli.nome_completo ELSE NULL END AS nome_avaliador
        FROM avaliacao av
        JOIN agendamento ag ON av.id_agendamento = ag.id_agendamento
        LEFT JOIN usuario cli ON av.id_avaliador = cli.id_usuario AND cli.tipo_usuario = 'CLIENTE'
        WHERE ag.id_atendente = %s AND ag.status_agendamento = 'REALIZADO'
        ORDER BY av.data_avaliacao DESC
    """
    avaliacoes = execute_query(query_avaliacoes, (id_atendente,))

    query_stats = """
        SELECT
            ROUND(AVG(av.nota), 2) AS media_geral,
            COUNT(av.id_avaliacao) AS total_avaliacoes
        FROM avaliacao av
        JOIN agendamento ag ON av.id_agendamento = ag.id_agendamento
        WHERE ag.id_atendente = %s AND ag.status_agendamento = 'REALIZADO'
    """
    stats = execute_query(query_stats, (id_atendente,), fetch_all=False)

    return jsonify({
        'media_geral': float(stats['media_geral']) if stats and stats['media_geral'] is not None else 0.0,
        'total_avaliacoes': stats['total_avaliacoes'] if stats else 0,
        'avaliacoes': avaliacoes
    }), 200


@atendentes_bp.route('/<int:id_atendente>/agendamentos', methods=['GET'])
@token_required
def get_agendamentos_atendente(id_atendente):
    if request.current_user['tipo_usuario'] == 'ATENDENTE' and request.current_user['id_usuario'] != id_atendente:
        return jsonify({'message': 'Você só pode ver seus próprios agendamentos.'}), 403

    status_filtro = request.args.get('status')

    query = """
        SELECT
            ag.id_agendamento, ag.data_hora_inicio, ag.duracao_minutos, ag.modalidade, ag.status_agendamento,
            ag.assunto_solicitacao, ag.link_atendimento_online, ag.observacoes_atendente,
            cli.nome_completo AS nome_cliente, cli.id_usuario AS id_cliente,
            att.nome_completo AS nome_atendente, att.id_usuario AS id_atendente,
            ad.area_atuacao AS area_atendente
        FROM agendamento ag
        JOIN usuario cli ON ag.id_cliente = cli.id_usuario
        JOIN usuario att ON ag.id_atendente = att.id_usuario
        JOIN atendente_detalhes ad ON att.id_usuario = ad.id_usuario
        WHERE ag.id_atendente = %s
    """
    params = [id_atendente]

    if status_filtro:
        query += " AND ag.status_agendamento = %s"
        params.append(status_filtro)

    query += " ORDER BY ag.data_hora_inicio DESC"

    agendamentos = execute_query(query, tuple(params))
    return jsonify({'agendamentos': agendamentos}), 200


@atendentes_bp.route('/<int:id_atendente>/disponibilidade', methods=['GET'])
def get_disponibilidade_atendente_api(id_atendente):
    data_str = request.args.get('data')

    if not data_str:
        return jsonify({'message': 'Parâmetro data (YYYY-MM-DD) é obrigatório.'}), 400
    try:
        data_obj = datetime.strptime(data_str, '%Y-%m-%d').date()
        if data_obj < datetime.now().date():
             return jsonify({'horarios_disponiveis': [], 'message': 'Não é possível ver disponibilidade para datas passadas.'}), 200

    except ValueError:
        return jsonify({'message': 'Formato de data inválido. Use YYYY-MM-DD.'}), 400

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT duracao_padrao_atendimento_min FROM atendente_detalhes WHERE id_usuario = %s", (id_atendente,))
            at_det = cursor.fetchone()
            if not at_det: return jsonify({'message': 'Atendente não encontrado ou sem detalhes.'}), 404

            duracao_padrao = at_det['duracao_padrao_atendimento_min']

            duracao_intervalo = timedelta(minutes=duracao_padrao or 60)


            cursor.execute("""
                SELECT data_hora_inicio, duracao_minutos
                FROM agendamento
                WHERE id_atendente = %s AND DATE(data_hora_inicio) = %s
                      AND status_agendamento IN ('CONFIRMADO', 'SOLICITADO')
            """, (id_atendente, data_str))
            agendamentos_existentes = cursor.fetchall()

            slots_ocupados = []
            for ag in agendamentos_existentes:
                inicio = ag['data_hora_inicio']
                fim_ocupado = inicio + timedelta(minutes=ag['duracao_minutos'])
                slots_ocupados.append((inicio, fim_ocupado))

            horarios_trabalho = [
                (datetime.strptime("08:00", "%H:%M").time(), datetime.strptime("12:00", "%H:%M").time()),
                (datetime.strptime("14:00", "%H:%M").time(), datetime.strptime("18:00", "%H:%M").time())
            ]

            horarios_disponiveis_final = []

            for inicio_turno, fim_turno in horarios_trabalho:
                slot_atual = datetime.combine(data_obj, inicio_turno)
                fim_turno_dt = datetime.combine(data_obj, fim_turno)

                while slot_atual + duracao_intervalo <= fim_turno_dt:
                    if slot_atual < datetime.now() and data_obj == datetime.now().date():
                        slot_atual += duracao_intervalo
                        continue

                    slot_fim = slot_atual + duracao_intervalo
                    ocupado = False
                    for inicio_ocupado, fim_ocupado_existente in slots_ocupados:
                        if max(slot_atual, inicio_ocupado) < min(slot_fim, fim_ocupado_existente):
                            ocupado = True
                            break
                    if not ocupado:
                        horarios_disponiveis_final.append(slot_atual.strftime("%H:%M"))

                    slot_atual += duracao_intervalo

        return jsonify({'horarios_disponiveis': horarios_disponiveis_final}), 200
    finally:
        if connection: connection.close()
