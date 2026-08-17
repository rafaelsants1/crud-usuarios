/* ============================================================================
 * Cadastro de Usuários — camada de apresentação
 *
 * Consome a API REST servida pelo próprio Spring em http://localhost:8080.
 * Como os arquivos estáticos saem do mesmo host e porta, as requisições são
 * de mesma origem e não há CORS envolvido — por isso as URLs são relativas.
 *
 * Regra invariável deste arquivo: CPF é STRING do começo ao fim. Nenhuma
 * conversão numérica em ponto algum, sob pena de perder zeros à esquerda.
 * ========================================================================= */

'use strict';

const API = '/usuarios';

/* --------------------------------------------------------------------------
 * Referências ao DOM
 * ----------------------------------------------------------------------- */

const corpoTabela      = document.getElementById('corpoTabela');
const contador         = document.getElementById('contador');
const btnAtualizar     = document.getElementById('btnAtualizar');

const form             = document.getElementById('formUsuario');
const tituloFormulario = document.getElementById('titulo-formulario');
const legendaFormulario= document.getElementById('legendaFormulario');
const etiquetaModo     = document.getElementById('etiquetaModo');
const btnSalvar        = document.getElementById('btnSalvar');
const btnCancelar      = document.getElementById('btnCancelar');

const feedback         = document.getElementById('feedback');

const campos = {
    nome:           document.getElementById('nome'),
    email:          document.getElementById('email'),
    cpf:            document.getElementById('cpf'),
    telefone:       document.getElementById('telefone'),
    dataNascimento: document.getElementById('dataNascimento')
};

/* Rótulos usados no modo cartão (telas estreitas), via data-label. */
const ROTULOS = ['Nome', 'E-mail', 'CPF', 'Telefone',
                 'Data de Nascimento', 'Data de Cadastro'];

/* --------------------------------------------------------------------------
 * Estado da tela
 * ----------------------------------------------------------------------- */

/* null = modo cadastro (POST). Um número = modo edição (PUT nesse id). */
let idEmEdicao = null;

/* Cache dos objetos vindos da API, indexados por id. Evita reconstruir o
 * usuário a partir do texto já formatado das células ao clicar em "Editar". */
const usuariosCarregados = new Map();

/* --------------------------------------------------------------------------
 * Formatação — exclusivamente para exibição.
 * Nada aqui toca no que é enviado à API; o payload usa sempre o valor cru.
 * ----------------------------------------------------------------------- */

/** 01234567890 -> 012.345.678-90 (mantém o valor original se não tiver 11 dígitos). */
function formatarCpf(cpf) {
    if (typeof cpf !== 'string') return '';
    return /^\d{11}$/.test(cpf)
        ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
        : cpf;
}

/** 79999998888 -> (79) 99999-8888 · 7933334444 -> (79) 3333-4444 */
function formatarTelefone(telefone) {
    if (!telefone) return '';
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length === 11) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    }
    if (digitos.length === 10) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    }
    return telefone;
}

/**
 * 1998-04-12 -> 12/04/1998
 * A string ISO é fatiada manualmente de propósito: `new Date('1998-04-12')`
 * seria interpretado como meia-noite UTC e, no fuso do Brasil (UTC-3),
 * voltaria um dia ao ser exibido.
 */
function formatarData(iso) {
    if (typeof iso !== 'string') return '';
    const partes = iso.slice(0, 10).split('-');
    if (partes.length !== 3) return iso;
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
}

/** 2026-08-16T14:32:10 -> 16/08/2026 às 14:32 (mesma fatia manual). */
function formatarDataHora(iso) {
    if (typeof iso !== 'string') return '';
    const [data, hora = ''] = iso.split('T');
    const horaCurta = hora.slice(0, 5);
    const dataFormatada = formatarData(data);
    return horaCurta ? `${dataFormatada} às ${horaCurta}` : dataFormatada;
}

/** Data local de hoje em ISO, sem passar por toISOString (que usa UTC). */
function hojeISO() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/* --------------------------------------------------------------------------
 * Feedback ao usuário
 * ----------------------------------------------------------------------- */

const LIMITE_DE_AVISOS = 3;

/**
 * @param {'sucesso'|'erro'} tipo
 * @param {string} texto
 */
function exibirAviso(tipo, texto) {
    while (feedback.children.length >= LIMITE_DE_AVISOS) {
        feedback.firstElementChild.remove();
    }

    const aviso = document.createElement('div');
    aviso.className = `aviso aviso--${tipo}`;
    /* alert interrompe a leitura em curso; status espera uma pausa natural. */
    aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');

    const paragrafo = document.createElement('p');
    paragrafo.className = 'aviso__texto';
    paragrafo.textContent = texto;

    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'aviso__fechar';
    fechar.setAttribute('aria-label', 'Fechar mensagem');
    fechar.textContent = '×';
    fechar.addEventListener('click', () => removerAviso(aviso));

    aviso.append(paragrafo, fechar);
    feedback.append(aviso);

    /* Erros ficam mais tempo na tela porque costumam ser mais longos. */
    setTimeout(() => removerAviso(aviso), tipo === 'erro' ? 7000 : 4000);
}

function removerAviso(aviso) {
    if (!aviso.isConnected) return;
    aviso.classList.add('aviso--saindo');
    aviso.addEventListener('animationend', () => aviso.remove(), { once: true });
    /* Rede de segurança: com prefers-reduced-motion a animação é instantânea
       e o evento pode não chegar a tempo. */
    setTimeout(() => aviso.remove(), 400);
}

/* --------------------------------------------------------------------------
 * Leitura de erros da API
 *
 * O GlobalExceptionHandler do projeto devolve `ResponseEntity<String>`, ou
 * seja, o corpo de 404 e 409 chega como TEXTO PURO (text/plain), não JSON.
 * Já o 400 não é tratado por ele e cai no ProblemDetail padrão do Spring,
 * que é JSON. Por isso a leitura é feita como texto e o JSON é apenas uma
 * tentativa — assim os dois formatos funcionam sem alterar o back-end.
 * ----------------------------------------------------------------------- */

const MENSAGENS_PADRAO = {
    400: 'Dados inválidos. Revise os campos e tente novamente.',
    404: 'Usuário não encontrado. A lista pode estar desatualizada.',
    409: 'Já existe um usuário com esse CPF ou e-mail.'
};

async function lerMensagemDeErro(resposta) {
    let corpo = '';
    try {
        corpo = (await resposta.text()).trim();
    } catch {
        corpo = '';
    }

    if (corpo) {
        try {
            const dado = JSON.parse(corpo);
            const mensagem = extrairMensagemDeObjeto(dado);
            if (mensagem && !ehMensagemGenerica(mensagem)) return mensagem;
        } catch {
            /* Não era JSON: o próprio texto já é a mensagem legível.
               É este o caminho percorrido pelos 404 e 409 deste projeto. */
            return corpo;
        }
    }

    return MENSAGENS_PADRAO[resposta.status]
        || `Falha na operação (HTTP ${resposta.status}).`;
}

/* O ProblemDetail padrão do Spring responde "Invalid request content." em
   qualquer falha de validação, sem dizer qual campo. Nesses casos a mensagem
   local de MENSAGENS_PADRAO ajuda mais do que a do servidor. */
const MENSAGENS_GENERICAS = [
    'invalid request content',
    'failed to read request',
    'no message available',
    'bad request'
];

function ehMensagemGenerica(mensagem) {
    const normalizada = mensagem.trim().toLowerCase().replace(/\.$/, '');
    return MENSAGENS_GENERICAS.includes(normalizada);
}

/** Procura a mensagem nos nomes de campo usados por ProblemDetail e afins. */
function extrairMensagemDeObjeto(dado) {
    if (typeof dado === 'string') return dado;
    if (!dado || typeof dado !== 'object') return '';

    if (Array.isArray(dado.errors) && dado.errors.length > 0) {
        const listadas = dado.errors
            .map((erro) => (typeof erro === 'string' ? erro : erro.defaultMessage || erro.message))
            .filter(Boolean);
        if (listadas.length > 0) return listadas.join(' · ');
    }

    return dado.message || dado.mensagem || dado.detail || dado.error || dado.title || '';
}

/* --------------------------------------------------------------------------
 * Renderização da tabela
 * ----------------------------------------------------------------------- */

/** Limpa o corpo da tabela e devolve uma linha ocupando todas as colunas. */
function abrirLinhaDeEstado() {
    corpoTabela.replaceChildren();
    const linha = document.createElement('tr');
    linha.className = 'linha-estado';
    const celula = document.createElement('td');
    celula.colSpan = 7;
    linha.append(celula);
    corpoTabela.append(linha);
    return celula;
}

function mostrarEsqueleto() {
    corpoTabela.replaceChildren();
    /* Barras no lugar das células: a tabela já ocupa o espaço final,
       então a lista não "pula" quando os dados chegam. */
    for (let i = 0; i < 3; i++) {
        const linha = document.createElement('tr');
        linha.setAttribute('aria-hidden', 'true');
        for (let j = 0; j < 7; j++) {
            const celula = document.createElement('td');
            const barra = document.createElement('span');
            barra.className = 'esqueleto';
            barra.style.width = `${45 + ((i * 7 + j * 11) % 45)}%`;
            celula.append(barra);
            linha.append(celula);
        }
        corpoTabela.append(linha);
    }
}

function mostrarEstado(titulo, texto, tipo) {
    const celula = abrirLinhaDeEstado();
    const bloco = document.createElement('div');
    bloco.className = tipo === 'erro' ? 'estado estado--erro' : 'estado';

    const tituloEl = document.createElement('p');
    tituloEl.className = 'estado__titulo';
    tituloEl.textContent = titulo;

    const textoEl = document.createElement('p');
    textoEl.className = 'estado__texto';
    textoEl.textContent = texto;

    bloco.append(tituloEl, textoEl);
    celula.append(bloco);
}

/** Cria uma célula com data-label (rótulo do modo cartão) e texto seguro. */
function criarCelula(indice, texto, classe) {
    const celula = document.createElement('td');
    celula.setAttribute('data-label', ROTULOS[indice]);
    if (classe) celula.className = classe;
    /* textContent, nunca innerHTML: o conteúdo vem do banco e não deve ser
       interpretado como marcação. */
    celula.textContent = texto;
    return celula;
}

function renderizarTabela(usuarios) {
    usuariosCarregados.clear();
    contador.hidden = usuarios.length === 0;
    contador.textContent = usuarios.length === 1
        ? '1 registro'
        : `${usuarios.length} registros`;

    if (usuarios.length === 0) {
        mostrarEstado(
            'Nenhum usuário cadastrado ainda',
            'Preencha o formulário abaixo para criar o primeiro registro. ' +
            'Ele aparecerá aqui automaticamente.'
        );
        return;
    }

    const fragmento = document.createDocumentFragment();

    for (const usuario of usuarios) {
        usuariosCarregados.set(usuario.id, usuario);

        const linha = document.createElement('tr');
        linha.dataset.id = String(usuario.id);

        linha.append(criarCelula(0, usuario.nome, 'celula-nome'));
        linha.append(criarCelula(1, usuario.email, 'celula-email'));
        linha.append(criarCelula(2, formatarCpf(usuario.cpf), 'celula-numerica'));

        const telefone = usuario.telefone
            ? criarCelula(3, formatarTelefone(usuario.telefone), 'celula-numerica')
            : criarCelula(3, '—', 'celula-vazia');   /* travessão para "sem telefone" */
        linha.append(telefone);

        linha.append(criarCelula(4, formatarData(usuario.dataNascimento), 'celula-numerica'));
        linha.append(criarCelula(5, formatarDataHora(usuario.dataCadastro), 'celula-numerica'));

        const acoes = document.createElement('td');
        acoes.className = 'celula-acoes';
        acoes.append(
            criarBotaoDeAcao('editar', 'Editar', usuario, 'botao botao--fantasma'),
            criarBotaoDeAcao('excluir', 'Excluir', usuario, 'botao botao--fantasma botao--perigo')
        );
        linha.append(acoes);

        fragmento.append(linha);
    }

    corpoTabela.replaceChildren(fragmento);
}

function criarBotaoDeAcao(acao, texto, usuario, classe) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = classe;
    botao.dataset.acao = acao;
    botao.dataset.id = String(usuario.id);
    botao.textContent = texto;
    /* Sem isto, um leitor de tela ouviria apenas "Editar" repetido N vezes. */
    botao.setAttribute('aria-label', `${texto} ${usuario.nome}`);
    return botao;
}

/* --------------------------------------------------------------------------
 * Operações contra a API
 * ----------------------------------------------------------------------- */

/** GET /usuarios */
async function carregarUsuarios() {
    mostrarEsqueleto();
    btnAtualizar.disabled = true;

    try {
        const resposta = await fetch(API);

        if (!resposta.ok) {
            const mensagem = await lerMensagemDeErro(resposta);
            mostrarEstado('Não foi possível carregar a lista', mensagem, 'erro');
            return;
        }

        renderizarTabela(await resposta.json());
    } catch {
        mostrarEstado(
            'Sem conexão com o servidor',
            'Verifique se a aplicação está rodando em http://localhost:8080 e tente novamente.',
            'erro'
        );
    } finally {
        btnAtualizar.disabled = false;
    }
}

/** POST /usuarios ou PUT /usuarios/{id}, conforme o modo atual. */
async function salvarUsuario(payload) {
    const editando = idEmEdicao !== null;
    const url = editando ? `${API}/${idEmEdicao}` : API;

    definirSalvamentoEmAndamento(true);

    try {
        const resposta = await fetch(url, {
            method: editando ? 'PUT' : 'POST',
            /* Content-Type é obrigatório: sem ele a API responde 415.
               Não se envia Accept: o handler de erro devolve String, e forçar
               application/json só mudaria o rótulo do corpo, não o formato. */
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resposta.ok) {
            exibirAviso('erro', await lerMensagemDeErro(resposta));
            return;
        }

        const usuario = await resposta.json();
        exibirAviso('sucesso', editando
            ? `Usuário "${usuario.nome}" atualizado com sucesso.`
            : `Usuário "${usuario.nome}" cadastrado com sucesso.`);

        sairModoEdicao();
        form.reset();
        limparTodosOsErros();
        await carregarUsuarios();
    } catch {
        exibirAviso('erro', 'Não foi possível falar com o servidor. Verifique se a aplicação está no ar.');
    } finally {
        definirSalvamentoEmAndamento(false);
    }
}

/** DELETE /usuarios/{id} */
async function excluirUsuario(id, nome, linha) {
    if (linha) linha.dataset.ocupada = 'true';

    try {
        const resposta = await fetch(`${API}/${id}`, { method: 'DELETE' });

        /* 204 No Content: não há corpo para ler no caminho feliz. */
        if (!resposta.ok) {
            exibirAviso('erro', await lerMensagemDeErro(resposta));
            if (linha) delete linha.dataset.ocupada;
            return;
        }

        exibirAviso('sucesso', `Usuário "${nome}" excluído.`);

        /* Se o registro excluído era justamente o que estava em edição,
           o formulário precisa voltar ao modo cadastro. */
        if (idEmEdicao === id) {
            sairModoEdicao();
            form.reset();
            limparTodosOsErros();
        }

        await carregarUsuarios();
    } catch {
        exibirAviso('erro', 'Não foi possível falar com o servidor. Verifique se a aplicação está no ar.');
        if (linha) delete linha.dataset.ocupada;
    }
}

/** Rótulo do botão de submit, derivado sempre do modo atual. */
function rotuloDoBotaoSalvar() {
    return idEmEdicao === null ? 'Cadastrar usuário' : 'Salvar alterações';
}

function definirSalvamentoEmAndamento(emAndamento) {
    if (emAndamento) {
        btnSalvar.textContent = idEmEdicao === null ? 'Cadastrando…' : 'Salvando…';
        btnSalvar.disabled = true;
        return;
    }
    /* O rótulo é recalculado a partir do estado, nunca restaurado do valor
       anterior: entre o disparo e a resposta o formulário já pode ter voltado
       de "edição" para "cadastro", e restaurar o texto antigo o deixaria
       dizendo "Salvar alterações" sob o título "Novo usuário". */
    btnSalvar.textContent = rotuloDoBotaoSalvar();
    btnSalvar.disabled = false;
}

/* --------------------------------------------------------------------------
 * Modo cadastro x modo edição — um só formulário para as duas operações
 * ----------------------------------------------------------------------- */

function entrarModoEdicao(usuario) {
    idEmEdicao = usuario.id;

    campos.nome.value           = usuario.nome ?? '';
    campos.email.value          = usuario.email ?? '';
    campos.cpf.value            = usuario.cpf ?? '';
    campos.telefone.value       = usuario.telefone ?? '';
    /* A API já entrega YYYY-MM-DD, que é exatamente o formato esperado por
       <input type="date">. Reformatar aqui quebraria o campo. */
    campos.dataNascimento.value = (usuario.dataNascimento ?? '').slice(0, 10);

    limparTodosOsErros();

    tituloFormulario.textContent  = 'Editar usuário';
    legendaFormulario.textContent = `Alterando o registro de ${usuario.nome}.`;
    etiquetaModo.hidden = false;
    btnSalvar.textContent = rotuloDoBotaoSalvar();
    btnCancelar.hidden = false;

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    campos.nome.focus({ preventScroll: true });
}

function sairModoEdicao() {
    idEmEdicao = null;
    tituloFormulario.textContent  = 'Novo usuário';
    legendaFormulario.textContent = 'Preencha os dados abaixo para cadastrar um usuário.';
    etiquetaModo.hidden = true;
    btnSalvar.textContent = rotuloDoBotaoSalvar();
    btnCancelar.hidden = true;
}

/* --------------------------------------------------------------------------
 * Validação no cliente
 *
 * As regras abaixo são um espelho exato das Bean Validations da entidade
 * Usuario. O motivo é prático: o back-end não trata MethodArgumentNotValid,
 * então um 400 volta com a mensagem genérica do ProblemDetail e o usuário
 * não saberia qual campo corrigir. Validando antes, o 400 praticamente
 * deixa de acontecer. Não há verificação de dígito verificador de CPF —
 * o back-end aceita qualquer sequência de 11 dígitos e o front não pode
 * ser mais restritivo que ele.
 * ----------------------------------------------------------------------- */

function definirErro(nomeDoCampo, mensagem) {
    const campo = campos[nomeDoCampo];
    const alvoErro = document.getElementById(`erro-${nomeDoCampo}`);

    campo.closest('.campo').classList.add('campo--invalido');
    campo.setAttribute('aria-invalid', 'true');
    alvoErro.textContent = mensagem;
    alvoErro.hidden = false;
}

function limparErro(nomeDoCampo) {
    const campo = campos[nomeDoCampo];
    const alvoErro = document.getElementById(`erro-${nomeDoCampo}`);

    campo.closest('.campo').classList.remove('campo--invalido');
    campo.removeAttribute('aria-invalid');
    alvoErro.textContent = '';
    alvoErro.hidden = true;
}

function limparTodosOsErros() {
    Object.keys(campos).forEach(limparErro);
}

/** @returns {boolean} true quando todos os campos passam. */
function validarFormulario() {
    limparTodosOsErros();
    const erros = [];

    const nome = campos.nome.value.trim();
    if (nome === '')          erros.push(['nome', 'Informe o nome.']);
    else if (nome.length > 60) erros.push(['nome', 'O nome deve ter no máximo 60 caracteres.']);

    const email = campos.email.value.trim();
    if (email === '')                    erros.push(['email', 'Informe o e-mail.']);
    else if (campos.email.validity.typeMismatch) erros.push(['email', 'E-mail em formato inválido.']);
    else if (email.length > 60)          erros.push(['email', 'O e-mail deve ter no máximo 60 caracteres.']);

    const cpf = campos.cpf.value;
    if (cpf === '')                erros.push(['cpf', 'Informe o CPF.']);
    else if (!/^\d{11}$/.test(cpf)) erros.push(['cpf', 'O CPF deve conter exatamente 11 dígitos.']);

    const telefone = campos.telefone.value.trim();
    if (telefone.length > 20) erros.push(['telefone', 'O telefone deve ter no máximo 20 caracteres.']);

    const nascimento = campos.dataNascimento.value;
    if (nascimento === '')            erros.push(['dataNascimento', 'Informe a data de nascimento.']);
    else if (nascimento >= hojeISO()) erros.push(['dataNascimento', 'A data de nascimento deve estar no passado.']);

    erros.forEach(([campo, mensagem]) => definirErro(campo, mensagem));

    if (erros.length > 0) {
        campos[erros[0][0]].focus();
        return false;
    }
    return true;
}

/** Monta o corpo do POST/PUT: sem id, sem dataCadastro, valores crus. */
function montarPayload() {
    const telefone = campos.telefone.value.trim();
    return {
        nome:           campos.nome.value.trim(),
        email:          campos.email.value.trim(),
        cpf:            campos.cpf.value,          // string, sempre
        telefone:       telefone === '' ? null : telefone,
        dataNascimento: campos.dataNascimento.value // já em YYYY-MM-DD
    };
}

/* --------------------------------------------------------------------------
 * Ligações de eventos
 * ----------------------------------------------------------------------- */

form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!validarFormulario()) return;
    salvarUsuario(montarPayload());
});

btnCancelar.addEventListener('click', () => {
    sairModoEdicao();
    form.reset();
    limparTodosOsErros();
    campos.nome.focus();
});

btnAtualizar.addEventListener('click', carregarUsuarios);

/* Delegação: as linhas são recriadas a cada carga, então o ouvinte fica no
   corpo da tabela em vez de em cada botão. */
corpoTabela.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const usuario = usuariosCarregados.get(id);
    if (!usuario) return;

    if (botao.dataset.acao === 'editar') {
        entrarModoEdicao(usuario);
        return;
    }

    if (botao.dataset.acao === 'excluir') {
        const confirmado = window.confirm(
            `Excluir o usuário "${usuario.nome}"?\n\nEsta ação não pode ser desfeita.`
        );
        if (confirmado) {
            excluirUsuario(id, usuario.nome, botao.closest('tr'));
        }
    }
});

/* CPF e telefone aceitam apenas dígitos. O valor guardado no input já é o
   valor cru enviado à API — não há máscara a desfazer no submit. */
[campos.cpf, campos.telefone].forEach((campo) => {
    campo.addEventListener('input', () => {
        const somenteDigitos = campo.value.replace(/\D/g, '');
        if (campo.value === somenteDigitos) return;

        const removidos = campo.value.length - somenteDigitos.length;
        const cursor = Math.max(0, (campo.selectionStart ?? somenteDigitos.length) - removidos);
        campo.value = somenteDigitos;
        campo.setSelectionRange(cursor, cursor);
    });
});

/* O erro some assim que o usuário começa a corrigir o campo. */
Object.entries(campos).forEach(([nomeDoCampo, campo]) => {
    campo.addEventListener('input', () => {
        if (campo.closest('.campo').classList.contains('campo--invalido')) {
            limparErro(nomeDoCampo);
        }
    });
});

/* --------------------------------------------------------------------------
 * Inicialização
 * ----------------------------------------------------------------------- */

/* @Past exige data estritamente anterior a hoje, então o teto do seletor
   nativo é ontem. */
(function definirTetoDaDataDeNascimento() {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const iso = [
        ontem.getFullYear(),
        String(ontem.getMonth() + 1).padStart(2, '0'),
        String(ontem.getDate()).padStart(2, '0')
    ].join('-');
    campos.dataNascimento.max = iso;
})();

carregarUsuarios();
