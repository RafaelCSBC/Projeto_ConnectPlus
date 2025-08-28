import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime


LOG_DIR = 'logs'
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)


LOG_FILE = os.path.join(LOG_DIR, f'app_{datetime.now().strftime("%Y%m")}.log')

def setup_logger(name):
    """
    Configura e retorna um logger personalizado.
    
    Args:
        name: Nome do logger (geralmente __name__ do módulo)
    
    Returns:
        Logger configurado
    """

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)


    if logger.handlers:
        return logger


    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(module)s:%(lineno)d - %(message)s',
        datefmt='%d/%m/%Y %H:%M:%S'
    )

    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5*1024*1024,
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)


    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)


    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger 