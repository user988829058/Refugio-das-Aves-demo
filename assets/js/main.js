/* =========================================================================
   Refúgio das Aves — comportamento da página.
   Sem dependências. Tudo degrada com elegância se o JS não rodar.
   ========================================================================= */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --------------------------------------------------------------- dados -- */

  /* Trocar por dados reais antes de publicar. O formulário monta o pedido
     a partir daqui — nenhum destes valores aparece escrito no HTML. */
  const CONTATO = {
    whatsapp: '5511999990000',                   // só dígitos, com DDI
    email: 'reservas@refugiodasaves.com.br',
  };

  const CABANAS = {
    maritaca: { nome: 'Cabana Maritaca', diaria: 590, maximo: 4 },
    tucano:   { nome: 'Cabana Tucano',   diaria: 540, maximo: 4 },
    qualquer: { nome: 'qualquer uma das duas', diaria: 540, maximo: 4 },
  };

  /* ------------------------------------------------------------- rodapé -- */

  const ano = $('#ano');
  if (ano) ano.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------- cabeçalho -- */

  const topo = $('#topo');
  const menu = $('#menu');
  const hamburguer = $('.hamburguer');
  const secoes = $$('main section[id]');
  const elosMenu = $$('.menu a');

  const fecharMenu = () => {
    menu?.classList.remove('aberto');
    hamburguer?.setAttribute('aria-expanded', 'false');
    hamburguer?.setAttribute('aria-label', 'Abrir menu');
  };

  hamburguer?.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    hamburguer.setAttribute('aria-expanded', String(aberto));
    hamburguer.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  });

  elosMenu.forEach((a) => a.addEventListener('click', fecharMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });

  /* Marca a seção visível no menu — um observador, não um listener de scroll. */
  if (secoes.length && 'IntersectionObserver' in window) {
    const espiao = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        const alvo = `#${e.target.id}`;
        elosMenu.forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === alvo));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secoes.forEach((s) => espiao.observe(s));
  }

  /* --------------------------------------------------- revelar ao rolar -- */

  const aRevelar = $$('[data-revelar]');
  if (!('IntersectionObserver' in window) || semMovimento.matches) {
    aRevelar.forEach((el) => el.classList.add('visivel'));
  } else {
    aRevelar.forEach((el) => {
      const atraso = el.dataset.revelarAtraso;
      if (atraso) el.style.setProperty('--atraso', atraso);
    });
    const observador = new IntersectionObserver((entradas, obs) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('visivel');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    aRevelar.forEach((el) => observador.observe(el));
  }

  /* ------------------------------------------- paralaxe do herói + topo -- */

  const camadas = $$('[data-parallaxe]');
  let pendente = false;

  const aoRolar = () => {
    const y = window.scrollY;
    topo?.classList.toggle('encolhido', y > 40);

    if (!semMovimento.matches && y < window.innerHeight * 1.3) {
      camadas.forEach((el) => {
        const fator = parseFloat(el.dataset.parallaxe) || 0;
        el.style.transform = `translate3d(0, ${(y * fator).toFixed(2)}px, 0)`;
      });
    }
    pendente = false;
  };

  window.addEventListener('scroll', () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(aoRolar);
  }, { passive: true });
  aoRolar();

  /* ----------------------------------------------- fotos da propriedade -- */

  /* As fotos das cabanas e da área comum já estão no HTML. O que sobra aqui é a
     cena ilustrada das aves, que ainda espera uma foto: basta o arquivo existir
     em assets/img/ com o nome esperado. Se não existir, a ilustração continua no
     lugar — sem ícone de imagem quebrada e sem alteração de layout. */

  const existe = (caminho) => new Promise((resolve) => {
    const teste = new Image();
    teste.addEventListener('load',  () => resolve(true));
    teste.addEventListener('error', () => resolve(false));
    teste.src = caminho;
  });

  /* A imagem declara no HTML o arquivo que a substitui. */
  $$('[data-foto]').forEach((img) => {
    const caminho = `assets/img/${img.dataset.foto}`;
    existe(caminho).then((ok) => {
      if (!ok) return;
      img.src = caminho;
      img.classList.add('tem-foto');
      img.closest('figure')?.classList.add('tem-foto');
    });
  });

  /* ------------------------------------------------------------ reserva -- */

  const DIA = 86400000;

  const form     = $('#form-reserva');
  const cabana   = $('#cabana');
  const entrada  = $('#entrada');
  const saida    = $('#saida');
  const hospedes = $('#hospedes');
  const resumo   = $('#resumo-reserva');
  const bloco    = $('#saida-reserva');

  const emISO = (d) => d.toISOString().slice(0, 10);
  const dinheiro = (v) => v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  });
  // Meio-dia de propósito: evita que o fuso jogue a data para o dia anterior.
  const porExtenso = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
  });

  if (form && cabana && entrada && saida && hospedes && resumo) {
    /* Padrão: a próxima sexta até domingo. */
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const ateSexta = (5 - hoje.getDay() + 7) % 7 || 7;
    const sexta = new Date(hoje.getTime() + ateSexta * DIA);
    const domingo = new Date(sexta.getTime() + 2 * DIA);

    entrada.min = emISO(hoje);
    saida.min = emISO(new Date(hoje.getTime() + DIA));
    entrada.value = emISO(sexta);
    saida.value = emISO(domingo);

    let numeroHospedes = 2;

    const escolhida = () => CABANAS[cabana.value] ?? CABANAS.qualquer;

    const noites = () => {
      const a = new Date(entrada.value);
      const b = new Date(saida.value);
      if (Number.isNaN(+a) || Number.isNaN(+b)) return 0;
      return Math.max(0, Math.round((b - a) / DIA));
    };

    const plural = (q, s, p) => `${q} ${q === 1 ? s : p}`;

    const esconderSaida = () => { if (bloco) bloco.hidden = true; };

    const atualizar = () => {
      // A saída nunca pode ser anterior à entrada: corrige em silêncio.
      if (entrada.value) {
        const minSaida = new Date(new Date(entrada.value).getTime() + DIA);
        saida.min = emISO(minSaida);
        if (saida.value && new Date(saida.value) <= new Date(entrada.value)) {
          saida.value = emISO(minSaida);
        }
      }

      const c = escolhida();
      const n = noites();

      if (!n) {
        resumo.innerHTML = `<b>Escolha as datas</b><span>estimativa a partir de ${dinheiro(c.diaria).replace(' ', '&nbsp;')}/noite</span>`;
        return;
      }
      resumo.innerHTML = `<b>${dinheiro(n * c.diaria)}</b>`
        + `<span>${plural(n, 'noite', 'noites')} · ${plural(numeroHospedes, 'hóspede', 'hóspedes')} · estimativa</span>`;
    };

    /* O contador respeita a lotação da cabana escolhida. */
    const limitarHospedes = () => {
      const max = escolhida().maximo;
      if (numeroHospedes > max) numeroHospedes = max;
      hospedes.textContent = String(numeroHospedes);
      $$('.passos button').forEach((b) => {
        const passo = Number(b.dataset.passo);
        b.disabled = (passo < 0 && numeroHospedes === 1) || (passo > 0 && numeroHospedes === max);
      });
    };

    $$('.passos button').forEach((b) => {
      b.addEventListener('click', () => {
        const max = escolhida().maximo;
        numeroHospedes = Math.min(max, Math.max(1, numeroHospedes + Number(b.dataset.passo)));
        limitarHospedes();
        esconderSaida();
        atualizar();
      });
    });

    [cabana, entrada, saida].forEach((campo) => {
      campo.addEventListener('change', () => {
        limitarHospedes();
        esconderSaida();
        atualizar();
      });
    });

    limitarHospedes();
    atualizar();

    /* Os botões das fichas escolhem a cabana antes de levar ao formulário. */
    $$('[data-escolher]').forEach((elo) => {
      elo.addEventListener('click', () => {
        cabana.value = elo.dataset.escolher;
        cabana.dispatchEvent(new Event('change'));
      });
    });

    /* O envio monta o pedido e oferece os dois caminhos de contato. Nada é
       enviado sem a pessoa clicar: o formulário não fala com servidor nenhum. */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = noites();
      if (!n) { entrada.focus(); return; }

      const c = escolhida();
      const periodo = `${porExtenso(entrada.value)} a ${porExtenso(saida.value)}`;
      const estimativa = dinheiro(n * c.diaria);

      const mensagem = `Olá! Gostaria de consultar a disponibilidade da ${c.nome} `
        + `de ${periodo} (${plural(n, 'noite', 'noites')}), para ${plural(numeroHospedes, 'hóspede', 'hóspedes')}.`;

      const texto = $('#texto-reserva');
      if (texto) {
        texto.innerHTML = `<b>${c.nome}</b> · ${periodo} · ${plural(n, 'noite', 'noites')} · `
          + `${plural(numeroHospedes, 'hóspede', 'hóspedes')} · estimativa ${estimativa}. `
          + 'Escolha por onde prefere enviar o pedido:';
      }

      const zap = $('#reserva-whatsapp');
      if (zap) zap.href = `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(mensagem)}`;

      const correio = $('#reserva-email');
      if (correio) {
        const assunto = `Reserva — ${c.nome} — ${periodo}`;
        correio.href = `mailto:${CONTATO.email}`
          + `?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
      }

      if (bloco) {
        bloco.hidden = false;
        bloco.scrollIntoView({ block: 'nearest', behavior: semMovimento.matches ? 'auto' : 'smooth' });
      }
    });
  }

  /* ------------------------------------------------------------ galeria -- */

  const pista = $('#pista-galeria');
  const progresso = $('#progresso-galeria');

  if (pista) {
    const avanco = () => {
      if (!progresso) return;
      const percorrivel = pista.scrollWidth - pista.clientWidth;
      const p = percorrivel > 0 ? pista.scrollLeft / percorrivel : 0;
      progresso.style.transform = `translateX(${(p * (100 / 0.18 - 100)).toFixed(2)}%)`;
    };
    pista.addEventListener('scroll', avanco, { passive: true });
    avanco();

    /* Arrastar com o ponteiro — sem sequestrar o toque, que já funciona. */
    let arrastando = false;
    let x0 = 0;
    let s0 = 0;

    pista.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      arrastando = true;
      x0 = e.clientX;
      s0 = pista.scrollLeft;
      pista.classList.add('arrastando');
      pista.setPointerCapture(e.pointerId);
    });

    pista.addEventListener('pointermove', (e) => {
      if (!arrastando) return;
      e.preventDefault();
      pista.scrollLeft = s0 - (e.clientX - x0);
    });

    const soltar = (e) => {
      if (!arrastando) return;
      arrastando = false;
      pista.classList.remove('arrastando');
      if (e.pointerId != null && pista.hasPointerCapture?.(e.pointerId)) {
        pista.releasePointerCapture(e.pointerId);
      }
    };
    pista.addEventListener('pointerup', soltar);
    pista.addEventListener('pointercancel', soltar);

    /* Roda vertical vira rolagem horizontal — só quando há para onde ir. */
    pista.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const limite = pista.scrollWidth - pista.clientWidth;
      const proximo = pista.scrollLeft + e.deltaY;
      if (proximo <= 0 || proximo >= limite) return;  // devolve a rolagem à página
      e.preventDefault();
      pista.scrollLeft = proximo;
    }, { passive: false });

    /* Teclado: setas percorrem a galeria, imagem a imagem. */
    pista.addEventListener('keydown', (e) => {
      const passo = pista.querySelector('figure')?.getBoundingClientRect().width ?? 320;
      if (e.key === 'ArrowRight') { e.preventDefault(); pista.scrollBy({ left: passo, behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); pista.scrollBy({ left: -passo, behavior: 'smooth' }); }
    });
  }

  /* ------------------------------------------------------------ sanfona -- */

  /* Abrir uma pergunta fecha as demais — mas o <details> continua nativo. */
  const sanfona = $('.sanfona');
  sanfona?.addEventListener('toggle', (e) => {
    const alvo = e.target;
    if (!(alvo instanceof HTMLDetailsElement) || !alvo.open) return;
    $$('details', sanfona).forEach((d) => { if (d !== alvo) d.open = false; });
  }, true);
})();
