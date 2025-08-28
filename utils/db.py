import pymysql
from pymysql.cursors import DictCursor
from config import Config
from utils.logger import setup_logger


logger = setup_logger(__name__)

def get_connection():
    """Estabelece e retorna uma conexão com o banco de dados."""
    logger.debug('Tentando estabelecer conexão com o banco de dados')
    try:
        connection = pymysql.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            db=Config.DB_NAME,
            charset='utf8mb4',
            cursorclass=DictCursor,
            autocommit=True
        )
        logger.info('Conexão com o banco de dados estabelecida com sucesso')
        return connection
    except Exception as e:
        logger.error(f'Erro ao conectar ao banco de dados: {str(e)}')
        raise

def execute_query(query, params=None, fetch_all=True):
    """Executa uma consulta SQL e retorna os resultados."""
    connection = None
    try:
        logger.debug(f'Executando query: {query}')
        if params:
            logger.debug(f'Parâmetros: {params}')
        
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            if fetch_all:
                result = cursor.fetchall()
                logger.debug(f'Query retornou {len(result)} registros')
            else:
                result = cursor.fetchone()
                logger.debug('Query retornou um registro' if result else 'Query não retornou registros')
            return result
    except Exception as e:
        logger.error(f'Erro ao executar query: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')

def execute_procedure(procedure_name, params=None):
    """Executa uma stored procedure e retorna os resultados."""
    connection = None
    try:
        logger.debug(f'Executando procedure: {procedure_name}')
        if params:
            logger.debug(f'Parâmetros: {params}')
        
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.callproc(procedure_name, params or ())
            result = cursor.fetchall()
            logger.debug(f'Procedure retornou {len(result)} registros')
            return result
    except Exception as e:
        logger.error(f'Erro ao executar procedure: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')

def execute_transaction(queries):
    """Executa múltiplas consultas em uma transação."""
    connection = None
    try:
        logger.debug(f'Iniciando transação com {len(queries)} queries')
        connection = get_connection()
        connection.begin()
        
        with connection.cursor() as cursor:
            results = []
            for i, (query, params) in enumerate(queries):
                logger.debug(f'Executando query {i+1}/{len(queries)}: {query}')
                if params:
                    logger.debug(f'Parâmetros: {params}')
                
                cursor.execute(query, params or ())
                if cursor.rowcount > 0:
                    result = cursor.fetchall()
                    results.append(result)
                    logger.debug(f'Query {i+1} retornou {len(result)} registros')
                else:
                    results.append(None)
                    logger.debug(f'Query {i+1} não retornou registros')
            
            connection.commit()
            logger.info('Transação commitada com sucesso')
            return results
    except Exception as e:
        if connection:
            connection.rollback()
            logger.error(f'Erro na transação, realizando rollback: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')

def insert_record(table, data):
    """Insere um registro em uma tabela e retorna o ID inserido."""
    connection = None
    try:
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['%s'] * len(data))
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        logger.debug(f'Inserindo registro na tabela {table}')
        logger.debug(f'Query: {query}')
        logger.debug(f'Dados: {data}')
        
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute(query, list(data.values()))
            last_id = cursor.lastrowid
            logger.info(f'Registro inserido com sucesso na tabela {table}. ID: {last_id}')
            return last_id
    except Exception as e:
        logger.error(f'Erro ao inserir registro na tabela {table}: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')

def update_record(table, data, condition):
    """Atualiza registros em uma tabela com base em uma condição."""
    connection = None
    try:
        set_clause = ', '.join([f"{key} = %s" for key in data.keys()])
        where_clause = ' AND '.join([f"{key} = %s" for key in condition.keys()])
        query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
        
        logger.debug(f'Atualizando registros na tabela {table}')
        logger.debug(f'Query: {query}')
        logger.debug(f'Dados: {data}')
        logger.debug(f'Condição: {condition}')
        
        params = list(data.values()) + list(condition.values())
        
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            affected_rows = cursor.rowcount
            logger.info(f'{affected_rows} registros atualizados na tabela {table}')
            return affected_rows
    except Exception as e:
        logger.error(f'Erro ao atualizar registros na tabela {table}: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')

def delete_record(table, condition):
    """Exclui registros de uma tabela com base em uma condição."""
    connection = None
    try:
        where_clause = ' AND '.join([f"{key} = %s" for key in condition.keys()])
        query = f"DELETE FROM {table} WHERE {where_clause}"
        
        logger.debug(f'Excluindo registros da tabela {table}')
        logger.debug(f'Query: {query}')
        logger.debug(f'Condição: {condition}')
        
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute(query, list(condition.values()))
            affected_rows = cursor.rowcount
            logger.info(f'{affected_rows} registros excluídos da tabela {table}')
            return affected_rows
    except Exception as e:
        logger.error(f'Erro ao excluir registros da tabela {table}: {str(e)}')
        raise
    finally:
        if connection:
            connection.close()
            logger.debug('Conexão com o banco de dados fechada')