from flask import Blueprint, request, jsonify
from utils.db import execute_query, get_connection
from utils.auth import token_required, cliente_required, atendente_required, admin_required
from utils.validators import validate_agendamento_data, validate_avaliacao_data
from datetime import datetime, timedelta

agendamentos_bp = Blueprint('agendamentos', __name__)

@agendamentos_bp.route('', methods=['POST'])
@cliente_required
def create_agendamento_cliente():
    data = request.json
    id_cliente_logado = request.current_user['id_usuario']

    data['id_cliente'] = id_cliente_logado



    ag_errors = validate_agendamento_data(data)
    if ag_errors:
        return jsonify({'message': 'Dados de agendamento inválidos.', 'errors': ag_errors}), 400

    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_usuario FROM usuario WHERE id_usuario = %s AND tipo_usuario = 'ATENDENTE' AND situacao = 'ATIVO'", (data['id_atendente'],))
            if not cursor.fetchone():
                return jsonify({'message': 'Atendente inválido ou não disponível.'}), 404



            cursor.execute(
                "SELECT fn_verificar_disponibilidade_atendente(%s, %s, %s, NULL) AS disponivel",
                (data['id_atendente'], data['data_hora_inicio'], data['duracao_minutos'])
            )
            disponibilidade = cursor.fetchone()
            if not disponibilidade or not disponibilidade['disponivel']:
                return jsonify({'message': 'Horário indisponível para o atendente.'}), 409

            sql_insert_ag = """
                INSERT INTO agendamento (id_cliente, id_atendente, data_hora_inicio, duracao_minutos,
                                         assunto_solicitacao, modalidade, status_agendamento)
                VALUES (%s, %s, %s, %s, %s, %s, 'SOLICITADO')
            """
            cursor.execute(sql_insert_ag, (
                data['id_cliente'], data['id_atendente'], data['data_hora_inicio'], data['duracao_minutos'],
                data.get('assunto_solicitacao'), data['modalidade']
            ))
            id_agendamento_criado = cursor.lastrowid

            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (data['id_cliente'],))
            cliente_nome = cursor.fetchone()['nome_completo']
            msg_notif = f"Nova solicitação de agendamento de {cliente_nome} para {datetime.fromisoformat(data['data_hora_inicio']).strftime('%d/%m/%Y %H:%M')}."
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
                VALUES (%s, %s, %s, %s, %s)
            """, (data['id_atendente'], 'Nova Solicitação', msg_notif, 'NOVO_AGENDAMENTO_SOLICITADO', f'/atendente/solicitacoes/{id_agendamento_criado}'))

            connection.commit()

            cursor.execute("SELECT * FROM agendamento WHERE id_agendamento = %s", (id_agendamento_criado,))
            agendamento_criado_obj = cursor.fetchone()

            return jsonify({
                'message': 'Solicitação de agendamento enviada com sucesso!',
                'agendamento_criado': agendamento_criado_obj
            }), 201

    except Exception as e:
        if connection: connection.rollback()
        print(f"Erro ao criar agendamento: {e}")
        return jsonify({'message': f'Erro interno ao criar agendamento. {str(e)}'}), 500
    finally:
        if connection: connection.close()


@agendamentos_bp.route('/<int:agendamento_id>/confirmar/atendente', methods=['POST'])
@atendente_required
def confirmar_agendamento_pelo_atendente(agendamento_id):
    id_atendente_logado = request.current_user['id_usuario']
    data = request.json
    link_online = data.get('link_atendimento_online')
    observacoes = data.get('observacoes_atendente')
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_atendente, id_cliente, status_agendamento, data_hora_inicio FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()
            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_atendente'] != id_atendente_logado: return jsonify({'message': 'Este agendamento não pertence a você.'}), 403
            if ag['status_agendamento'] != 'SOLICITADO': return jsonify({'message': f'Este agendamento já está {ag["status_agendamento"]}.'}), 400

            cursor.execute("""
                UPDATE agendamento SET status_agendamento = 'CONFIRMADO',
                                       link_atendimento_online = %s,
                                       observacoes_atendente = %s
                WHERE id_agendamento = %s
            """, (link_online, observacoes, agendamento_id))

            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (ag['id_atendente'],))
            atendente_nome = cursor.fetchone()['nome_completo']
            msg_notif = f"Seu agendamento com {atendente_nome} para {ag['data_hora_inicio'].strftime('%d/%m/%Y %H:%M')} foi CONFIRMADO."
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
                VALUES (%s, %s, %s, %s, %s)
            """, (ag['id_cliente'], 'Agendamento Confirmado!', msg_notif, 'AGENDAMENTO_CONFIRMADO', f'/cliente/meus-agendamentos/#{agendamento_id}'))

            connection.commit()
        return jsonify({'message': 'Agendamento confirmado com sucesso!'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao confirmar: {str(e)}'}), 500
    finally:
        if connection: connection.close()

@agendamentos_bp.route('/<int:agendamento_id>/recusar/atendente', methods=['POST'])
@atendente_required
def recusar_agendamento_pelo_atendente(agendamento_id):
    id_atendente_logado = request.current_user['id_usuario']
    data = request.json
    motivo_recusa = data.get('motivo_recusa')
    if not motivo_recusa:
        return jsonify({'message': 'Motivo da recusa é obrigatório.'}), 400
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_atendente, id_cliente, status_agendamento, data_hora_inicio FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()
            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_atendente'] != id_atendente_logado: return jsonify({'message': 'Este agendamento não pertence a você.'}), 403
            if ag['status_agendamento'] != 'SOLICITADO': return jsonify({'message': f'Este agendamento já está {ag["status_agendamento"]}.'}), 400

            cursor.execute("""
                UPDATE agendamento SET status_agendamento = 'CANCELADO_ATENDENTE',
                                       observacoes_atendente = CONCAT('Recusado: ', %s)
                WHERE id_agendamento = %s
            """, (motivo_recusa, agendamento_id))

            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (ag['id_atendente'],))
            atendente_nome = cursor.fetchone()['nome_completo']
            msg_notif = f"Sua solicitação de agendamento com {atendente_nome} para {ag['data_hora_inicio'].strftime('%d/%m/%Y %H:%M')} foi recusada. Motivo: {motivo_recusa}"
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
                VALUES (%s, %s, %s, %s, %s)
            """, (ag['id_cliente'], 'Solicitação Recusada', msg_notif, 'AGENDAMENTO_CANCELADO', f'/cliente/meus-agendamentos/'))

            connection.commit()
        return jsonify({'message': 'Agendamento recusado e cliente notificado.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao recusar: {str(e)}'}), 500
    finally:
        if connection: connection.close()


@agendamentos_bp.route('/<int:agendamento_id>/cancelar/cliente', methods=['POST'])
@cliente_required
def cancelar_agendamento_pelo_cliente(agendamento_id):
    id_cliente_logado = request.current_user['id_usuario']


    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_cliente, id_atendente, status_agendamento, data_hora_inicio FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()
            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_cliente'] != id_cliente_logado: return jsonify({'message': 'Este agendamento não pertence a você.'}), 403
            if ag['status_agendamento'] not in ['SOLICITADO', 'CONFIRMADO']:
                return jsonify({'message': f'Não é possível cancelar um agendamento {ag["status_agendamento"]}.'}), 400



            cursor.execute("UPDATE agendamento SET status_agendamento = 'CANCELADO_CLIENTE' WHERE id_agendamento = %s", (agendamento_id,))

            cursor.execute("SELECT nome_completo FROM usuario WHERE id_usuario = %s", (ag['id_cliente'],))
            cliente_nome = cursor.fetchone()['nome_completo']
            msg_notif = f"O agendamento com {cliente_nome} para {ag['data_hora_inicio'].strftime('%d/%m/%Y %H:%M')} foi CANCELADO pelo cliente."
            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao, link_referencia)
                VALUES (%s, %s, %s, %s, %s)
            """, (ag['id_atendente'], 'Agendamento Cancelado', msg_notif, 'AGENDAMENTO_CANCELADO', f'/atendente/minha-agenda/'))

            connection.commit()
        return jsonify({'message': 'Agendamento cancelado com sucesso.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao cancelar: {str(e)}'}), 500
    finally:
        if connection: connection.close()

@agendamentos_bp.route('/<int:agendamento_id>/observacoes', methods=['PUT'])
@atendente_required
def update_observacoes_agendamento(agendamento_id):
    id_atendente_logado = request.current_user['id_usuario']
    data = request.json
    observacoes = data.get('observacoes_atendente')
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_atendente FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()
            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_atendente'] != id_atendente_logado: return jsonify({'message': 'Acesso negado.'}), 403

            cursor.execute("UPDATE agendamento SET observacoes_atendente = %s WHERE id_agendamento = %s", (observacoes, agendamento_id))
            connection.commit()
        return jsonify({'message': 'Observações salvas com sucesso.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao salvar observações: {str(e)}'}), 500
    finally:
        if connection: connection.close()

@agendamentos_bp.route('/<int:agendamento_id>/marcar-realizado', methods=['POST'])
@atendente_required
def marcar_agendamento_realizado(agendamento_id):
    id_atendente_logado = request.current_user['id_usuario']
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_atendente, status_agendamento, data_hora_inicio FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()
            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_atendente'] != id_atendente_logado: return jsonify({'message': 'Acesso negado.'}), 403
            if ag['status_agendamento'] != 'CONFIRMADO': return jsonify({'message': 'Apenas agendamentos CONFIRMADOS podem ser marcados como realizados.'}), 400
            if ag['data_hora_inicio'] > datetime.now() : return jsonify({'message': 'Este agendamento ainda não ocorreu.'}), 400

            cursor.execute("UPDATE agendamento SET status_agendamento = 'REALIZADO' WHERE id_agendamento = %s", (agendamento_id,))


            connection.commit()
        return jsonify({'message': 'Agendamento marcado como realizado.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao marcar como realizado: {str(e)}'}), 500
    finally:
        if connection: connection.close()


@agendamentos_bp.route('', methods=['GET'])
@token_required
def get_meus_agendamentos_filtrados():
    user_id = request.current_user['id_usuario']
    user_type = request.current_user['tipo_usuario']

    status_filtro = request.args.get('status')

    base_query = """
        SELECT
            ag.id_agendamento, ag.data_hora_inicio, ag.duracao_minutos, ag.modalidade, ag.status_agendamento,
            ag.assunto_solicitacao, ag.link_atendimento_online, ag.observacoes_atendente,
            cli.nome_completo AS nome_cliente, cli.id_usuario AS id_cliente,
            att.nome_completo AS nome_atendente, att.id_usuario AS id_atendente,
            ad.area_atuacao AS area_atendente,
            (SELECT COUNT(*) FROM avaliacao av WHERE av.id_agendamento = ag.id_agendamento) > 0 AS avaliacao_existente
        FROM agendamento ag
        JOIN usuario cli ON ag.id_cliente = cli.id_usuario
        JOIN usuario att ON ag.id_atendente = att.id_usuario
        JOIN atendente_detalhes ad ON att.id_usuario = ad.id_usuario
        WHERE
    """
    params = []

    if user_type == 'CLIENTE':
        base_query += " ag.id_cliente = %s"
        params.append(user_id)
    elif user_type == 'ATENDENTE':
        base_query += " ag.id_atendente = %s"
        params.append(user_id)
    elif user_type == 'ADMIN':

        base_query += " 1=1 "
    else:
        return jsonify({'message': 'Tipo de usuário desconhecido.'}), 403

    if status_filtro:
        base_query += " AND ag.status_agendamento = %s"
        params.append(status_filtro)

    base_query += " ORDER BY ag.data_hora_inicio DESC"

    agendamentos = execute_query(base_query, tuple(params))


    agora = datetime.now()
    agendamentos_futuros = [ag for ag in agendamentos if ag['data_hora_inicio'] >= agora and ag['status_agendamento'] not in ['REALIZADO', 'CANCELADO_CLIENTE', 'CANCELADO_ATENDENTE', 'NAO_COMPARECEU_CLIENTE', 'NAO_COMPARECEU_ATENDENTE']]
    agendamentos_passados = [ag for ag in agendamentos if ag['data_hora_inicio'] < agora or ag['status_agendamento'] in ['REALIZADO', 'CANCELADO_CLIENTE', 'CANCELADO_ATENDENTE', 'NAO_COMPARECEU_CLIENTE', 'NAO_COMPARECEU_ATENDENTE']]


    return jsonify({
        'agendamentos_futuros': agendamentos_futuros,
        'agendamentos_passados': agendamentos_passados
    }), 200

@agendamentos_bp.route('/avaliacoes', methods=['POST'])
@cliente_required
def criar_nova_avaliacao():
    data = request.json
    id_cliente_logado = request.current_user['id_usuario']

    data['id_avaliador'] = id_cliente_logado


    aval_errors = validate_avaliacao_data(data)
    if aval_errors:
        return jsonify({'message': 'Dados de avaliação inválidos.', 'errors': aval_errors}), 400

    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id_cliente, id_atendente, status_agendamento
                FROM agendamento WHERE id_agendamento = %s
            """, (data['id_agendamento'],))
            ag = cursor.fetchone()

            if not ag: return jsonify({'message': 'Agendamento não encontrado.'}), 404
            if ag['id_cliente'] != id_cliente_logado: return jsonify({'message': 'Você só pode avaliar seus próprios agendamentos.'}), 403
            if ag['status_agendamento'] != 'REALIZADO': return jsonify({'message': 'Só é possível avaliar agendamentos realizados.'}), 400

            cursor.execute("SELECT id_avaliacao FROM avaliacao WHERE id_agendamento = %s", (data['id_agendamento'],))
            if cursor.fetchone():
                return jsonify({'message': 'Este agendamento já foi avaliado.'}), 409

            sql_insert_aval = """
                INSERT INTO avaliacao (id_agendamento, id_avaliador, id_avaliado, nota, comentario, anonima)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql_insert_aval, (
                data['id_agendamento'], id_cliente_logado, ag['id_atendente'], data['nota'],
                data.get('comentario'), data.get('anonima', False)
            ))
            id_avaliacao_criada = cursor.lastrowid
            connection.commit()
            return jsonify({'message': 'Avaliação enviada com sucesso!', 'id_avaliacao': id_avaliacao_criada}), 201
    except Exception as e:
        if connection: connection.rollback()
        return jsonify({'message': f'Erro ao enviar avaliação: {str(e)}'}), 500
    finally:
        if connection: connection.close()

@agendamentos_bp.route('/<int:agendamento_id>/cancelar/admin', methods=['POST'])
@admin_required
def admin_cancelar_agendamento(agendamento_id):
    data = request.json
    motivo = data.get('motivo')
    if not motivo:
        return jsonify({'message': 'Motivo do cancelamento é obrigatório.'}), 400

    id_admin_logado = request.current_user['id_usuario']
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_cliente, id_atendente, status_agendamento, data_hora_inicio FROM agendamento WHERE id_agendamento = %s", (agendamento_id,))
            ag = cursor.fetchone()

            if not ag:
                return jsonify({'message': 'Agendamento não encontrado.'}), 404

            if ag['status_agendamento'] in ['REALIZADO', 'CANCELADO_CLIENTE', 'CANCELADO_ATENDENTE', 'CANCELADO_ADMIN']:
                return jsonify({'message': f'Agendamento já está {ag["status_agendamento"]} e não pode ser cancelado novamente.'}), 400

            status_anterior = ag['status_agendamento']

            novo_status = 'CANCELADO_ADMIN'
            cursor.execute("UPDATE agendamento SET status_agendamento = %s WHERE id_agendamento = %s", (novo_status, agendamento_id))


            msg_notif = f"O agendamento para {ag['data_hora_inicio'].strftime('%d/%m/%Y %H:%M')} foi cancelado pelo administrador. Motivo: {motivo}"

            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
                VALUES (%s, %s, %s, %s)
            """, (ag['id_cliente'], 'Agendamento Cancelado', msg_notif, 'AGENDAMENTO_CANCELADO_ADMIN'))

            cursor.execute("""
                INSERT INTO notificacao (id_usuario_destino, titulo, mensagem, tipo_notificacao)
                VALUES (%s, %s, %s, %s)
            """, (ag['id_atendente'], 'Agendamento Cancelado', msg_notif, 'AGENDAMENTO_CANCELADO_ADMIN'))

            connection.commit()
        return jsonify({'message': 'Agendamento cancelado pelo administrador com sucesso.'}), 200
    except Exception as e:
        if connection: connection.rollback()
        print(f"Erro ao admin cancelar agendamento {agendamento_id}: {e}")
        return jsonify({'message': f'Erro interno ao cancelar agendamento. {str(e)}'}), 500
    finally:
        if connection: connection.close()
