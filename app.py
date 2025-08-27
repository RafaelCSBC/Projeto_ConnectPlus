# app.py
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
from config import Config
from utils.logger import setup_logger

logger = setup_logger(__name__)


from routes.auth import auth_bp
from routes.usuarios import usuarios_bp
from routes.atendentes import atendentes_bp
from routes.agendamentos import agendamentos_bp 

def create_app():
    logger.info('Iniciando criação da aplicação Flask...')
    app = Flask(__name__, static_folder='static', static_url_path='/static') 
    app.config.from_object(Config)
    CORS(app) 
    
    logger.info('Registrando blueprints...')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(usuarios_bp, url_prefix='/api/usuarios')
    app.register_blueprint(atendentes_bp, url_prefix='/api/atendentes')
    app.register_blueprint(agendamentos_bp, url_prefix='/api/agendamentos')
    logger.debug('Todos os blueprints foram registrados com sucesso')
    
    
    @app.route('/')
    def index():
        logger.debug('Acessando rota raiz /')
        
        return send_from_directory('static', 'index.html')

    @app.route('/<path:filename>')
    def serve_page(filename):
        logger.debug(f'Tentando servir arquivo: {filename}')
        
        static_path = os.path.join(app.static_folder, filename)
        if os.path.exists(static_path):
            if os.path.isdir(static_path):
                logger.debug(f'Path {filename} é um diretório, tentando servir index.html')
                index_file = os.path.join(filename, 'index.html')
                if os.path.exists(os.path.join(app.static_folder, index_file)):
                    logger.info(f'Servindo index.html do diretório: {filename}')
                    return send_from_directory(app.static_folder, index_file)
            else:
                logger.info(f'Servindo arquivo estático: {filename}')
                return send_from_directory(app.static_folder, filename)


        possible_html_path_dir = os.path.join(filename, f"{filename.split('/')[-1]}.html")
        possible_html_path_file = f"{filename}.html"

        if os.path.exists(os.path.join(app.static_folder, possible_html_path_dir)):
            logger.info(f'Servindo arquivo HTML do diretório: {possible_html_path_dir}')
            return send_from_directory(app.static_folder, possible_html_path_dir)
        elif os.path.exists(os.path.join(app.static_folder, possible_html_path_file)):
            logger.info(f'Servindo arquivo HTML: {possible_html_path_file}')
            return send_from_directory(app.static_folder, possible_html_path_file)
            
        logger.warning(f'Arquivo não encontrado: {filename}')
        return not_found(None)

    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith('/api/'):
            logger.warning(f'Endpoint da API não encontrado: {request.path}')
            return jsonify({'message': 'Endpoint da API não encontrado.'}), 404

        logger.info(f'Página não encontrada, redirecionando para index: {request.path}')
        return send_from_directory('static', 'index.html'), 200 

    logger.info('Aplicação Flask criada com sucesso')
    return app

if __name__ == '__main__':
    app = create_app()
    logger.info('Iniciando servidor Flask...')
    app.run(host='0.0.0.0', port=5000, debug=True)