# AI Audiobook
> Plataforma para converter PDFs em audiobooks com controle de acesso por usuário

## Descrição do Projeto
Protótipo full-stack que transforma PDFs em audiobooks, com painel administrativo para gerenciar uploads, processamento, permissões e reprodução. O projeto foca em um fluxo prático: upload → extração de texto (ou OCR) → divisão por capítulos → geração TTS → reprodução controlada por permissões.

### Funcionalidades Principais
- Autenticação com JWT e refresh tokens
- Upload de PDFs (multi-upload) e status de processamento
- Extração de texto (pdf-parse) e suporte planejado a OCR para PDFs escaneados
- Geração de áudio por capítulo (TTS) e armazenamento seguro de faixas
- Player integrado (play/pause, progresso, volume, retomada)
- Painel Admin para gerenciar títulos, permissões e logs

## Backlog do Produto
|US|Título|
|--:|-----|
|US-01|Cadastro de Usuário|
|US-02|Login|
|US-03|Controle de Rotas por Perfil / Refresh Token|
|US-04|Upload de PDF (multi-upload)|
|US-05|Status de Processamento|
|US-06|Extração de Texto / OCR|
|US-07|Geração de Áudio por Faixa (TTS)|
|US-08|Biblioteca do Usuário|
|US-09|Player (básico / avançado)|
|US-10|Conceder Acesso|
|US-11|Revogar Acesso|
|US-12|Modelagem do Banco de Dados|
|US-13|Responsividade / Mobile|
|US-14|Proteção de Arquivos / Download Criptografado|
|US-15|Logs e Monitoramento|

## Definition of Ready (DoR)
- Protótipo UI/UX definido para a história
- Dados de teste e usuários de exemplo disponíveis (scripts em `backend/scripts/`)
- Critérios de aceitação claros e testáveis

## Definition of Done (DoD)
- Implementação atende critérios de aceitação
- Build sem erros críticos
- Testes manuais ou automatizados conforme aplicável
- Documentação atualizada (README, BACKLOG, STATUS)

## Cronograma / Entregas
|Entrega|Data|Resumo|
|--:|--:|--|
|Entrega 1|08/05|Núcleo funcional: autenticação, upload, extração de texto, TTS básico, player e permissões (concluído)|
|Entrega 2|22/05|OCR, refresh token, status visual, player avançado, logs (concluído)|
|Entrega 3|26/05|Mobile e download criptografado (em progresso)|

## Tecnologias
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white) ![ffmpeg](https://img.shields.io/badge/FFmpeg-000000?style=for-the-badge&logo=ffmpeg&logoColor=white)

## Estrutura do Projeto
```
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── config/
│   ├── scripts/  # scripts de suporte (criar users, testes)
│   └── data/     # arquivo SQLite (não versionar)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── vite-launcher.mjs
├── audio/
├── uploads/
└── README.md
```

## Como Executar (desenvolvimento)

1. Backend
```powershell
cd backend
npm install
node server.js
```

2. Frontend
```powershell
cd frontend
npm install
npm run dev
```

Observações:
- O backend roda por padrão em `http://localhost:3000`.
- O Vite escolhe uma porta dinâmica para o frontend (ex.: `http://localhost:5175`).
- Para testes locais, scripts de criação de usuário estão em `backend/scripts/`.

## Credenciais de desenvolvimento
- Admin: admin@example.com / adminpassword
- Usuário: test@example.com / password123
