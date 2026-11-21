// ============================================================
//  CAMPANHAS (semente inicial). Depois do 1º salvamento no painel
//  /admin, as campanhas passam a viver no Redis e este arquivo é ignorado.
// ============================================================
//
// Campos:
//  id            identificador único (sem espaço)
//  ativa         true/false
//  palavras      palavras que disparam (sem diferença de maiúscula/acento).
//  posts         [] = vale para qualquer post/reels. Ou liste IDs de mídia.
//  linkDireto    true = a 1ª mensagem do direct já leva o botão com o link (recomendado)
//  exigirSeguir  true = só libera o link depois que a pessoa seguir a Pyros (não funciona com linkDireto)
//  respostasPublicas  uma é sorteada para responder o comentário em público.
//  dm.*          textos do direct. {nome} = @ da pessoa.

export const CAMPANHAS = [
  {
    id: 'checklist-dezembro',
    nome: 'Checklist de dezembro',
    ativa: true,
    palavras: ['DEZEMBRO'],
    posts: [],
    linkDireto: true,
    exigirSeguir: false,
    respostasPublicas: [
      'Te mandei no direct! 📩',
      'Acabei de te enviar o checklist no direct, {nome}! 🔥',
      'Corre no direct que o checklist já está lá! 📲',
    ],
    dm: {
      abertura:
        'Oi, {nome}! Aqui está o seu Checklist de Dezembro 🔥\n\n' +
        'São 3 passos para fechar o ano com a agenda cheia e o caixa em ordem: raio-x do mês, orçamentos parados e agenda de dezembro.\n\n' +
        'Toque no botão abaixo para abrir o PDF. Se quiser ajuda para colocar isso em prática na sua clínica, é só responder aqui.',
      botao: 'Quero o checklist',
      naoSegue: '',
      entrega: 'Aqui está o seu checklist 👇',
      link: 'https://pyros-insta-dm.vercel.app/materiais/checklist-dezembro-pyros.pdf',
      tituloLink: 'Abrir checklist',
    },
  },
];
