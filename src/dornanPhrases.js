// Озвученные фразы сержанта Арка Дорнана (Fallout 2, Ccdrill.msg, русская локализация 1С)
// Все реплики привязаны к локальным OGG-файлам в assets/dornan/

export const DORNAN_VOICED_PHRASES = [
  {
    id: 'greeting',
    audio: '../assets/dornan/greeting.ogg',
    category: 'intro',
    text: 'Добро пожаловать в лагерь Наварро. Итак, прибыло пополнение... Вы одеты не по форме, солдат. Где ваша силовая броня?'
  },
  {
    id: '510_years',
    audio: '../assets/dornan/510_years.ogg',
    category: 'rant',
    text: 'Вот как? И вы думаете, я этому поверю, салага? Вот она правда: вы допустили потерю дорогостоящего обмундирования. Его стоимость будет вычтена из вашего жалованья, и вы будете служить, пока вам не исполнится пятьсот десять лет, потому что вам понадобится именно столько лет, чтобы оплатить комплект Силовой боевой брони модель II, который вы потеряли! Доложите об этом в арсенале, получите новый комплект, а затем вернитесь и доложите мне, рядовой! Свободны!'
  },
  {
    id: 'sergeant',
    audio: '../assets/dornan/sergeant.ogg',
    category: 'order',
    text: 'Я вам не сэр. Я сам зарабатываю себе на жизнь, и-ди-от. Будете звать меня «сержант», или «сержант Дорнан». Ты меня понимаешь?'
  },
  {
    id: 'my_orders',
    audio: '../assets/dornan/my_orders.ogg',
    category: 'order',
    text: 'И-ди-от, не сметь обсуждать приказы начальства! Скажу прыгать, будешь прыгать! Скажу драться, будешь драться! Скажу умереть за Родину, умрёшь без разговоров! Я ясно излагаю?'
  },
  {
    id: 'civilian',
    audio: '../assets/dornan/civilian.ogg',
    category: 'alert',
    execute: true,
    text: 'Добро пожаловать в лагерь Наварро... штатский! Какого хрена на базе делает штатский?! Ох, и надеру я кому-то задницу! Уберите этого штатского с правительственной территории.'
  },
  {
    id: 'civilians',
    audio: '../assets/dornan/civilians.ogg',
    category: 'alert',
    execute: true,
    text: 'Добро пожаловать в лагерь Наварро... штатские! Какого хрена на базе делают штатские?! Ох, и надеру я кому-то задницу! Уберите этих штатских с правительственной территории.'
  },
  {
    id: 'civilian2',
    audio: '../assets/dornan/civilian2.ogg',
    category: 'combat',
    execute: true,
    text: 'Чёрт меня побери. Я выставил вас с этой базы, а вы снова тут как тут. Нет, вы не штатский. Вы, скорее всего, шпион! Врубайте тревогу и кончайте с этой личинкой!'
  },
  {
    id: 'civilians2',
    audio: '../assets/dornan/civilians2.ogg',
    category: 'combat',
    execute: true,
    text: 'Чёрт меня побери. Я выставил вашу компанию с этой базы, а вы снова тут как тут. Нет, вы не штатские. Вы, скорее всего, шпионы! Врубайте тревогу и кончайте с этой дрянью!'
  },
  {
    id: 'name',
    audio: '../assets/dornan/name.ogg',
    category: 'intro',
    text: 'Добро пожаловать в лагерь Наварро. Итак, прибыло пополнение. Как вас зовут, рядовой?'
  },
  {
    id: 'idiot',
    audio: '../assets/dornan/idiot.ogg',
    category: 'order',
    text: 'Ну вот, чудесно. Они мне прислали и-ди-ота. Слушай сюда. Будешь охранять ангар. Там твой пост. Пойдёшь туда и будешь стоять, пока не получишь другой приказ. А теперь вперёд, солдат!'
  },
  {
    id: 'maggot',
    audio: '../assets/dornan/maggot.ogg',
    category: 'idle',
    text: 'Что такое? Что тебе нужно, салага?'
  },
  {
    id: 'mission',
    audio: '../assets/dornan/mission.ogg',
    category: 'order',
    text: 'Великолепно. Рысью в ангар, там будет ваш пост. Работа сложная. Понятно?'
  },
  {
    id: 'paper_shuffling',
    audio: '../assets/dornan/paper_shuffling.ogg',
    category: 'rant',
    text: 'Вот бумагомараки! Как, чёрт их побери, я должен командовать охраной, если они даже обмундирования мне не дают! Рысью в арсенал, получить обмундирование и обратно ко мне, с докладом. Свободны!'
  },
  {
    id: 'like_you',
    audio: '../assets/dornan/like_you.ogg',
    category: 'rant',
    text: 'Если ты мне понравишься, можешь звать меня «серж». Но знаешь что? Ты мне не нравишься! Понятно?'
  },
  {
    id: 'with_pa',
    audio: '../assets/dornan/with_pa.ogg',
    category: 'intro',
    text: 'Отлично! Вы теперь одеты по форме, и я предоставлю вам уникальную возможность. Мы начнём всё сначала, как будто я никогда не видел вашей противной рожи. Нравится такой вариант, солдат?'
  },
  {
    id: 'get_out',
    audio: '../assets/dornan/get_out.ogg',
    category: 'rant',
    text: 'Рядовой, вы всё ещё без формы. Я дал вам прямой приказ пойти и получить обмундирование. А ну прочь с глаз моих, и не сметь показываться, пока не будете выглядеть как солдат, а не как чучело огородное!'
  },
  {
    id: 'uniform',
    audio: '../assets/dornan/uniform.ogg',
    category: 'alert',
    execute: true,
    text: 'Вы уже второй раз попадаетесь мне без формы, солдат. Третьего раза не будет!'
  },
  {
    id: 'post',
    audio: '../assets/dornan/post.ogg',
    category: 'idle',
    text: 'Солдат, что вы тут делаете? А ну-ка марш на пост!'
  },
  {
    id: 'post2',
    audio: '../assets/dornan/post2.ogg',
    category: 'alert',
    execute: true,
    text: 'И-ди-от. Ещё раз увижу тебя не на посту, и это будет самый грустный день в твоей коротенькой жизни!'
  },
  {
    id: 'danger',
    audio: '../assets/dornan/danger.ogg',
    category: 'combat',
    execute: true,
    text: 'Вы опасны для всех нас. Сейчас с этим будет покончено.'
  },
  {
    id: 'document',
    audio: '../assets/dornan/document.ogg',
    category: 'alert',
    text: 'На базе тревога, а я вас не узнаю. Предъявите документы, солдат.'
  },
  {
    id: 'documents',
    audio: '../assets/dornan/documents.ogg',
    category: 'alert',
    text: 'Неверный ответ, салага. Солдат должен всегда иметь документы при себе, и вам это отлично известно!'
  }
];

export const ALL_DORNAN_PHRASES = [...DORNAN_VOICED_PHRASES];

export function pickDornanPhrase(preferredCategories = null, onlyExecute = null) {
  let pool = ALL_DORNAN_PHRASES;
  if (onlyExecute === true) {
    const execPool = pool.filter((p) => Boolean(p.execute));
    if (execPool.length > 0) pool = execPool;
  } else if (onlyExecute === false) {
    const normPool = pool.filter((p) => !p.execute);
    if (normPool.length > 0) pool = normPool;
  }
  if (preferredCategories && preferredCategories.length > 0) {
    const filtered = pool.filter((p) => preferredCategories.includes(p.category));
    if (filtered.length > 0) pool = filtered;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
