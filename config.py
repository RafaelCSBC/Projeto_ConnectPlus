import os
from dotenv import load_dotenv


load_dotenv()

class Config:

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'chave-secreta-padrao'
    DEBUG = os.environ.get('FLASK_DEBUG') == 'True'
    

    DB_HOST = os.environ.get('DB_HOST') or 'localhost'
    DB_USER = os.environ.get('DB_USER') or 'root'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or '' # Necessário colocar sua senha correspondente do Banco de dados se tiver
    DB_NAME = os.environ.get('DB_NAME') or 'site_agendamento'
    

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-chave-secreta-padrao'
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hora
    

    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')


    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'DEBUG')
    LOG_FORMAT = '%(asctime)s [%(levelname)s] %(module)s:%(lineno)d - %(message)s'
    LOG_DATE_FORMAT = '%d/%m/%Y %H:%M:%S'
    LOG_DIR = os.path.join(os.getcwd(), 'logs')
    LOG_MAX_SIZE = 5 * 1024 * 1024 
    LOG_BACKUP_COUNT = 5 
