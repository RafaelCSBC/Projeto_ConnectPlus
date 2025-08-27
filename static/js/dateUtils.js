/**
 * Função para formatar datas considerando o fuso horário
 * Extrai a hora diretamente da string ISO para evitar conversão automática de fuso horário
 * @param {string} dataISOString - Data em formato ISO (ex: "2023-11-30T11:00:00Z")
 * @returns {string} Data formatada (ex: "30/11/2023 às 11:00")
 */
function formatarDataHora(dataISOString) {
    console.log(`Formatando data: ${dataISOString}`);
    
    if (!dataISOString) {
        console.warn('Data não fornecida para formatação');
        return 'Data não disponível';
    }
    
    try {
        const data = new Date(dataISOString);
        console.log(`Data parseada: ${data}`);
        
        // Formatar a data no padrão brasileiro
        const dataFormatada = data.toLocaleDateString('pt-BR');
        console.log(`Data formatada (pt-BR): ${dataFormatada}`);
        
        const partes = dataISOString.split('T');
        if (partes.length !== 2) {
            console.warn('Formato de data ISO inválido, falta separador T');
            return dataFormatada;
        }
        
        const horaMinuto = partes[1].substring(0, 5);
        console.log(`Hora extraída: ${horaMinuto}`);
        
        const resultado = `${dataFormatada} às ${horaMinuto}`;
        console.log(`Resultado final: ${resultado}`);
        return resultado;
    } catch (error) {
        console.error("Erro ao formatar data:", error);
        console.error("Stack trace:", error.stack);
        console.warn(`Retornando data original: ${dataISOString}`);
        return String(dataISOString);
    }
}