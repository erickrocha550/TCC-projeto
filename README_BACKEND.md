# EcoFila — cópia MySQL/phpMyAdmin

Esta cópia mantém o frontend e suas rotas de API, mas grava denúncias e apoios em MySQL ou MariaDB. O phpMyAdmin é usado para administrar e visualizar essas tabelas.

## 1. Criar o banco

No phpMyAdmin, crie ou selecione um banco chamado ecofila e importe schema.sql. Em hospedagem compartilhada, use o nome de banco e usuário fornecidos pelo painel; bancos com prefixo podem ter um nome diferente de ecofila.

## 2. Configurar a conexão

Copie .env.example para .env e preencha DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD com os dados da hospedagem. Não publique o arquivo .env.

## 3. Instalar e iniciar

Requer Node.js 18 ou superior. Na pasta desta cópia, execute:

    npm install
    npm start

Abra o site pelo endereço configurado, por padrão http://127.0.0.1:3000. A verificação em /api/health deve responder com status ok e database mysql. A primeira inicialização insere quatro ocorrências de demonstração se a tabela reports estiver vazia.

## Tabelas

- reports: denúncias, localização, status e contagem de apoios.
- report_supporters: apoios associados ao identificador anônimo do navegador.
- app_metadata: marca inicialização dos dados de demonstração.

## Frontend já hospedado

Se o frontend estiver em outro domínio, configure CORS_ORIGIN no .env com a origem exata do site, sem barra ou caminho final (por exemplo, https://meu-site.example). No index.html da cópia, defina window.ECOFILA_API_BASE com a origem pública do backend (por exemplo, https://api.example.com). Não inclua credenciais do banco no frontend.

## Hospedagem

O Node.js precisa conseguir alcançar o host MySQL. Configure as credenciais no ambiente do servidor, não no index.html. Quando frontend e API estiverem em domínios diferentes, configure CORS no backend e altere as chamadas relativas /api do frontend para a URL da API.

Este pacote é uma cópia separada; não substitui a versão SQLite nem os arquivos da pasta TCC original.