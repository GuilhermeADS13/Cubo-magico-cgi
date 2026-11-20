# 🧊 Cubo Mágico 3D (Rubik's Cube) — Computação Gráfica

Projeto final prático desenvolvido para a disciplina de **Computação Gráfica** do curso de **Ciência da Computação** da Universidade Católica de Pernambuco (UNICAP), sob orientação do Prof. Pedro Ximenes.

O projeto consiste em uma simulação interativa tridimensional completa de um **Cubo Mágico 3×3×3** em **Three.js**, com câmera orbital, iluminação realista, física de agrupamento dinâmico via grafo de cena (`THREE.Group`), interpolação angular suave, eliminação de deriva numérica e detecção automática de vitória.

---

## 👥 Divisão Oficial da Equipe

| Integrante | Papel | Responsabilidades |
| :--- | :--- | :--- |
| **Guilherme Maciel** | Integrante 1 | **Estrutura 3D e Câmera:** Configuração da cena Three.js, perspectiva da câmera, iluminação direcional/ambiente, OrbitControls e instanciação da malha dos 27 cubinhos com materiais das 6 faces. |
| **Guilherme Raposo** | Integrante 2 | **Movimentação e Mecânicas:** Lógica de agrupamento dinâmico por coordenadas de mundo, rotação das 6 faces (U, D, L, R, F, B), animações com interpolação suave (cubic easing), ancoragem sem perda de precisão (zero drift), fila de movimentos assíncrona, algoritmo de embaralhar (scramble) e atalhos de teclado. |
| **Paulo Neto** | Integrante 3 | **Interface, Extras e Integração:** Interface de controles visuais, cronômetro e contador de movimentos, detecção matemática de vitória, paletas de cores personalizáveis em tempo real, integração dos módulos e documentação. |

---

## 🚀 Como Executar

O projeto foi construído para rodar diretamente no navegador de forma moderna e sem dependências pesadas de compilação.

### Opção 1: Abrir diretamente no navegador
Dê um duplo clique no arquivo `index.html` (ou abra via navegador Google Chrome, Firefox, Edge, Safari).

### Opção 2: Servidor local HTTP (Recomendado)
Para evitar restrições locais de segurança em alguns navegadores, execute no terminal dentro da pasta do projeto:

```bash
# Com Python 3:
python3 -m http.server 8080

# Ou com Node.js (se instalado):
npx serve .
```

Em seguida, acesse no navegador: `http://localhost:8080`

---

## 🎮 Controles e Interação

### 🖱️ Mouse
* **Clique com botão esquerdo + arrastar:** Orbita a câmera 3D em torno do cubo.
* **Scroll da roda do mouse:** Zoom in / Zoom out.

### ⌨️ Atalhos de Teclado
* <kbd>U</kbd> / <kbd>Shift</kbd>+<kbd>U</kbd>: Gira face Superior (**Up**) — Horário / Anti-horário.
* <kbd>D</kbd> / <kbd>Shift</kbd>+<kbd>D</kbd>: Gira face Inferior (**Down**) — Horário / Anti-horário.
* <kbd>L</kbd> / <kbd>Shift</kbd>+<kbd>L</kbd>: Gira face Esquerda (**Left**) — Horário / Anti-horário.
* <kbd>R</kbd> / <kbd>Shift</kbd>+<kbd>R</kbd>: Gira face Direita (**Right**) — Horário / Anti-horário.
* <kbd>F</kbd> / <kbd>Shift</kbd>+<kbd>F</kbd>: Gira face Frontal (**Front**) — Horário / Anti-horário.
* <kbd>B</kbd> / <kbd>Shift</kbd>+<kbd>B</kbd>: Gira face Traseira (**Back**) — Horário / Anti-horário.
* <kbd>Espaço</kbd>: Embaralha o cubo automaticamente com 20 movimentos.

### 🎛️ Painel na Tela
* **Botões de Rotação:** Botões rápidos na barra inferior para girar qualquer uma das 6 faces nos sentidos horário e anti-horário.
* **Embaralhar (Scramble):** Executa uma animação rápida com 20 giros randômicos não conflitantes.
* **Resetar:** Reconstrói o cubo instantaneamente ao estado resolvido original.
* **Paleta de Cores e Temas:** Permite customizar individualmente as cores das faces ou alternar entre temas predefinidos (*Clássico*, *Pastel*, *Cyberpunk*).
* **Seletor de Velocidade:** Alterne a velocidade das rotações entre *Suave* (400ms), *Padrão* (240ms) e *Rápido* (110ms).

---

## 🧠 Arquitetura Técnica e Conceitos de Computação Gráfica

### 1. Construção Procedural dos 27 Cubinhos (Grid 3×3×3)
Em vez de carregar um modelo único estático ou monolítico, o cubo mágico é montado a partir de 27 malhas (`THREE.Mesh`) independentes posicionadas no espaço discreto $(x, y, z) \in \{-1, 0, 1\}$.
* Cada cubinho recebe uma `THREE.BoxGeometry(0.95, 0.95, 0.95)`. O tamanho de 0.95 garante um vão realista de 0.05 entre as peças, simulando os canais plásticos de um cubo real.
* As faces internas recebem material preto fosco (`#141416`), e as faces externas recebem materiais com texturas de adesivos chanfrados geradas proceduralmente via HTML5 Canvas.

### 2. Agrupamento Dinâmico por Coordenadas de Mundo (`THREE.Group`)
Para girar uma face, é necessário identificar dinamicamente quais cubos pertencem a ela no instante atual.
* A função `obterCubinhosDaFace(face)` consulta `cubo.getWorldPosition(posMundo)`.
* Para a face **U** ($+Y$), seleciona os cubos onde $y_{mundo} > 0.5$. Para **D** ($-Y$), $y_{mundo} < -0.5$. O mesmo se aplica para **R** ($+X$), **L** ($-X$), **F** ($+Z$) e **B** ($-Z$).
* Cria-se um grupo pivô temporário (`grupoPivo = new THREE.Group()`) na origem $(0, 0, 0)$.
* Utiliza-se `grupoPivo.attach(cubo)` para cada um dos 9 cubinhos. O método `attach` do Three.js é fundamental pois altera a hierarquia preservando exatamente a transformação mundial (posição, rotação e escala) do objeto.

### 3. Interpolação Suave e Easing
A rotação é calculada a cada quadro via `requestAnimationFrame`:
$$\theta(t) = \theta_{alvo} \cdot f(t)$$
onde $t = \frac{\Delta \text{tempo}}{\text{duração}} \in [0, 1]$ e $f(t)$ é a função de atenuação cúbica (*Ease In-Out*):
$$f(t) = \begin{cases} 4t^3 & \text{se } t < 0.5 \\ 1 - \frac{(-2t + 2)^3}{2} & \text{se } t \ge 0.5 \end{cases}$$

### 4. Zero Drift e Eliminação de Erro Numérico
Em transformações 3D cumulativas, arredondamentos de ponto flutuante em funções trigonométricas ($\sin(\frac{\pi}{2})$, $\cos(\frac{\pi}{2})$) causam deformações após sucessivos giros.
Para garantir precisão matemática absoluta:
1. Ao término do giro, os cubos são reancorados à cena com `scene.attach(cubo)`.
2. As posições são truncadas para os inteiros ortogonais exatos:
   $$\vec{p} = (\text{round}(x), \text{round}(y), \text{round}(z))$$
3. A matriz de rotação $3 \times 3$ é alinhada ortogonalmente arredondando cada elemento das colunas de base para $\{-1, 0, 1\}$, reconstituindo o quaternion exato.

### 5. Fila de Movimentos Assíncrona (Move Queue)
Evita race conditions quando múltiplos botões ou teclas são pressionados em sequência, ou durante o processo de embaralhamento. Cada movimento é adicionado a uma fila FIFO (`filaMovimentos`), processando o próximo assim que o atual atinge 100% de conclusão.

### 6. Detecção de Vitória Invariante a Rotações Globais
A verificação de vitória não exige que o cubo esteja na orientação original absoluta; ela verifica a consistência das 6 faces exteriores:
* Para cada face normal canônica, obtém-se os 9 cubinhos.
* Calcula-se o produto escalar do vetor normal de cada adesivo no espaço de mundo com a normal da face $(\vec{n}_{adesivo} \cdot \vec{n}_{face} > 0.85)$.
* Se todos os 9 adesivos externos apontando para aquela face compartilharem o mesmo material, a face é considerada uniforme. Se as 6 faces forem uniformes, a vitória é declarada!

---

## 🤖 Declaração de Uso de Inteligência Artificial

Em conformidade com as instruções e exigências éticas do projeto:

* **Ferramenta utilizada:** Google Antigravity / Gemini 3.8.
* **Objetivo do uso:**
  1. Identificação do gargalo técnico do protótipo inicial (substituição do modelo `.glb` monolítico pela arquitetura procedural correta de 27 cubinhos em Three.js).
  2. Implementação das rotinas matemáticas de rotação via `THREE.Group` e cálculo de interpolação angular suave.
  3. Resolução da acumulação de erros de ponto flutuante nas rotações (snapping de coordenadas e matriz ortonormal).
  4. Formulação do algoritmo de detecção de vitória vetorial.
* **Prompts principais utilizados:**
  - *"Como agrupar dinamicamente os 9 cubinhos de uma face no Three.js usando `THREE.Group` e `attach` sem quebrar as transformações mundiais?"*
  - *"Como evitar acúmulo de erro de precisão numérica de ponto flutuante nas rotações sucessivas do cubo mágico em Three.js?"*
  - *"Implementação de interpolação suave com easing cúbico para animação de faces em Three.js."*
  - *"Lógica para detecção de vitória no cubo mágico 3D calculando a normal no espaço de mundo dos materiais de cada peça."*
