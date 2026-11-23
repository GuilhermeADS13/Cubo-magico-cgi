# Relatório de Projeto: Cubo Mágico 3D

\

**Universidade Católica de Pernambuco (UNICAP)** \
**Escola de Tecnologia e Comunicação** \
**Disciplina**: Computação Gráfica \
**Curso**: Ciência da Computação \
**Discente**: Pedro Ximenes

Alunos:

- Guilherme Maciel ()
- Guilherme Raposo Gonçalves de Melo Larré (00000860657)
- Paulo Barbosa Apolinário Neto (00000853095)

---

## 1. Divisão de tarefas

O projeto foi dividido entre os três integrantes conforme abaixo:

### Integrante 1: Guilherme Maciel

**Responsabilidade: Estrutura 3D e Câmera**

- Criação da cena tridimensional utilizando a biblioteca Three.js.
- Construção procedural do cubo 3×3×3 composto por 27 cubinhos independentes.
- Configuração das seis faces externas e mapeamento de materiais e texturas.
- Implementação da câmera com projeção perspectiva.
- Configuração do módulo OrbitControls para permitir órbita e zoom via mouse.
- Ajuste da iluminação de cena (luz ambiente e luzes direcionais).

### Integrante 2: Guilherme Raposo

**Responsabilidade: Movimentação e Mecânicas**

- Desenvolvimento da lógica de agrupamento dinâmico dos 9 cubinhos pertencentes a cada face por meio de coordenadas no espaço de mundo.
- Implementação da rotação das 6 faces (U, D, L, R, F, B) em sentidos horário e anti-horário.
- Criação de animações suaves baseadas em interpolação angular com função de atenuação (cubic easing).
- Mecanismo de preservação de transformações e eliminação de deriva numérica (zero drift) ao ancorar os cubos de volta à cena.
- Implementação de uma fila assíncrona de movimentos (Move Queue) para evitar condições de corrida.
- Implementação do algoritmo e botão de embaralhar (scramble) com sequência de 20 movimentos válidos.
- Configuração dos atalhos de teclado para teste e controle das movimentações.
- Escrita do relatório final (relatorio.pdf)

### Integrante 3: Paulo Neto

**Responsabilidade: Interface, Extras e Integração**

- Construção da interface gráfica de usuário sobreposta em HTML/CSS.
- Implementação do contador de movimentos efetuados pelo jogador.
- Implementação do cronômetro com funções de iniciar, pausar, continuar e zerar, além da inicialização automática configurável.
- Desenvolvimento do algoritmo de detecção matemática de vitória invariante à orientação global.
- Criação do painel de personalização de cores com seletores individuais e paletas predefinidas (Clássico, Pastel, Cyberpunk, Retrô e Daltônico).
- Persistência das configurações no navegador via localStorage.
- Integração final dos módulos, correções de eventos de interface e documentação do repositório (README.md).

## 2. O que foi implementado

O projeto atende a todos os requisitos mínimos e extras propostos para a simulação:

### 2.1 Requisitos mínimos

- **Estrutura 3×3×3**: construída com 27 malhas cúbicas individuais (BoxGeometry de dimensão 0.95 com espaçamento 1.0), gerando os canais visuais característicos entre as peças.
- **Cores por face**: faces internas pretas e faces externas renderizadas com texturas que simulam adesivos plásticos com bordas chanfradas geradas via HTML5 Canvas. Cores padrão: Topo (Branco), Base (Amarelo), Frente (Azul), Trás (Verde), Direita (Vermelho) e Esquerda (Laranja).
- **Câmera 3D e OrbitControls**: navegação interativa com clique e arraste para orbitar o cubo e roda do mouse para aproximar ou afastar a visualização.
- **Rotação das faces**: todas as 6 faces são rotacionáveis tanto em sentido horário quanto anti-horário, superando o mínimo exigido de apenas duas faces.
- **Animação suave**: interpolação de ângulo no laço principal de renderização utilizando atenuação cúbica (ease in-out), permitindo transições fluidas a 60 quadros por segundo.

### 2.2 Requisitos extras implementados

- **Rotação de todas as 6 faces**: integração completa dos eixos cartesianos X, Y e Z para os giros U, D, L, R, F e B.
- **Botão de embaralhar**: algoritmo que gera 20 movimentos aleatórios sucessivos, garantindo que a mesma face não seja rotacionada duas vezes consecutivas, executados com animação acelerada.
- **Detecção automática de vitória**: verificação vetorial da orientação das faces exteriores. Quando o cubo é resolvido a partir de um estado embaralhado, exibe modal comemorativo com resumo de movimentos e tempo gasto.
- **Contador de movimentos**: registro numérico incremental das jogadas realizadas manualmente.
- **Cronômetro opcional**: medição de tempo com suporte a pausa, retomada e opção de disparo automático no primeiro movimento após embaralhar.
- **Temas de cores customizáveis**: cinco paletas prontas, incluindo uma paleta acessível para daltonismo (baseada na escala Okabe-Ito), além de seletores de cores em tempo real com persistência no localStorage.
- **Seletor de velocidade**: ajuste da duração da animação em três níveis (Suave - 400 ms, Padrão - 240 ms, Rápido - 110 ms).
- **Atalhos de teclado ergonômicos**: teclas U, D, L, R, F, B para sentido horário; combinação com Shift para sentido anti-horário; tecla Espaço para embaralhar; tecla T para pausar ou retomar o cronômetro.

## 3. Dificuldades encontradas e soluções adotadas

Durante as etapas de modelagem, transformações geométricas e integração, a equipe enfrentou os seguintes desafios técnicos:

### 3.1 Modelo 3D Monolítico vs. Malha de 27 Cubinhos

- **Dificuldade**: Na versão inicial do projeto, foi tentado o uso de um modelo 3D externo em formato .glb gerado por ferramenta de inteligência artificial. No entanto, ao analisar a hierarquia do arquivo, constatou-se que se tratava de uma malha única e estática. Essa estrutura impedia a seleção e rotação independente das camadas do cubo, violando os requisitos do projeto.
- **Solução**: O modelo externo foi descartado e a geometria foi totalmente refeita de forma procedural no próprio Three.js, instanciando 27 malhas individuais posicionadas nas coordenadas discretas (-1, 0, 1) em X, Y e Z. As texturas dos adesivos foram geradas dinamicamente em Canvas 2D para manter alta fidelidade visual sem dependência de arquivos de imagem externos.

### 3.2 Agrupamento Dinâmico e Escopo de Transformação no Grafo de Cena

- **Dificuldade**: Em um cubo mágico real, as peças trocam continuamente de posição. Portanto, não é possível associar cubinhos a uma face por índices de array fixos. Além disso, ao adicionar um cubinho a um THREE.Group utilizando o método padrão group.add(cubo), as coordenadas locais do cubinho eram recalculadas em relação ao novo pai, provocando saltos visuais e distorção de posição.
- **Solução**: Implementou-se a função obterCubinhosDaFace(face), que consulta a posição absoluta de cada cubo no espaço de mundo (método getWorldPosition). Um limiar de 0.5 nas coordenadas X, Y ou Z identifica os 9 cubos exatos da camada ativa. Para a montagem do grupo pivô, utilizou-se o método group.attach(cubo), que altera a hierarquia do grafo de cena preservando intacta a matriz de transformação de mundo (matrixWorld) do objeto. Após a rotação, os cubos são desanexados utilizando scene.attach(cubo).

### 3.3 Acúmulo de Erro de Ponto Flutuante (Deriva Numérica / Zero Drift)

- **Dificuldade**: Transformações trigonométricas sucessivas de rotação (aplicações repetidas de senos e cossenos para ângulos de 90 graus) acumulam microerros de precisão de ponto flutuante na GPU/CPU. Após várias dezenas de giros, os cubos começavam a perder o alinhamento reto, gerando folgas, desalinhamentos visuais e falha nas consultas de posição de mundo.
- **Solução**: Ao final de cada animação de giro, além de ancorar as peças de volta à cena, foi implementada uma etapa de alinhamento ortogonal ("snapping"):
  1. A posição tridimensional é arredondada para os inteiros mais próximos: x = Math.round(x), y = Math.round(y), z = Math.round(z).
  2. A matriz de rotação 3×3 derivada do quaternion da peça é extraída, e cada um dos componentes de seus vetores diretores é arredondado para {-1, 0, 1}, restabelecendo uma orientação ortonormal perfeita sem qualquer deformação.

### 3.4 Concorrência de Movimentos e Fila Assíncrona

- **Dificuldade**: Quando o usuário pressionava várias teclas em sucessão rápida ou acionava o botão de embaralhamento, uma nova rotação iniciava antes que a anterior tivesse terminado. Isso tentava reagrupar cubos que ainda estavam com o pivô em movimento, corrompendo a estrutura do cubo.
- **Solução**: Desenvolveu-se uma fila assíncrona (FIFO) de comandos de movimentação. Sempre que uma face é acionada, os parâmetros do movimento são enfileirados. O sistema executa apenas uma rotação por vez; ao término exato da animação, um callback consome o próximo item da fila. Durante o processo de embaralhar, as ações concorrentes do usuário são temporariamente desabilitadas.

### 3.5 Detecção de Vitória Independente da Orientação Global

- **Dificuldade**: Verificar a vitória comparando a posição de cada cubinho com sua posição inicial de montagem é incorreto, pois o jogador pode resolver o cubo em qualquer rotação global (por exemplo, com a face amarela no topo em vez da branca).
- **Solução**: A verificação foi baseada na consistência cromática das faces exteriores. Para cada um dos 6 vetores normais canônicos (+X, -X, +Y, -Y, +Z, -Z), o algoritmo coleta os 9 cubos posicionados naquela extremidade e calcula o produto escalar entre a normal da face e as normais mundiais de cada uma das 6 faces do cubinho. Quando o produto escalar é superior a 0.85, identifica-se o adesivo apontado para fora. Se todos os 9 cubos de uma face exibirem o mesmo material, a face é declarada uniforme. Se as 6 faces forem uniformes simultaneamente, a vitória é confirmada.

### 3.6 Conflitos de Eventos de Teclado no Navegador

- **Dificuldade**: Teclas de atalho comumente usadas no navegador, como Ctrl+R (recarregar página), acionavam indevidamente o giro da face R (Right). Da mesma forma, a repetição automática de eventos de tecla pressionada (keyboard repeat) enchia a fila de movimentos involuntariamente.
- **Solução**: Foram inseridas condições no ouvinte de eventos de teclado (keydown) para ignorar disparos repetidos (e.repeat) e combinações com teclas modificadoras (ctrlKey, metaKey, altKey), garantindo que apenas ações intencionais de jogo sejam processadas.

## 4. Declaração de uso de Inteligência Artificial

Conforme as instruções gerais do projeto, declara-se o uso de ferramentas de inteligência artificial como assistentes de desenvolvimento, distribuído entre os integrantes:

### 4.1 Google Antigravity / Gemini 3.8

- **Integrante**: Guilherme Raposo (Movimentação e Mecânicas)
- **Finalidade**:
  - Diagnóstico da falha estrutural do arquivo .glb monolítico e formulação da arquitetura das 27 peças individuais.
  - Desenvolvimento das rotinas matemáticas de rotação com THREE.Group e cálculo de interpolação suave com atenuação cúbica.
  - Implementação do algoritmo de eliminação de erro numérico de ponto flutuante (snapping de coordenadas e matriz ortonormal).
  - Estruturação da fila assíncrona de movimentos (Move Queue) e formulação do cálculo de produto escalar para detecção de vitória.
- **Prompts principais utilizados**:
  - O registro completo da conversa está em `chat antigravity.md`.

### 4.2 Claude Sonnet 5.5 (Anthropic)

- **Integrante**: Paulo Neto (Interface, Extras e Integração)
- **Finalidade**:
  - Diagnóstico do cronômetro que não iniciava: ele só começava depois de usar o botão Embaralhar. Foi refeito como cronômetro opcional, com iniciar/pausar/continuar/zerar e início automático configurável.
  - Correções de integração: tecla `Ctrl+R` (e outros atalhos do navegador) girando o cubo em vez de funcionar; Espaço pressionado durante o embaralhamento empilhando embaralhamentos; Resetar durante o embaralhamento deixando uma "partida fantasma"; aviso de vitória reaparecendo; cubo parcialmente escondido atrás do painel inferior.
  - Temas de cores: duas novas paletas (Retrô e Daltônico), destaque da paleta ativa e persistência das preferências em `localStorage`.
- **Prompts principais utilizados**:
  - "como fazer um timer e também temas de cores `index.html`"

### 4.3 Claude (Anthropic)

- **Integrante**: Guilherme Maciel (Estrutura 3D e Câmera)
- **Finalidade**:
  - Suporte inicial na configuração da cena 3D básica e cálculo do posicionamento dos cubinhos.
  - Orientação na configuração dos parâmetros de câmera de projeção perspectiva e OrbitControls.
- **Prompt principal utilizado**:
  - "Configuração da cena 3D calculando os 27 cubinhos para implementar a câmera 3d para a configuração do orbitcontrols garantindo assim a visualização correta do cubo"

---

## 5. Instruções para execução

1. O projeto é totalmente autônomo e não requer processos de compilação ou instaladores.
2. Para executar, basta abrir o arquivo `index.html` em qualquer navegador web moderno conectado à internet (necessário para o carregamento do Three.js via CDN).
