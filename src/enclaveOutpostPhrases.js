// Все реплики Часового у ворот Наварро (CCGGUARD.MSG) и Офицера связи Анклава (Gcpacoff.msg)
// Fallout 2 (русская локализация 1С) с привязкой к локальным OGG-аудиофайлам

export const GUARD_VOICED_PHRASES = [
  {
    id: 'guard_password_request',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/password_request.ogg',
    category: 'intro',
    text: 'Стоять! Это федеральная собственность — без разрешения вход воспрещён.'
  },
  {
    id: 'guard_get_out',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/get_out.ogg',
    category: 'rant',
    text: 'Ты тормоз, так, что ли? Давай, вали отсюда и больше не возвращайся. И будешь в порядке. Понятно?'
  },
  {
    id: 'guard_stupid',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/stupid.ogg',
    category: 'rant',
    execute: true,
    text: 'Ни у кого... Чёрт. Внутрь нужен пропуск. У тебя нет пропуска. У-хо-ди. Не уйдёшь, будет больно. Понятно?'
  },
  {
    id: 'guard_pass_or_password',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/pass_or_password.ogg',
    category: 'alert',
    text: 'Не придумывай предлоги! Либо покажи мне пропуск, либо скажи пароль!'
  },
  {
    id: 'guard_proper_authorization',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/proper_authorization.ogg',
    category: 'order',
    text: 'Я предлагаю вам немедленно покинуть это место и не возвращаться без соответствующего разрешения. Я ясно выражаюсь?'
  },
  {
    id: 'guard_password',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/password.ogg',
    category: 'intro',
    text: 'Понятно. Пароль?'
  },
  {
    id: 'guard_no_entourage',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/no_entourage.ogg',
    category: 'order',
    text: 'Понятно. Новобранцы должны являться на пункт сбора поодиночке. Я предлагаю вам немедленно покинуть это место и вернуться без эскорта. Я ясно выражаюсь?'
  },
  {
    id: 'guard_come_on',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/come_on.ogg',
    category: 'salute',
    text: 'Один момент. Хорошо, я вас пропущу. Доложитесь разводящему сержанту. Идите через ворота, пройдёте собачий питомник, и первая дверь направо.'
  },
  {
    id: 'guard_idiots',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/idiots.ogg',
    category: 'idle',
    text: 'Проклятые идиоты, с каждым часом всё тупее.'
  },
  {
    id: 'guard_greeting_alone',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/greeting_alone.ogg',
    category: 'intro',
    text: 'Стоять! О, я вижу, вы вернулись, и на этот раз в одиночестве. Ну хорошо, новобранец, назовите пароль!'
  },
  {
    id: 'guard_companion',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/companion.ogg',
    category: 'alert',
    text: 'Стоять! Опять вы. Я вижу, ваши дружки всё ещё с вами. Я предлагаю вам немедленно покинуть это место и больше не возвращаться. Я ясно выражаюсь?'
  },
  {
    id: 'guard_greeting',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/greeting.ogg',
    category: 'intro',
    text: 'Стоять! Опять вы, да? Надеюсь, на этот раз у вас есть пропуск или вы выучили пароль. Ну, я жду!'
  },
  {
    id: 'guard_last_warning',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/last_warning.ogg',
    category: 'alert',
    execute: true,
    text: 'Это последнее предупреждение. Я предлагаю вам немедленно покинуть это место и не возвращаться. Я ясно выражаюсь?'
  },
  {
    id: 'guard_alarm',
    speaker: 'ЧАСОВОЙ НАВАРРО',
    audio: '../assets/guard/alarm.ogg',
    category: 'combat',
    execute: true,
    text: 'Стоять! Опять вы? Вас предупреждали. Тревога! Посторонний у ворот!'
  }
];

export const OFFICER_VOICED_PHRASES = [
  {
    id: 'officer_video',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/video.ogg',
    category: 'intro',
    text: 'АНКЛАВ на связи. Почему нет видеосигнала?'
  },
  {
    id: 'officer_who_are_you2',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/who_are_you2.ogg',
    category: 'intro',
    text: 'Чёрт возьми, кто это?'
  },
  {
    id: 'officer_no_video',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/no_video.ogg',
    category: 'idle',
    text: 'Ну что, ни черта у вас видео не работает, дружок. Кто на связи?'
  },
  {
    id: 'officer_no_video2',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/no_video2.ogg',
    category: 'idle',
    text: 'Всё равно не работает. Нич-чего не вижу. Кто на связи?'
  },
  {
    id: 'officer_who_who',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/who_who.ogg',
    category: 'idle',
    text: 'Что это вы такое несёте? Кто-кто говорит?'
  },
  {
    id: 'officer_president',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/president.ogg',
    category: 'salute',
    text: 'Президент! Я, э-э…'
  },
  {
    id: 'officer_wise_guy',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/wise_guy.ogg',
    category: 'alert',
    text: 'Э? Ух какие мы умные… Слушай, дружок, я сейчас тебя вычислю. Посмотрим, какой ты будешь умный, когда внутренняя охрана придёт по твою душу, кретин!'
  },
  {
    id: 'officer_plasma',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/plasma.ogg',
    category: 'combat',
    text: 'Всё, хватит гнать мне всякую лабуду. Как насчёт поиграть в догони-меня-плазма со штурмовой командой, а?'
  },
  {
    id: 'officer_gain',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/gain.ogg',
    category: 'idle',
    text: 'Усиление покрутите.'
  },
  {
    id: 'officer_chosen_one',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/chosen_one.ogg',
    category: 'rant',
    text: 'Избранный, вот как? Ну, прошу меня извинить, что не сдуваю пылинки с драгоценной задницы вашего величества, но у меня слишком много дел для такого гонева.'
  },
  {
    id: 'officer_unit_3',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/unit_3.ogg',
    category: 'order',
    text: 'Третий взвод? Вы же должны быть на базе Наварро!'
  },
  {
    id: 'officer_new_rino',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/new_rino.ogg',
    category: 'idle',
    text: 'Это уж точно. Только не болтайте об этом никому, кто смог бы рассказать Президенту. А то будете перегонять скот в Нью-Рино до скончания веков.'
  },
  {
    id: 'officer_special_ops',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/special_ops.ogg',
    category: 'rant',
    text: 'Такого я ещё не слышал. Поскольку моё видео работает, вам должно быть прекрасно видно, как я тут катаюсь по полу от смеха. Секретные операции, государственные тайны, тоже мне. Все спецоперации на материке. Вот уж не знаю, как вообще можно что-то сделать в такой обстановке.'
  },
  {
    id: 'officer_president2',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/president2.ogg',
    category: 'idle',
    text: 'Президент Соединённых Штатов?'
  },
  {
    id: 'officer_funny',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/funny.ogg',
    category: 'idle',
    text: 'Смешно. Но, по крайней мере, после такой прогулки хоть есть где поразвлечься — как говорят.'
  },
  {
    id: 'officer_president3',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/president3.ogg',
    category: 'alert',
    text: 'Президент Соединённых Штатов Америки, мать их в задницу. А вы как думали, что за президент? Разве не… Стоп… Что?.. Ах ты сволочь, да кто ты вообще такой?'
  },
  {
    id: 'officer_who_are_you',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/who_are_you.ogg',
    category: 'intro',
    text: 'Главная рубка связи АНКЛАВА. …Но вам это положено было знать. Кто вы?'
  },
  {
    id: 'officer_maibland',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/maibland.ogg',
    category: 'alert',
    text: 'Ну-ка-ну-ка, милейший, ещё пару секунд — и я вас запеленгую. Стоп, это ещё что? Не может быть… Вы что, на материке?!'
  },
  {
    id: 'officer_gecko',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/gecko.ogg',
    category: 'combat',
    execute: true,
    text: 'Есть! Электростанция «Посейдон Ойл», пятый реактор, вот ты где! А теперь сиди смирно и никуда не уходи, сейчас я тебе приготовлю маленький праздник в твою честь. С фейерверками.'
  },
  {
    id: 'officer_goodbye',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/goodbye.ogg',
    category: 'combat',
    execute: true,
    text: 'Ладно, будь ты хоть чёрт с рогами, штурмовая группа на винтокрылах уже в воздухе. Всего доброго!'
  },
  {
    id: 'officer_end',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/end.ogg',
    category: 'combat',
    execute: true,
    text: 'Стреляют, как правило. А потом приходит кто-то другой и просеивает пепел, чтобы выяснить, что же тут было.'
  },
  {
    id: 'officer_goodbye2',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/goodbye2.ogg',
    category: 'salute',
    text: 'Всего доброго. В следующий раз я услышу о тебе из рапорта о выполнении боевого задания.'
  },
  {
    id: 'officer_retreat_from_base',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/retreat_from_base.ogg',
    category: 'alert',
    text: 'Пришлось уйти? Почему? Вы же на побережье. У вас там такая оборона… Ничего такого не слышал… Эй, постойте, да кто вы вообще такой?'
  },
  {
    id: 'officer_president4',
    speaker: 'ОФИЦЕР СВЯЗИ АНКЛАВА',
    audio: '../assets/officer/president4.ogg',
    category: 'rant',
    text: 'Ну да, вам-то можно так говорить. А здесь в АНКЛАВЕ все гайки затягивают до предела, и чёртов Президент всё время дышит в затылок.'
  }
];

export const OUTPOST_TEXT_PHRASES = [
  { id: 'guard_float1', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'combat', text: 'Посторонний у ворот!' },
  { id: 'guard_float2', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'combat', text: 'Главные ворота атакованы!' },
  { id: 'guard_float3', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'combat', text: 'К воротам! Посторонний у ворот!' },
  { id: 'guard_mumble1', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'idle', text: '...да-а, ЛУЧШЕ вали...' },
  { id: 'guard_mumble2', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'idle', text: '...что за гнусная свинья...' },
  { id: 'guard_mumble3', speaker: 'ЧАСОВОЙ НАВАРРО', category: 'salute', text: '...да, сэр! ...на хер, сэр!...' }
];

export const ALL_OUTPOST_PHRASES = [
  ...GUARD_VOICED_PHRASES,
  ...OFFICER_VOICED_PHRASES,
  ...OUTPOST_TEXT_PHRASES
];

export const OUTPOST_LOOKUP = new Map(ALL_OUTPOST_PHRASES.map((p) => [p.id, p]));

export function pickOutpostPhrase(preferredCategories = null, preferVoiced = true, onlyExecute = null) {
  let pool = ALL_OUTPOST_PHRASES;
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
  if (preferVoiced) {
    const voiced = pool.filter((p) => Boolean(p.audio));
    if (voiced.length > 0 && Math.random() < 0.92) {
      pool = voiced;
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
