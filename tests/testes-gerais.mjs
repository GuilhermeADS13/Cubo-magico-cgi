// ============================================================================
// TESTES GERAIS — Cubo Mágico 3D
//
// Abre o index.html REAL em um Chrome headless (com WebGL por software) e
// exercita o jogo como um usuário: botões, teclado, embaralhar, vitória,
// cronômetro, temas e persistência. O Three.js é servido de node_modules,
// então os testes não dependem de internet.
//
// Uso (dentro da pasta tests/):   npm install   e depois   npm test
// Chrome fora do lugar padrão:    CHROME_PATH="/caminho/do/chrome" npm test
// ============================================================================
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const THREE_DIR = path.join(AQUI, 'node_modules', 'three');
const ORIGEM = 'http://cubo.test';

// ---------------------------------------------------------------------------
// Infraestrutura
// ---------------------------------------------------------------------------
function localizarChrome() {
    const candidatos = [
        process.env.CHROME_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ].filter(Boolean);
    return candidatos.find(p => fs.existsSync(p));
}

// Expõe as variáveis internas do módulo do jogo (só nos testes; o index.html
// de produção não é alterado).
const GANCHO_DE_TESTE = `
window.__t = {
    THREE, scene, cubinhos, materiaisFaces, temas, CONFIG_FACES, cronometro,
    girarFace, embaralharCubo, resetarCubo, cuboEstaResolvido,
    get animando() { return animando; },
    get fila() { return filaMovimentos; },
    get movimentoAtual() { return movimentoAtual; },
    get partida() { return cuboEmbaralhadoPeloUsuario; },
    get embaralhando() { return embaralhando; },
    get contador() { return contadorMovimentos; }
};
`;

function htmlComGancho() {
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const fim = html.lastIndexOf('</script>');
    return html.slice(0, fim) + GANCHO_DE_TESTE + html.slice(fim);
}

async function abrirPagina(browser) {
    const contexto = await browser.createBrowserContext(); // localStorage isolado por teste
    const page = await contexto.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const erros = [];
    page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') erros.push(`console.error: ${m.text()}`); });

    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (url === `${ORIGEM}/index.html`) {
            return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlComGancho() });
        }
        const three = url.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.1\/(.*)$/);
        if (three) {
            return req.respond({
                status: 200,
                contentType: 'application/javascript',
                headers: { 'access-control-allow-origin': '*' },
                body: fs.readFileSync(path.join(THREE_DIR, three[1]))
            });
        }
        if (url.startsWith('https://fonts.googleapis.com/')) {
            return req.respond({ status: 200, contentType: 'text/css', body: '' });
        }
        if (url === `${ORIGEM}/favicon.ico`) return req.respond({ status: 204 });
        erros.push(`requisição inesperada: ${url}`);
        return req.abort();
    });

    await page.goto(`${ORIGEM}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__t, { timeout: 30000 });

    return {
        page,
        erros,
        recarregar: async () => {
            await page.reload({ waitUntil: 'load' });
            await page.waitForFunction(() => window.__t, { timeout: 30000 });
        },
        fechar: () => contexto.close()
    };
}

const dormir = ms => new Promise(r => setTimeout(r, ms));
const texto = (page, seletor) => page.$eval(seletor, e => e.textContent.trim());
const segundos = t => t.split(':').map(Number).reduce((total, n) => total * 60 + n, 0);
const ocioso = page => page.waitForFunction(
    () => !window.__t.animando && window.__t.fila.length === 0, { timeout: 90000 });

// "R U R' U'" -> executa os giros pela própria função do jogo, com animação de 1 ms
async function aplicar(page, movimentos) {
    await page.evaluate((lista) => {
        for (const m of lista) window.__t.girarFace(m[0], !m.endsWith("'"), 1);
    }, movimentos.split(' ').filter(Boolean));
    await ocioso(page);
}

// Estado completo do cubo: posição + matriz de rotação de cada cubinho
// (matriz em vez de quaternion, porque q e -q representam a mesma rotação)
const estado = page => page.evaluate(() => window.__t.cubinhos.map(c => {
    const m = new window.__t.THREE.Matrix4().makeRotationFromQuaternion(c.quaternion).elements;
    return [c.position.x, c.position.y, c.position.z,
        m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]].map(n => Math.round(n * 1e6) / 1e6);
}));

const resolvido = page => page.evaluate(() => window.__t.cuboEstaResolvido());
const modalAtivo = page => page.$eval('#modal-vitoria', e => e.classList.contains('ativo'));

// Clica em Embaralhar, devolve a sequência sorteada e espera o fim do processo
async function embaralharEEsperar(page) {
    const sequencia = await page.evaluate(() => {
        const t = window.__t;
        document.getElementById('btn-embaralhar').click();
        const m = t.movimentoAtual; // o 1º giro já saiu da fila
        const primeiro = { face: m.face, horario: m.anguloAlvo * t.CONFIG_FACES[m.face].sentidoBase > 0 };
        return [primeiro, ...t.fila.map(({ face, horario }) => ({ face, horario }))];
    });
    await page.waitForFunction(
        () => !document.getElementById('btn-embaralhar').disabled && !window.__t.animando, { timeout: 90000 });
    return sequencia;
}

async function girarPorTeclado(page, face, horario) {
    if (horario) {
        await page.keyboard.press(face);
    } else {
        await page.keyboard.down('Shift');
        await page.keyboard.press(face);
        await page.keyboard.up('Shift');
    }
}

// Gerador pseudoaleatório com semente (resultados reproduzíveis)
function mulberry32(semente) {
    return () => {
        semente |= 0; semente = (semente + 0x6D2B79F5) | 0;
        let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function afirmar(condicao, mensagem) {
    if (!condicao) throw new Error(mensagem);
}

function igual(recebido, esperado, mensagem) {
    if (JSON.stringify(recebido) !== JSON.stringify(esperado)) {
        throw new Error(`${mensagem}\n        esperado: ${JSON.stringify(esperado)}\n        recebido: ${JSON.stringify(recebido)}`);
    }
}

const resultados = [];
async function teste(browser, nome, corpo) {
    if (process.env.FILTRO && !nome.includes(process.env.FILTRO)) return;
    const inicio = Date.now();
    const ctx = await abrirPagina(browser);
    try {
        await corpo(ctx);
        afirmar(ctx.erros.length === 0, `erros no navegador durante o teste:\n        ${ctx.erros.join('\n        ')}`);
        console.log(`  ✓ ${nome} (${Date.now() - inicio} ms)`);
        resultados.push({ nome, ok: true });
    } catch (erro) {
        console.log(`  ✗ ${nome}\n      ${erro.message}`);
        resultados.push({ nome, ok: false });
    } finally {
        await ctx.fechar();
    }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------
const chrome = localizarChrome();
if (!chrome) {
    console.error('Chrome não encontrado. Instale o Google Chrome ou defina CHROME_PATH com o caminho do executável.');
    process.exit(1);
}

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
if (process.platform === 'linux') args.push('--no-sandbox');
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args });
console.log(`Navegador: ${chrome}\n`);

console.log('Estrutura 3D e estado inicial');
await teste(browser, 'carrega sem erros, com 27 cubinhos únicos em posições inteiras e cubo resolvido', async ({ page }) => {
    const info = await page.evaluate(() => {
        const t = window.__t;
        return {
            total: t.cubinhos.length,
            posicoes: new Set(t.cubinhos.map(c => `${c.position.x},${c.position.y},${c.position.z}`)).size,
            valoresValidos: t.cubinhos.every(c => [c.position.x, c.position.y, c.position.z].every(v => [-1, 0, 1].includes(v)))
        };
    });
    igual(info, { total: 27, posicoes: 27, valoresValidos: true }, 'estrutura do cubo');
    afirmar(await resolvido(page), 'o cubo recém-montado deveria estar resolvido');
    igual([await texto(page, '#contador-movimentos'), await texto(page, '#tempo-decorrido')], ['0', '00:00'], 'métricas iniciais');
});

console.log('\nMovimentação');
await teste(browser, 'cada face: 4 giros restauram o cubo, 1 giro altera e horário + anti-horário se anulam', async ({ page }) => {
    const inicial = await estado(page);
    for (const face of ['U', 'D', 'L', 'R', 'F', 'B']) {
        await aplicar(page, `${face} ${face} ${face} ${face}`);
        igual(await estado(page), inicial, `4 giros de ${face} deveriam restaurar o cubo`);

        await aplicar(page, face);
        afirmar(JSON.stringify(await estado(page)) !== JSON.stringify(inicial), `1 giro de ${face} deveria alterar o cubo`);
        afirmar(!(await resolvido(page)), `após 1 giro de ${face} o cubo não pode estar resolvido`);

        await aplicar(page, `${face}'`);
        igual(await estado(page), inicial, `${face} seguido de ${face}' deveria restaurar o cubo`);
    }
});

await teste(browser, 'sentido dos giros segue a notação oficial (U, D, L, R, F, B)', async ({ page }) => {
    // [movimento, posição de uma peça antes, posição esperada depois]
    const tabela = [
        ['U', [0, 1, 1], [-1, 1, 0]],   // U: frente -> esquerda
        ['D', [0, -1, 1], [1, -1, 0]],  // D: frente -> direita
        ['R', [1, 0, 1], [1, 1, 0]],    // R: frente -> topo
        ['L', [-1, 0, 1], [-1, -1, 0]], // L: frente -> base
        ['F', [0, 1, 1], [1, 0, 1]],    // F: topo -> direita
        ['B', [0, 1, -1], [-1, 0, -1]]  // B: topo -> esquerda
    ];
    for (const [mov, de, para] of tabela) {
        const indice = await page.evaluate(([m, p]) => {
            const t = window.__t;
            const i = t.cubinhos.findIndex(c => c.position.x === p[0] && c.position.y === p[1] && c.position.z === p[2]);
            t.girarFace(m, true, 1);
            return i;
        }, [mov, de]);
        await ocioso(page);
        const depois = await page.evaluate(i => {
            const c = window.__t.cubinhos[i];
            return [c.position.x, c.position.y, c.position.z];
        }, indice);
        igual(depois, para, `${mov} (horário) moveu a peça ${JSON.stringify(de)} para o lugar errado`);
        await aplicar(page, `${mov}'`);
    }
});

await teste(browser, "algoritmo (R U R' U') repetido 6 vezes restaura o cubo (e 1 vez não)", async ({ page }) => {
    await aplicar(page, "R U R' U'");
    afirmar(!(await resolvido(page)), "1 vez de R U R' U' não deveria resolver");
    await aplicar(page, "R U R' U' ".repeat(5));
    afirmar(await resolvido(page), "6 vezes de R U R' U' deveria voltar ao cubo resolvido");
});

await teste(browser, 'zero drift: 150 giros aleatórios + sequência inversa deixam tudo exato e resolvido', async ({ page }) => {
    const sorteio = mulberry32(2026);
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const sequencia = Array.from({ length: 150 }, () => ({ face: faces[Math.floor(sorteio() * 6)], horario: sorteio() > 0.5 }));

    await aplicar(page, sequencia.map(m => m.face + (m.horario ? '' : "'")).join(' '));

    // Posições são arredondadas para inteiros a cada giro (devem ser exatas). Já a matriz de
    // rotação sai de um quaternion, que não representa √½ com exatidão: sobra ~1e-16 de ruído,
    // que NÃO acumula porque o jogo realinha a matriz a cada giro. Medimos o pior desvio.
    const desvio = await page.evaluate(() => {
        let posicoes = 0, matrizes = 0;
        for (const c of window.__t.cubinhos) {
            for (const v of [c.position.x, c.position.y, c.position.z]) posicoes = Math.max(posicoes, Math.abs(v - Math.round(v)));
            const m = new window.__t.THREE.Matrix4().makeRotationFromQuaternion(c.quaternion).elements;
            for (const v of [...m.slice(0, 3), ...m.slice(4, 7), ...m.slice(8, 11)]) matrizes = Math.max(matrizes, Math.abs(v - Math.round(v)));
        }
        return { posicoes, matrizes };
    });
    console.log(`      desvio máximo após 150 giros -> posições: ${desvio.posicoes}, matrizes: ${desvio.matrizes}`);
    afirmar(desvio.posicoes === 0, `posições deveriam ser inteiras exatas (desvio ${desvio.posicoes})`);
    afirmar(desvio.matrizes < 1e-12, `matrizes de rotação deveriam estar alinhadas aos eixos (desvio ${desvio.matrizes})`);

    const inversa = [...sequencia].reverse().map(m => m.face + (m.horario ? "'" : '')).join(' ');
    await aplicar(page, inversa);
    afirmar(await resolvido(page), 'a sequência inversa deveria devolver o cubo resolvido');
});

console.log('\nInterface e entrada do usuário');
await teste(browser, 'os 12 botões de giro contam 12 movimentos e (em pares U/U\', D/D\'...) se anulam', async ({ page }) => {
    await page.click('.btn-vel[data-ms="110"]');
    const botoes = await page.$$('.btn-face');
    igual(botoes.length, 12, 'quantidade de botões de giro');
    for (const botao of botoes) await botao.click();
    await ocioso(page);
    igual(await texto(page, '#contador-movimentos'), '12', 'contador de movimentos');
    afirmar(await resolvido(page), 'U U\' D D\' ... deveria terminar resolvido');
    afirmar(!(await modalAtivo(page)), 'sem embaralhar, não deve aparecer aviso de vitória');
});

await teste(browser, 'teclado: letra gira, Shift inverte, Ctrl+letra e tecla repetida são ignorados', async ({ page }) => {
    await page.keyboard.press('r');
    await ocioso(page);
    igual(await texto(page, '#contador-movimentos'), '1', 'contador após R');
    afirmar(!(await resolvido(page)), 'R deveria alterar o cubo');

    await girarPorTeclado(page, 'r', false);
    await ocioso(page);
    igual(await texto(page, '#contador-movimentos'), '2', 'contador após Shift+R');
    afirmar(await resolvido(page), "R seguido de Shift+R (R') deveria restaurar o cubo");

    const ctrl = await page.evaluate(() => {
        const ev = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        return { prevenido: ev.defaultPrevented, fila: window.__t.fila.length, animando: window.__t.animando };
    });
    igual(ctrl, { prevenido: false, fila: 0, animando: false }, 'Ctrl+R deve seguir para o navegador (recarregar) sem girar a face');

    const repetida = await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', repeat: true, bubbles: true, cancelable: true }));
        return { fila: window.__t.fila.length, animando: window.__t.animando };
    });
    igual(repetida, { fila: 0, animando: false }, 'tecla segurada (repeat) não pode encher a fila');
    igual(await texto(page, '#contador-movimentos'), '2', 'contador não muda com Ctrl+R / tecla repetida');
});

await teste(browser, 'botões de interface não "roubam" o foco: depois do clique, Espaço embaralha', async ({ page }) => {
    await page.click('#btn-resetar');
    const focoEmBotao = await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'BUTTON');
    afirmar(!focoEmBotao, 'o botão clicado deveria perder o foco');
    await page.keyboard.press('Space');
    const embaralhando = await page.evaluate(() => window.__t.embaralhando);
    afirmar(embaralhando, 'Espaço deveria iniciar o embaralhamento');
});

console.log('\nEmbaralhar e resetar');
await teste(browser, 'embaralhar: bloqueia entradas durante o processo, zera métricas e libera o jogo', async ({ page }) => {
    await page.evaluate(() => document.getElementById('btn-embaralhar').click());
    const durante = await page.evaluate(() => {
        const t = window.__t;
        const antes = t.fila.length;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true, cancelable: true }));
        t.embaralharCubo(20);
        return {
            botaoDesabilitado: document.getElementById('btn-embaralhar').disabled,
            embaralhando: t.embaralhando,
            filaIgual: t.fila.length === antes
        };
    });
    igual(durante, { botaoDesabilitado: true, embaralhando: true, filaIgual: true },
        'durante o embaralhamento: botão bloqueado e Espaço/letras/novo embaralhar ignorados');

    await page.waitForFunction(() => !document.getElementById('btn-embaralhar').disabled && !window.__t.animando, { timeout: 90000 });
    igual(await texto(page, '#contador-movimentos'), '0', 'contador zerado após embaralhar');
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'tempo zerado após embaralhar');
    afirmar(await page.evaluate(() => window.__t.partida), 'a partida deveria estar em andamento');
    afirmar(!(await resolvido(page)), 'o cubo deveria estar embaralhado');
    afirmar((await texto(page, '#status-text')).includes('embaralhado'), 'status deveria avisar que o cubo foi embaralhado');
});

await teste(browser, 'resetar no meio do embaralhamento cancela tudo (sem partida fantasma)', async ({ page }) => {
    await page.evaluate(() => document.getElementById('btn-embaralhar').click());
    await dormir(250);
    await page.click('#btn-resetar');
    const logo = await page.evaluate(() => ({
        botaoDesabilitado: document.getElementById('btn-embaralhar').disabled,
        embaralhando: window.__t.embaralhando,
        fila: window.__t.fila.length,
        partida: window.__t.partida,
        resolvido: window.__t.cuboEstaResolvido()
    }));
    igual(logo, { botaoDesabilitado: false, embaralhando: false, fila: 0, partida: false, resolvido: true }, 'estado logo após resetar');
    await dormir(800);
    const depois = await page.evaluate(() => ({ partida: window.__t.partida, resolvido: window.__t.cuboEstaResolvido() }));
    igual(depois, { partida: false, resolvido: true }, 'o embaralhamento cancelado não pode "terminar" depois');
    igual(await texto(page, '#contador-movimentos'), '0', 'contador após resetar');
});

console.log('\nDetecção de vitória');
await teste(browser, 'desfazer o embaralhamento mostra a vitória (movimentos + tempo); 19 de 20 não basta; aviso não repete', async ({ page }) => {
    await page.click('.btn-vel[data-ms="110"]');
    const sequencia = await embaralharEEsperar(page);
    igual(sequencia.length, 20, 'tamanho da sequência de embaralhamento');
    afirmar(!(await resolvido(page)), 'o cubo deveria estar embaralhado');

    // desfaz do último giro até o 2º (deixa o 1º sem desfazer)
    for (let i = sequencia.length - 1; i >= 1; i--) {
        await girarPorTeclado(page, sequencia[i].face, !sequencia[i].horario);
    }
    await ocioso(page);
    afirmar(!(await modalAtivo(page)), '19 de 20 giros desfeitos NÃO pode mostrar vitória');
    afirmar(!(await resolvido(page)), 'com 1 giro faltando o cubo não está resolvido');

    await girarPorTeclado(page, sequencia[0].face, !sequencia[0].horario);
    await ocioso(page);
    afirmar(await modalAtivo(page), 'ao resolver o cubo o aviso de vitória deveria aparecer');
    const mensagem = await texto(page, '#texto-vitoria');
    afirmar(/20 movimentos/.test(mensagem) && /\d{2}:\d{2}/.test(mensagem), `mensagem de vitória inesperada: "${mensagem}"`);
    afirmar(!(await page.evaluate(() => window.__t.cronometro.rodando)), 'o cronômetro deveria parar na vitória');

    // novos giros fecham o aviso e ele não reaparece sozinho
    await girarPorTeclado(page, 'U', true);
    await girarPorTeclado(page, 'U', false);
    await ocioso(page);
    afirmar(!(await modalAtivo(page)), 'o aviso não pode reaparecer depois de nova movimentação');
});

console.log('\nCronômetro opcional');
await teste(browser, 'modo livre: sem embaralhar o tempo só corre se o jogador iniciar; pausar, continuar (T) e zerar funcionam', async ({ page }) => {
    await page.keyboard.press('u');
    await ocioso(page);
    await dormir(1300);
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'sem embaralhar o cronômetro não deve iniciar sozinho');
    igual(await texto(page, '#btn-timer-toggle'), '▶ Iniciar', 'rótulo inicial do botão');

    await page.click('#btn-timer-toggle');
    await dormir(1300);
    afirmar(segundos(await texto(page, '#tempo-decorrido')) >= 1, 'o cronômetro deveria estar contando');
    igual(await texto(page, '#btn-timer-toggle'), '⏸ Pausar', 'rótulo com o cronômetro rodando');

    await page.click('#btn-timer-toggle');
    const pausado = await texto(page, '#tempo-decorrido');
    await dormir(1300);
    igual(await texto(page, '#tempo-decorrido'), pausado, 'pausado, o tempo não pode avançar');
    igual(await texto(page, '#btn-timer-toggle'), '▶ Continuar', 'rótulo com o cronômetro pausado');

    await page.keyboard.press('t');
    await dormir(1300);
    afirmar(segundos(await texto(page, '#tempo-decorrido')) > segundos(pausado), 'a tecla T deveria continuar a contagem');

    await page.click('#btn-timer-zerar');
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'tempo depois de zerar');
    afirmar(!(await page.evaluate(() => window.__t.cronometro.rodando)), 'zerar deveria parar o cronômetro');
    igual(await texto(page, '#btn-timer-toggle'), '▶ Iniciar', 'rótulo depois de zerar');
});

await teste(browser, 'automático: inicia no 1º giro após embaralhar, zera ao embaralhar de novo e pode ser desligado', async ({ page }) => {
    await embaralharEEsperar(page);
    afirmar(!(await page.evaluate(() => window.__t.cronometro.rodando)), 'logo após embaralhar o cronômetro está parado');
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'tempo logo após embaralhar');

    await page.keyboard.press('r');
    afirmar(await page.evaluate(() => window.__t.cronometro.rodando), 'o 1º giro deveria iniciar o cronômetro');
    await dormir(1300);
    afirmar(segundos(await texto(page, '#tempo-decorrido')) >= 1, 'o tempo deveria estar avançando');

    await embaralharEEsperar(page); // embaralhar com o cronômetro rodando
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'embaralhar de novo zera o tempo');
    afirmar(!(await page.evaluate(() => window.__t.cronometro.rodando)), 'embaralhar de novo para o cronômetro');

    await page.click('#timer-auto'); // desliga o início automático
    await page.keyboard.press('u');
    await dormir(1300);
    igual(await texto(page, '#tempo-decorrido'), '00:00', 'com o automático desligado o cronômetro não inicia sozinho');
    afirmar(!(await page.evaluate(() => window.__t.cronometro.rodando)), 'cronômetro deveria continuar parado');
});

console.log('\nTemas de cores e persistência');
const pixelDaFace = (page, face) => page.evaluate((f) => {
    const canvas = window.__t.materiaisFaces[f].map.image;
    const d = canvas.getContext('2d').getImageData(128, 128, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
}, face);
const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'];

await teste(browser, 'cada paleta rápida atualiza seletores, texturas 3D e destaca o botão ativo', async ({ page }) => {
    const nomes = await page.$$eval('.btn-preset', bs => bs.map(b => b.dataset.tema));
    igual(nomes, ['classico', 'pastel', 'neon', 'retro', 'daltonico'], 'paletas disponíveis');
    for (const nome of nomes) {
        await page.click(`.btn-preset[data-tema="${nome}"]`);
        const paleta = await page.evaluate(n => window.__t.temas[n], nome);
        for (const face of FACES) {
            igual(await page.$eval(`#${face}`, e => e.value.toLowerCase()), paleta[face].toLowerCase(), `seletor ${face} do tema ${nome}`);
            igual(await pixelDaFace(page, face), paleta[face].toLowerCase(), `textura ${face} do tema ${nome}`);
        }
        igual(await page.$$eval('.btn-preset.ativo', bs => bs.map(b => b.dataset.tema)), [nome], `botão ativo do tema ${nome}`);
    }
});

await teste(browser, 'cor personalizada muda a textura 3D e desmarca a paleta; vitória continua valendo', async ({ page }) => {
    await page.$eval('#top', (el) => {
        el.value = '#123456';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    igual(await pixelDaFace(page, 'top'), '#123456', 'textura da face de cima');
    igual(await texto(page, '#hex-top'), '#123456', 'rótulo hexadecimal');
    igual(await page.$$eval('.btn-preset.ativo', bs => bs.length), 0, 'nenhuma paleta deve ficar marcada');
    afirmar(await resolvido(page), 'trocar cores não pode afetar a detecção de cubo resolvido');
});

await teste(browser, 'tema, velocidade e cronômetro automático são lembrados após recarregar a página', async ({ page, recarregar }) => {
    await page.click('.btn-preset[data-tema="retro"]');
    await page.click('.btn-vel[data-ms="400"]');
    await page.click('#timer-auto');
    await recarregar();

    igual(await page.$$eval('.btn-preset.ativo', bs => bs.map(b => b.dataset.tema)), ['retro'], 'paleta salva');
    const retro = await page.evaluate(() => window.__t.temas.retro);
    igual(await pixelDaFace(page, 'front'), retro.front.toLowerCase(), 'textura restaurada');
    igual(await page.$$eval('.btn-vel.ativo', bs => bs.map(b => b.dataset.ms)), ['400'], 'velocidade salva');
    igual(await page.$eval('#timer-auto', e => e.checked), false, 'cronômetro automático salvo como desligado');
    igual(await page.evaluate(() => window.__t.cronometro.automatico), false, 'estado interno do cronômetro automático');

    await page.click('#top'); // foco no seletor de cor não pode quebrar nada
    await page.$eval('#top', (el) => {
        el.value = '#abcdef';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await recarregar();
    igual(await page.$eval('#top', e => e.value), '#abcdef', 'cor personalizada salva');
    igual(await page.$$eval('.btn-preset.ativo', bs => bs.length), 0, 'sem paleta marcada para cor personalizada');
});

await teste(browser, 'configuração salva corrompida é ignorada sem quebrar a página', async ({ page, recarregar }) => {
    for (const lixo of ['{isso nao é json', '{"cores":{"top":"red"}}', '123', '{"duracao":"rapido","cronometroAutomatico":"sim"}']) {
        await page.evaluate(v => localStorage.setItem('cuboMagico.config.v1', v), lixo);
        await recarregar();
        igual(await page.$eval('#top', e => e.value.toLowerCase()), '#ffffff', `cor padrão com config "${lixo}"`);
        igual(await page.$$eval('.btn-vel.ativo', bs => bs.map(b => b.dataset.ms)), ['240'], `velocidade padrão com config "${lixo}"`);
        afirmar(await page.$eval('#timer-auto', e => e.checked), `cronômetro automático padrão com config "${lixo}"`);
    }
});

// ---------------------------------------------------------------------------
await browser.close();
const falhas = resultados.filter(r => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} testes passaram.`);
if (falhas.length) {
    console.log('Falharam:\n  - ' + falhas.map(f => f.nome).join('\n  - '));
    process.exitCode = 1;
}
