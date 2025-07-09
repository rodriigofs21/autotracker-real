// pages/api/scrape.js
const { scrapeUrl } = require('../../lib/scraper');

// Esta função vai ser chamada quando alguém fizer uma requisição para /api/scrape
export default async function handler(req, res) {
  // Só aceita requisições POST (por segurança)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { searchConfig } = req.body;

    if (!searchConfig) {
      return res.status(400).json({ error: 'Configuração de busca é obrigatória.' });
    }

    console.log('🚀 Iniciando busca para:', searchConfig);

    // Aqui é onde a mágica acontece - vamos construir as URLs de busca
    const searchUrls = [];

    // URL para OLX
    const olxUrl = buildOlxUrl(searchConfig);
    if (olxUrl) searchUrls.push(olxUrl);

    // URL para WebMotors  
    const webmotorsUrl = buildWebMotorsUrl(searchConfig);
    if (webmotorsUrl) searchUrls.push(webmotorsUrl);

    console.log('🔗 URLs que serão processadas:', searchUrls);

    // Executar o scraping em paralelo para ser mais rápido
    const allResults = [];
    
    for (const url of searchUrls) {
      try {
        console.log(`🕵️‍♂️ Processando: ${url}`);
        const results = await scrapeUrl(url);
        console.log(`✅ ${results.length} veículos encontrados em ${url}`);
        allResults.push(...results);
      } catch (error) {
        console.error(`❌ Erro ao processar ${url}:`, error.message);
        // Continua mesmo se uma URL falhar
      }
    }

    // Filtrar os resultados pelos critérios da busca
    const filteredResults = filterResults(allResults, searchConfig);

    console.log(`✅ Total de ${filteredResults.length} veículos encontrados após filtros.`);

    return res.status(200).json({
      success: true,
      vehicles: filteredResults,
      total: filteredResults.length,
      message: `Busca concluída! ${filteredResults.length} veículos encontrados.`
    });

  } catch (error) {
    console.error('❌ Erro grave na API de scraping:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor.',
      details: error.message
    });
  }
}

// Função para construir a URL de busca da OLX
function buildOlxUrl(config) {
  try {
    const baseUrl = 'https://sp.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios';
    const params = new URLSearchParams();

    // Busca por marca e modelo
    if (config.marca && config.modelo) {
      params.append('q', `${config.marca} ${config.modelo}`);
    }

    // Filtro de preço
    if (config.valor_maximo) {
      params.append('pe', config.valor_maximo);
    }

    // Filtro de ano
    if (config.ano_min) {
      params.append('rs', config.ano_min);
    }
    if (config.ano_max) {
      params.append('re', config.ano_max);
    }

    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('🔗 URL da OLX construída:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('❌ Erro ao construir URL da OLX:', error);
    return null;
  }
}

// Função para construir a URL de busca do WebMotors
function buildWebMotorsUrl(config) {
  try {
    const baseUrl = 'https://www.webmotors.com.br/carros/estoque';
    const params = new URLSearchParams();

    params.append('tipoveiculo', 'carros');

    // Busca por marca e modelo
    if (config.marca) {
      params.append('marca', config.marca.toLowerCase());
    }
    if (config.modelo) {
      params.append('modelo', config.modelo.toLowerCase());
    }

    // Filtro de preço
    if (config.valor_maximo) {
      params.append('precoate', config.valor_maximo);
    }

    // Filtro de ano
    if (config.ano_min) {
      params.append('anoinicial', config.ano_min);
    }
    if (config.ano_max) {
      params.append('anofinal', config.ano_max);
    }

    // Filtro de KM
    if (config.km_maxima) {
      params.append('kmmax', config.km_maxima);
    }

    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('🔗 URL do WebMotors construída:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('❌ Erro ao construir URL do WebMotors:', error);
    return null;
  }
}

// Função para filtrar os resultados pelos critérios da busca
function filterResults(vehicles, config) {
  return vehicles.filter(vehicle => {
    // Filtro de preço
    if (config.valor_maximo && vehicle.valor_anunciado > config.valor_maximo) {
      return false;
    }

    // Filtro de ano
    if (config.ano_min && vehicle.ano < config.ano_min) {
      return false;
    }
    if (config.ano_max && vehicle.ano > config.ano_max) {
      return false;
    }

    // Filtro de KM
    if (config.km_maxima && vehicle.quilometragem > config.km_maxima) {
      return false;
    }

    // Filtro de localidade (busca parcial)
    if (config.localidade && vehicle.localidade && 
        !vehicle.localidade.toLowerCase().includes(config.localidade.toLowerCase())) {
      return false;
    }

    return true;
  });
}