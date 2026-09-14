# Refúgio das Aves — landing page (demonstração)

Página-conceito para o **Refúgio das Aves**, uma hospedagem com **duas cabanas**
— a **Cabana Maritaca** e a **Cabana Tucano** — numa clareira entre o campo
aberto e a borda da mata. Feita como amostra de design: um site de pousada que
não parece um template.

> **Aviso.** É uma demonstração. Nomes, textos, valores, depoimentos, distâncias
> e imagens são ilustrativos e não constituem oferta. As imagens são ilustrações
> vetoriais geradas para o projeto — não são fotografias da propriedade.

## Direção de arte

A ideia é uma **prancha de guia de campo**: papel claro, filetes finos, índices
numerados e um itálico serifado usado como destaque editorial. A página é clara
por padrão e escurece em quatro momentos — herói, “Um dia aqui”, “Hóspedes” e o
convite final — para quebrar o ritmo da rolagem.

- **Tipografia** — [Newsreader](https://fonts.google.com/specimen/Newsreader) nos
  títulos (o itálico é destaque, não ênfase);
  [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) no texto e
  na interface.
- **Cor** — papel, tinta e verde-mata, com **duas cores de identidade**: o verde
  da maritaca e o laranja do tucano. Cada cabana carrega a sua no índice, na
  etiqueta da foto, no itálico do título e no marcador da tabela comparativa.
  Os tokens ficam em `:root`; a classe `.mata` troca só os papéis semânticos e a
  página inteira se adapta, sem sobrescrever nenhum componente.
- **Imagens** — fotos da própria propriedade. O croqui da clareira e a cena da
  seção “As aves” continuam sendo SVGs gerados por `tools/gerar-cenas.mjs`.

## Estrutura

```
index.html               a página inteira, com dados estruturados JSON-LD
assets/css/main.css      folha única, organizada por camadas
assets/js/main.js        comportamento, sem dependências
assets/img/*.svg         cenas geradas (não edite à mão — regere)
assets/img/marca.svg     a marca, escrita à mão
tools/gerar-cenas.mjs    gerador das cenas e do croqui
```

## Rodar

Não há build. Qualquer servidor estático serve:

```sh
python3 -m http.server 8000    # depois: http://localhost:8000
```

Abrir o `index.html` direto pelo `file://` também funciona.

## O que trocar antes de publicar

Tudo o que é dado de negócio está em um lugar só, no topo de
`assets/js/main.js`:

```js
const CONTATO = {
  whatsapp: '5511999990000',                 // só dígitos, com DDI
  email: 'reservas@refugiodasaves.com.br',
};

const CABANAS = {
  maritaca: { nome: 'Cabana Maritaca', diaria: 540, maximo: 3 },
  tucano:   { nome: 'Cabana Tucano',   diaria: 690, maximo: 4 },
  qualquer: { nome: 'qualquer uma das duas', diaria: 540, maximo: 4 },
};
```

Fora daí, ainda são de demonstração e precisam de revisão: os preços repetidos
no HTML (herói, fichas, tabela e convite), as metragens e o número de camas de
cada cabana, a lista de aves e seus horários, os depoimentos, as distâncias da
seção “Como chegar” e o link do Google Maps (hoje é uma **busca** pelo nome,
nunca um endereço errado — troque por coordenadas reais).

## Como funciona a reserva

O formulário não fala com servidor nenhum. Ao enviar, ele monta o pedido — cabana,
datas, número de hóspedes e a estimativa — e abre dois caminhos: **WhatsApp**
(`wa.me`) e **e-mail** (`mailto:`), os dois já preenchidos. Nada é enviado sem a
pessoa clicar.

O contador de hóspedes respeita a lotação da cabana escolhida: trocar da Tucano
(até 4) para a Maritaca (até 3) reduz o número sozinho. Os botões “Consultar a
Maritaca / a Tucano”, nas fichas, escolhem a cabana antes de levar ao formulário.

## As fotos

As fotos da propriedade estão em `assets/img/`, com nomes que dizem onde cada
uma entra. O prefixo separa o que é de cada cabana do que é comum às duas:

| Prefixo | Onde aparece |
| --- | --- |
| `maritaca-*` | bloco da Cabana Maritaca e galeria |
| `tucano-*` | bloco da Cabana Tucano e galeria |
| `comum-*` | seção “Área comum” e galeria — **iguais nas duas cabanas** |
| `entorno-*` | galeria e fundo do convite |

Estão em AVIF (e uma em WebP), servidas direto, sem etapa de build. A única
imagem que ainda é ilustração é a da seção “As aves” (`aves.svg`): se um dia
houver uma foto de ave feita na propriedade, basta salvá-la como
`assets/img/foto-aves.webp` — a página testa o carregamento e troca sozinha,
sem alteração de código.

### Uma ressalva sobre resolução

A foto do herói (`maritaca-fachada-mata.avif`) tem **480 × 854 px**. Num monitor
grande ela é ampliada cerca de 3× e fica visivelmente macia; o véu escuro do
herói disfarça boa parte, mas não tudo. Se existir o original da câmera, vale
reexportá-lo com pelo menos 1920 px de largura e substituir o arquivo — o nome
e o recorte continuam os mesmos. Vale o mesmo para as fotos de 240 px da Tucano
(`tucano-rede`, `tucano-lareira`), que aparecem pequenas na galeria justamente
por isso.

## Regerar as imagens

As cenas nascem de uma semente (`seed`), então o resultado é determinístico:
rodar de novo produz exatamente os mesmos arquivos.

```sh
node tools/gerar-cenas.mjs
```

Com as fotos no ar, a lista `CENAS` no fim do arquivo produz só a cena das aves.
As demais continuam possíveis — basta acrescentar uma linha com nome, semente e
paleta. Paletas disponíveis: `alvorada`, `bruma`, `dourada`, `mata`, `noite`.

Cada cena é montada em camadas: céu, aves altas, faixas de mata (copas
arredondadas com araucárias e palmeiras emergentes), bruma entre as faixas, o
campo em primeiro plano, a cabana e, por último, o capim alto que passa na frente
dela. As duas cabanas têm silhuetas diferentes de propósito — `duas-aguas` para a
Maritaca, `agua-unica` para a Tucano — para que se distingam antes de alguém ler
o nome.

O croqui (`mapa.svg`) desenha a clareira, a mata em volta, a estrada de acesso e
as duas trilhas. Os dois marcos de cabana ficam em `(390, 414)` e `(608, 508)`
num desenho de `1000 × 1000`; os alfinetes do HTML usam esses mesmos valores em
porcentagem, em `.local__alfinete--maritaca` e `--tucano`. Mexeu num, mexa no
outro.

## Detalhes de implementação

- Sem framework e sem dependências: HTML, CSS e JS puros.
- Escala tipográfica fluida com `clamp()`; nenhum *breakpoint* mexe em tamanho de
  fonte.
- Revelação ao rolar e marcação da seção ativa via `IntersectionObserver`;
  paralaxe do herói em `requestAnimationFrame`.
- `prefers-reduced-motion` desliga todo o movimento, inclusive o paralaxe.
- Galeria acessível: arrasta com o ponteiro, rola com a roda (devolvendo a
  rolagem à página nas pontas) e navega pelo teclado.
- A tabela comparativa vira lista de fichas no celular, sem perder a semântica de
  `<table>` — os rótulos vêm de `data-rotulo`.
- FAQ em `<details>` nativo — funciona sem JS; o JS só fecha as outras.
- Foco visível em tudo, link para pular o conteúdo, ícones em `<svg>` com
  `aria-hidden`, uma única `<h1>`.
- Dados estruturados `LodgingBusiness` com as duas acomodações em `containsPlace`,
  e metatags Open Graph.
