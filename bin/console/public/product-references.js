import {escapeHTML as e,button,textLink,field,filterBar,collectionLayout,detailLayout,pageHeader,emptyState,notice,loadingState,sourceNote,sourceList,evidencePanel,readingSection,paperSurface,filterLink,proseFacts,factLine,disclosure,summaryCard,pagination} from './ui-components.js'
import {createReadCache} from './read-resource.js'

// Read-only library data lives only in this page session, never in browser storage.
export function createReferenceLibraryCache(options={}) {
 const cache=createReadCache({...options,maxEntries:options.maxEntries??3})
 const url=scope=>'/api/product-references?'+new URLSearchParams({productId:scope.productId,...(scope.library?{library:scope.library}:{})})
 return {
  peek(scope){return cache.peek(url(scope),{version:scope.versionKey||''})},
  load(scope,options={}){return cache.load(url(scope),{...options,version:scope.versionKey||''})}
 }
}
export const referenceLibraryCache=createReferenceLibraryCache()


const list = value => Array.isArray(value)?value:[]
const countWords=(number,one,few,many)=>{const mod10=number%10,mod100=number%100;return mod10===1&&mod100!==11?one:mod10>=2&&mod10<=4&&(mod100<10||mod100>=20)?few:many}
const directionNames={characters:'Персонажи',exercises:'Упражнения',rpg:'Игровые механики',path:'Учебный путь',onboarding:'Знакомство с приложением',personalization:'Цели и персонализация',progress:'Прогресс',reminders:'Напоминания',ui_voice:'Интерфейс, эмоции и диалоги'}
const directionTitle=(key,fallback)=>directionNames[key]||fallback||'Направление без названия'
const labels = {
  firsthand_ui:'Просмотрено в приложении',official_screenshot:'Официальный скриншот',official_demo:'Официальное демо',third_party_walkthrough:'Видеообзор пользователя',documented_feature:'Описание функции',user_report:'Отзыв пользователя',reconstructed:'Восстановленный пример',proposed_adaptation:'Идея для нашего продукта',
  direct:'Прямое основание',inferred:'Интерпретация',unknown:'Неизвестно',source_stated:'Указано источником',editor_inference:'Вывод автора',not_checked:'Не проверено',verified:'Проверка источников выполнена',mixed:'Есть расхождения',unconfirmed:'Не подтверждено',proposed:'Предложение',draft:'Черновик',conflicting:'Противоречивые сведения',
  name:'Имя',appearance:'Внешность',biography:'Биография',personality:'Характер',role:'Роль',speech:'Речь',voice:'Голос',emotions:'Эмоции',relationships:'Отношения',memory:'Память',states:'Состояния',contexts:'Контексты',exerciseTypeId:'Тип упражнения',stimulus:'Задание или исходный материал',prompt:'Задание',requiredAction:'Действие пользователя',exampleAnswer:'Пример ответа',feedback:'Обратная связь',help:'Помощь',retry:'Повтор',difficulty:'Сложность',completion:'Завершение',trigger:'Условие запуска',action:'Действие',reward:'Награда',progression:'Развитие',limits:'Ограничения',failure:'Ошибка',destination:'Куда ведёт',optOut:'Отключение',text:'Текст',basis:'Основание',status:'Статус',claimIds:'Связанные утверждения',sourceId:'Источник',locator:'Место в источнике',notes:'Примечания',timestamp:'Таймкод',page:'Страница',section:'Раздел',screen:'Экран',inspectedAt:'Дата просмотра',inspectedBy:'Просмотрел',result:'Результат',relevant:'Соответствует карточке',not_inspected:'Не просмотрено',unusable:'Непригодно',
  idea:'Идея применения',whatToKeep:'Что сохранить',whatToChange:'Что изменить',risks:'Риски',dependencies:'Зависимости',checkedBy:'Проверил',checkedAt:'Дата проверки',issues:'Замечания',reopenedSourceIds:'Повторно открытые источники',mediaReviewedIds:'Проверенные изображения',
  official_doc:'Официальная документация',official_ui:'Официальный интерфейс',first_party_post:'Публикация продукта',opened:'Открыт',partial:'Частичный доступ',unavailable:'Недоступен',
  'ready-for-review':'Готово к просмотру','ready-for-review-partial':'Готово к просмотру, есть пробелы',
  motivation:'Мотивация',speechStyle:'Манера речи',gestures:'Жесты',helpBehavior:'Как помогает',productPosition:'Место в продукте',variants:'Варианты',observedInteractions:'Наблюдавшиеся взаимодействия',accessNotes:'Условия доступа',preferences:'Предпочтения',additionalExpressions:'Другие выражения',biographyInterests:'Биография и интересы',voiceEvidenceLimit:'Что известно о голосе',sharedProductPersonality:'Общие настройки характера',sharedProductMemory:'Общая память продукта',productDesignRationale:'Объяснение разработчиков',documentedTouchInteractions:'Реакции на прикосновение',featureGenerationNotes:'Что изменилось в свежих версиях',roleLabel:'Роль',designRationale:'Объяснение разработчиков',
  observedAnswer:'Ответ в примере',repeat:'Повторная попытка',audioEvidence:'Что известно об аудио',targetLanguage:'Язык практики',preAnswerState:'Состояние до ответа',specimenBoundary:'Границы примера',guidance:'Подсказки',
  next:'Следующий шаг',concreteCase:'Конкретный пример',stimulates:'К чему побуждает',possibleIrritation:'Что может раздражать',quantitativeExample:'Пример начисления',currentAvailability:'Текущая доступность',scopeNote:'Область применения',limitationsOfEvidence:'Ограничения наблюдения',retentionEffect:'Данные о возвращаемости',failureEvidence:'Что известно об ошибках',
  algorithm:'Как выбирается следующий шаг',urgentTaskEvidence:'Что известно о срочной задаче',durationSeconds:'Длительность в секундах',audioObserved:'Прослушано ли аудио',continuity:'Связность последовательности',displayNumbersBasis:'Основание чисел на экране',displayTotalMinutes:'Время на экране в минутах',
  shortTitle:'Название',accessMode:'Условия доступа',interfaceLanguage:'Язык интерфейса',learningLanguage:'Изучаемый язык',accountState:'Состояние аккаунта',paywallObserved:'Наблюдалось предложение оплаты',paywallScope:'Границы наблюдения оплаты',permissionState:'Запросы разрешений',skipState:'Возможность пропуска',branchInputs:'Выборы в этой ветке',observedOutput:'Показанный результат',mentorNamesVisible:'Имена наставников на экране',capturePeriod:'Период наблюдения',visibleUiStepNumbers:'Номера шагов на экране',hoverNote:'Поведение при наведении',imageComposition:'Состав изображения',
  inputs:'Что задаёт пользователь',observedOutputs:'Как отвечает продукт',internalAlgorithm:'Что известно об алгоритме',inputOutputEvidence:'Связь выбора и результата',beforeAfter:'До и после',surfacePlatform:'Платформа',sourceDateMeaning:'Что означает дата источника',
  progressTypes:'Виды прогресса',measuredObject:'Что измеряется',observedNumbers:'Числа в примере',numberProvenance:'Откуда взяты числа',scaleLimits:'Границы шкалы',beforeAfterSameSpeaker:'Сравнение записей одного человека',comparisonEvidence:'Основание сравнения',editorAnalysis:'Вывод автора',relatedDocumentedFeature:'Связанная функция',
  messageParaphrase:'Пересказ сообщения',messageText:'Текст сообщения',knownTrigger:'Когда появляется',triggerBasis:'Основание условия',cta:'Предлагаемое действие',destinationBasis:'Что известно о переходе',tapObserved:'Наблюдалось нажатие',productionFrequency:'Частота отправки',ctaPresentation:'Как показано действие',ctaBasis:'Основание действия',channel:'Канал',visibleCondition:'Условие на экране',suppression:'Когда сообщение не отправляют',conditionThresholds:'Пороговые значения',desiredAction:'Ожидаемое действие',desiredActionBasis:'Основание ожидаемого действия',visibleControls:'Настройки на экране',inputCaptured:'Сохранённый выбор',saveResult:'Результат сохранения',permissionPresentation:'Как запрашивается разрешение',visibleCategories:'Категории уведомлений',accessConstraint:'Ограничения доступа',visibleRoutePanels:'Экраны перехода',isPreviewMessage:'Демонстрационный текст',exampleDeliveryObserved:'Наблюдалась доставка сообщения',dailyNotificationScenario:'Ежедневный сценарий',activationDelayMaxHours:'Максимальная задержка в часах',illustratedPlatform:'Платформа на изображении',scenarios:'Сценарии',documentedDailyCap:'Лимит сообщений в день',dailyCapBasis:'Основание лимита',
  expectedUserAction:'Действие пользователя',characterEmotion:'Эмоция персонажа',gesture:'Жест',sound:'Звук',previousTurn:'Предыдущая реплика',nextObservedState:'Следующее наблюдавшееся состояние',retentionEvidence:'Данные о возвращаемости',dialogue:'Диалог',voiceExample:'Пример речи',documentedBehavior:'Описанное поведение',liveOutcome:'Результат в приложении',secondAttempt:'Вторая попытка',selectedState:'Выбранное состояние',contradiction:'Противоречие',feedbackValidity:'Ограничения оценки',performanceAssessment:'Оценка результата',sourceAvailabilityConflict:'Расхождение в доступности источника',
  sequenceContinuity:'Связность экранов',sessionContinuity:'Связность сеанса',versionSessionContinuity:'Связность версий',sequenceType:'Что показывают экраны',textRef:'Источник текста',copyMode:'Форма передачи',goal:'Цель',focus:'Фокус',native:'Родной язык',target:'Целевой язык',experience:'Опыт',desiredOutcome:'Желаемый результат',concern:'Тревога',weakSkill:'Слабый навык',newLesson:'Новый урок',legendaryOption:'Легендарный режим',review:'Повторения',unit:'Единица',kind:'Вид',startContext:'Начало контекста',endContext:'Конец контекста',sequenceBasis:'Основание последовательности',genre:'Жанр',accessBoundary:'Границы доступа'
}
const omittedDescription='Деталь доступна в оригинальном изображении/источнике; см. сохранённый локатор и точное исходное поле в assemblyProvenance.'
const named = value => value === null || value === undefined || value === ''?'Неизвестно':value===true?'Да':value===false?'Нет':value===omittedDescription?'Подробности — в полном материале направления.':labels[value]||String(value)
const scalar = value => value!==null&&typeof value==='object'?(Array.isArray(value)?value.map(scalar).join(' · '):Object.entries(value).map(([key,v])=>`${labels[key]||key}: ${scalar(v)}`).join(' · ')):named(value)

// Display boundary: saved codes and enum markers become Russian or stay in the technical view.
const languageNames={ru:'Русский',en:'Английский',ja:'Японский',de:'Немецкий',es:'Испанский',fr:'Французский',ko:'Корейский',it:'Итальянский',pt:'Португальский',zh:'Китайский',ar:'Арабский',hi:'Хинди',tr:'Турецкий',pl:'Польский',nl:'Нидерландский'}
const decodedValues={
  'unknown':'неизвестно','not_observed':'не наблюдалось','not established':'не установлено','not observed':'не наблюдалось','not_accessed':'приложение не устанавливалось',
  'Illustrative still(s); not a captured continuous app session':'отдельные кадры-иллюстрации, а не записанный непрерывный сеанс приложения',
  'not a captured session':'не записанный сеанс приложения',
  'unknown across cut from processing to result; no independent app replay':'переход от обработки к результату не подтверждён отдельным повтором',
  'unknown unless explicit sequence below':'неизвестно без явной последовательности экранов',
  'unknown unless source states it':'неизвестно, если источник не указывает иное',
  same_session_observed:'один непрерывный просмотр',same_session_with_capture_gap:'один просмотр с пропуском в записи',same_session_with_transition_gap:'один просмотр с пропуском перехода',unestablished:'непрерывность не установлена',unestablished_mixed_platform_dossier:'непрерывность не установлена: материалы разных платформ',
  'official illustrated state sequence':'официальная серия состояний-иллюстраций','official annotated help collage; ordering explanatory, session unknown':'официальная справка-коллаж; порядок пояснительный, сеанс неизвестен',
  single_map_states:'отдельные состояния одной карты',chapter_gate:'переход между главами',completion_exit:'выход по завершению',documented_lesson_history:'задокументированная история уроков',documented_resume:'задокументированное возобновление',documented_route:'задокументированный маршрут',format_node:'узел выбора формата',
  'published_images_and_help':'официальные изображения и справка','documented_only':'только документация',comparable:'сопоставимо с нашим форматом',partial_match:'частично похоже на наш формат',related_format:'смежный формат',
  direct_paraphrase:'пересказ увиденного на экране',editor_inference:'наша оценка','editor_inference_from_visible_stimulus; not backend eligibility':'наша оценка по видимому на экране; реальную доставку не проверяли','source_stated_intent':'заявлено источником',
  push:'Push-уведомления',email:'Письма на почту',
  daily:'ежедневное напоминание',comeback:'возврат после паузы',continuation:'продолжение практики',event:'событие',pause:'после перерыва',documented:'документированный пример',
  button:'кнопка',settings_controls:'экранные настройки',textual_invitation:'текстовое приглашение',
  audio_present:'аудио сохранено','no_audio_stream_in_saved_file':'в сохранённом файле нет аудиодорожки','not independently listened':'самостоятельно не прослушано','not independently listened/validated':'самостоятельно не прослушано и не проверено','not attempted':'не выполнялось','unknown; no observed error or failed action':'неизвестно; ошибок и неудачных действий не наблюдали',
  source_condition:'описано только условие в источнике',
  published_comparison:'опубликованное сравнение','published_instruction_with_gaps':'официальная инструкция с пробелами',single_state:'показано одно состояние',
  'rendered promotional fragment':'рекламный фрагмент рендера','staged promotional dialogue':'постановочный рекламный диалог','visible transcript fragment':'видимый фрагмент расшифровки','greeting visible':'видно приветствие','greetings visible':'видно приветствия',
  'firsthand captures/actions':'действия и съёмка из первых рук','firsthand clicks and captures':'клики и съёмка из первых рук','gallery order; scroll substates grouped':'порядок галереи; подсостояния прокрутки сгруппированы',confidence:'уверенность',levels:'уровни','course-progress':'прогресс курса','only this observed prefix':'только показанная часть пути','anonymous new visitor; no account created':'анонимный новый посетитель; аккаунт не создавался','anonymous; no account created':'анонимный просмотр; аккаунт не создавался','anonymous; no new account':'анонимный просмотр; без нового аккаунта','gallery has signup and named profile; new/existing continuity unknown':'в галерее есть регистрация и именной профиль; непрерывность нового/существующего аккаунта неизвестна','named home screen in public tester capture; account history unknown':'именной домашний экран в публичной записи тестера; история аккаунта неизвестна','signup shown, later returning-user wording; continuity unknown':'показана регистрация, далее формулировки для вернувшегося пользователя; непрерывность неизвестна','in-page primer declined; OS/browser permission unknown outside branch':'встроенный обучающий запрос отклонён; системное разрешение вне этой ветки неизвестно','iOS-styled prompt visible; actual OS invocation and outcome unknown':'показан запрос в стиле iOS; реальный системный вызов и его результат неизвестны','not_observed in prefix':'в показанной части не наблюдался','not_observed in retained article images':'в сохранённых изображениях статьи не наблюдался','close control on sign-in visible; outcome unknown':'крестик закрытия на входе виден; исход неизвестен','paywall skip/decline visible; selection unknown':'пропуск и отказ от оплаты видны; выбор неизвестен',career:'карьера','work/immigration':'работа или эмиграция',speaking:'разговорная речь','first exam':'первый экзамен','converse confidently':'уверенно вести беседу','XP':'XP','player commendations':'одобрения игроков','date unknown; document created 2024-06-28':'дата неизвестна; документ создан 28.06.2024',
  'source_ui_example; not Speaky parameters':'пример из интерфейса источника; не параметры Speaky','source_marketing_example; not Speaky parameters':'маркетинговый пример источника; не параметры Speaky','published mobile UI, iOS-style; exact OS unknown':'публичный мобильный интерфейс в стиле iOS; точная ОС неизвестна','date shown by page; may be update date, not capture or build date':'дата на странице; может быть датой обновления, а не съёмки или сборки',
}
const conflictStates=new Set(['conflicting','mixed','unconfirmed'])
// Fields whose values are pipeline codes: they reach the main text only decoded, otherwise they stay in the archive views.
const enumFields=new Set(['triggerBasis','ctaBasis','destinationBasis','desiredActionBasis','referenceClassBasis','visibleConditionBasis','dailyCapBasis','inputOutputEvidence','referenceClass','channel','ctaPresentation','currentAvailability','sequenceContinuity','sessionContinuity','versionSessionContinuity','urgentTaskEvidence','previousTurn','liveOutcome','secondAttempt','sourceDateMeaning','surfacePlatform','capturePeriod','illustratedPlatform','nativeAppAccess','evidenceGenre','formatFit','genre','sequenceGenre','sequenceType','accountState','paywallScope','permissionState','skipState'])
const technicalFields=new Set(['screenState','accessMode','exerciseTypeId','claimIds','sourceId','locator','checkedBy','checkedAt','inspectedBy','inspectedAt','reopenedSourceIds','mediaReviewedIds','fieldProvenance','sourcePeriods','unknownFields','fieldEvidenceStatus','collectorProvenance','claimIdsByField','detailProvenance','sessionId','primaryLocator','observationLocator','canonicalLocator','optOutCardId','nativeAppAccess','picturedBuild','documentVersion','evidenceGenre','quotaEligible','quotaBasis','quotaClass','quotaExclusionReason','formatFit','countsTowardImageQuota','relatedTrackReferences','countAsNewGlobalExample','directQuoteWords','verifierReplay','workflowRunId','referenceClassBasis','visibleConditionBasis','dailyCapBasis','qualifyingNodePath','actualSessionObserved','observedRuntimeTransitions','evidenceScope','continuityCheck','relatedDocumentedFeature','contentVersionDate','frameSourceId','independentVerification'])
// Important saved negatives become one readable sentence each instead of «Неизвестно» rows.
const statementFields={
  paywallObserved:v=>v===false?'Оплаты в показанной части не предлагали':v===true?'В показанной части предлагали оплату':null,
  fullProposedCycleObserved:v=>v===false?'Полный цикл задания — до результата и оценки — не просмотрен':null,
  promptIsParaphrase:v=>v===true?'Задание на экране пересказывает исходную ситуацию':null,
  tapObserved:v=>v===false?'Нажатие на предложение не выполнялось':v===true?'Нажатие на предложение наблюдалось':null,
  completionScreenCaptured:v=>v===false?'Экран завершения не снят':null,
  countsAsActualRpgGame:v=>v===true?'Это полноценная игра, а не учебная имитация механики':null,
  isPreviewMessage:v=>v===true?'Это демонстрационный текст, а не реальная отправка':null,
  exampleDeliveryObserved:v=>v===false?'Доставку сообщения не наблюдали':null,
}
// Limitations that qualify the whole example; decoded and shown as sentences.
const boundaryFields=new Set(['sequenceContinuity','sessionContinuity','versionSessionContinuity','continuity','currentAvailability','previousTurn','liveOutcome','secondAttempt','retentionEffect','failureEvidence','limits','limitationsOfEvidence','scopeNote'])
// The reading model: each direction answers the reader's questions with named blocks, not a field dump.
const trackBlocks={
  characters:[
    ['Кто такой персонаж',['name','role','appearance','biography','personality','motivation']],
    ['Как ведёт себя и говорит',['speechStyle','emotions','gestures','observedInteractions','helpBehavior','documentedTouchInteractions','variants','observedAnswer']],
    ['Память, связи и место в продукте',['memory','relationships','productPosition','preferences','biographyInterests','sharedProductPersonality','sharedProductMemory','states','contexts','featureGenerationNotes','productDesignRationale']],
    ['Что известно о голосе и доступе',['voice','voiceEvidenceLimit','audioEvidence','accessNotes']],
  ],
  exercises:[
    ['Задание и ситуация',['stimulus','prompt','concreteCase']],
    ['Что делает человек',['requiredAction','expectedUserAction','desiredAction']],
    ['Ответ, подсказки и обратная связь',['observedAnswer','exampleAnswer','help','guidance','feedback','repeat','retry']],
    ['Условия примера',['targetLanguage','learningLanguage','difficulty','completion','durationSeconds','audioObserved','audioEvidence','preAnswerState','accessBoundary']],
  ],
  rpg:[
    ['Как запускается механика',['trigger','knownTrigger']],
    ['Что происходит',['action','feedback','failure']],
    ['Награда и развитие',['reward','progression','next','quantitativeExample']],
    ['Числа и жанр примера',['concreteCase','genre']],
    ['Наши оценки материала',['stimulates','possibleIrritation']],
  ],
  path:[
    ['Как устроен путь',['algorithm','destination','sequenceType']],
    ['Срочная задача',['urgentTaskEvidence']],
  ],
  onboarding:[
    ['Языки примера',['interfaceLanguage','learningLanguage','targetLanguage']],
    ['Условия просмотра',['accountState','paywallScope','permissionState','skipState','capturePeriod','accessNotes','hoverNote','imageComposition','mentorNamesVisible','visibleUiStepNumbers']],
    ['Выборы и результат ветки',['branchInputs','observedOutput','observedOutputs']],
  ],
  personalization:[
    ['Что задаёт человек',['inputs']],
    ['Как отвечает продукт',['observedOutputs','observedOutput','internalAlgorithm']],
    ['Насколько наблюдение полное',['inputOutputEvidence','beforeAfter','sourceDateMeaning','surfacePlatform','accessNotes']],
  ],
  progress:[
    ['Что показывает прогресс',['progressTypes','measuredObject']],
    ['Числа в примере',['observedNumbers','displayNumbersBasis','displayTotalMinutes','numberProvenance','scaleLimits']],
    ['Сравнение и наши оценки',['beforeAfterSameSpeaker','comparisonEvidence','editorAnalysis','performanceAssessment']],
  ],
  reminders:[
    ['Какое сообщение показано',['messageText']],
    ['Когда появляется',['knownTrigger','productionFrequency','dailyNotificationScenario','suppression','conditionThresholds','documentedDailyCap','visibleCondition']],
    ['Что предлагает сделать',['cta','ctaPresentation','destination','desiredAction']],
    ['Канал и отключение',['channel','optOut','visibleControls','visibleCategories','permissionPresentation','accessConstraint']],
  ],
  ui_voice:[
    ['Что показано',['stimulus','documentedBehavior','imageComposition']],
    ['Что делает человек',['expectedUserAction','gesture','characterEmotion']],
    ['Речь и звук',['dialogue','voiceExample','nextObservedState','sound']],
    ['Как снята последовательность',['sequenceGenre']],
  ],
}
const languageFields=new Set(['interfaceLanguage','learningLanguage','targetLanguage','native','target'])
const knownEmpty=v=>v===null||v===undefined||v===''||v===omittedDescription
// Values equal up to whitespace, case and trailing punctuation are one text for the reader.
const norm=t=>String(t??'').replace(/\s+/g,' ').replace(/[.;:,!?«»"']+$/,'').trim().toLowerCase()
// The editorial vocabulary of saved proposals: closed phrase list, applied only to adaptation display.
const glossRules=[
  [/Ручной review/g,'Ручная проверка'],[/ручного review/g,'ручной проверки'],[/после review/g,'после проверки'],
  [/\bReview\b/g,'Проверка'],[/\breview\b/g,'проверки'],[/\bretention\b/gi,'возвращение в приложение'],
  [/целевая модальность/gi,'нужная форма практики'],[/целевой модальности/gi,'нужной формы практики'],
]
const gloss=text=>typeof text==='string'?glossRules.reduce((acc,[from,to])=>acc.replace(from,to),text):text
// Mixed Russian prose gets its inline English markers translated; literal foreign example text stays untouched.
const deangle=text=>typeof text==='string'&&/[а-яё]/i.test(text)?text.replace(/\s*\bunknown\b\s*\./gi,' — нет данных.').replace(/\s*\bunknown\b/gi,' — нет данных').replace(/\bnot observed\b/gi,'не наблюдалось'):text
const decode=v=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(decodedValues,v)?decodedValues[v]:undefined

function publicURL(value) {
  if(typeof value!=='string'||/[\u0000-\u0020\u007f\\]/.test(value))return ''
  try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}
}
function sourceEntries(row,ids) {
  return list(ids).map(id=>{const s=list(row?.sources).find(s=>s.id===id);return s?{title:s.title||'Источник',href:publicURL(s.url),meta:[named(s.sourceType),`Доступ: ${named(s.accessStatus)}`,`Платформа: ${named(s.platform)}`,`Версия: ${named(s.version)}`,`Опубликовано: ${named(s.publishedAt)}`,`Сохранено: ${named(s.retrievedAt)}`].join(' · '),context:s.notes?`<p>${e(scalar(s.notes))}</p>`:''}:{title:'Источник не связан',meta:String(id)}})
}
function readerLink(value,extension,label) {
  return typeof value==='string'&&/^(reports|sources)\//.test(value)&&!/[\\\u0000-\u001f\u007f]/.test(value)&&value.split('/').every(part=>part&&!part.startsWith('.'))&&value.endsWith(extension)?textLink({label,href:(extension==='.md'?'/report':'/asset')+'?path='+encodeURIComponent(value),attributes:{target:'_blank',rel:'noopener noreferrer'}}):''
}
const fullDescription = row => readerLink(row?.card?.assemblyProvenance?.originalReportPath,'.md','Подробности — в исходном отчёте направления')||e(named(omittedDescription))
const valueText = (value,row) => value===omittedDescription?fullDescription(row):e(scalar(value))
// Main-reading variant: mixed Russian prose is decoded; literal foreign example text stays as saved.
const readingText = (value,row) => value===omittedDescription?fullDescription(row):e(deangle(scalar(value)))
const sourced = (text,row,ids,extra='') => text===omittedDescription?fullDescription(row):sourceNote({text:scalar(text),content:extra+sourceList({entries:sourceEntries(row,ids)})})

// Reading renderer: known, decoded content only. Codes travel through the dictionary or stay archived.
function readingValue(key,value) {
  if(typeof value==='number')return String(value)
  if(typeof value==='boolean')return value?'Да':'Нет'
  if(typeof value!=='string')return ''
  const decoded=decode(value)
  if(decoded!==undefined)return e(decoded)
  if(languageNames[value])return e(languageNames[value])
  // A code field without a dictionary entry is not readable content: keep it in the archive views.
  if(enumFields.has(key))return ''
  return e(deangle(value))
}
// Explicit shapes only: plain values, {text,basis} assessments, {status,text} evidence and status-family records.
const statusFamilyKeys=new Set(['status','text','basis','reason','scope','sequenceBasis','sessionId','version','notes','claimIds','sourceId'])
function readingParts(key,value) {
  if(knownEmpty(value))return []
  if(Array.isArray(value))return value.flatMap(v=>readingParts(key,v))
  if(value&&typeof value==='object'){
    if(typeof value.text==='string'&&!knownEmpty(value.text)&&typeof value.basis==='string'){
      const basis=decode(value.basis)
      return [`${e(deangle(value.text))}${basis?` <span class="reference-meta">(${e(basis)})</span>`:''}`]
    }
    if(typeof value.text==='string'&&!knownEmpty(value.text)){
      const conflict=typeof value.status==='string'&&conflictStates.has(value.status)
      return [e(deangle(value.text))+(conflict?' <span class="reference-conflict">Противоречивые сведения</span>':'')]
    }
    if(typeof value.status==='string'&&Object.keys(value).every(k=>statusFamilyKeys.has(k))){
      const parts=['status','reason','scope','sequenceBasis'].map(k=>typeof value[k]==='string'?decode(value[k]):undefined).filter(Boolean).filter(part=>!/^неизвестно$/.test(part))
      return parts.length?[parts.map(e).join('. ').replace(/\.$/,'')+'.']:[]
    }
    return []
  }
  const single=readingValue(key,value)
  return single?[single]:[]
}
function factRows(fields,details,shown=new Set()) {
  const seen=new Set()
  return fields.map(key=>{
    if(!labels[key]||technicalFields.has(key))return null // only reader-named, non-technical fields reach the main text
    const value=details?.[key]
    const plain=norm(scalar(value))
    if(shown.has(plain))return null // already on screen beside its picture or in the introduction
    const parts=readingParts(key,value)
    if(!parts.length)return null
    const joined=parts.join(' ')
    if(seen.has(joined))return null // one saved truth repeated across sibling fields is printed once
    seen.add(joined);shown.add(plain)
    return {label:labels[key],value:joined}
  }).filter(Boolean)
}
const detailsHeadings={characters:'Характер и поведение',exercises:'Как работает упражнение',rpg:'Правила и награды',path:'Как устроен учебный путь',personalization:'Как подстраивается приложение',progress:'Что показывает прогресс',reminders:'Когда и что отправляют',ui_voice:'Поведение интерфейса и реплики'}
function trackReadingSections(row,shown=new Set()) {
  const groups=(trackBlocks[row.trackKey]||[]).map(([title,fields])=>({title,rows:factRows(fields,row.card.details,shown)})).filter(g=>g.rows.length)
  if(!groups.length)return ''
  const heading=detailsHeadings[row.trackKey]||'Подробнее о примере'
  // Substantive sentences read as label-above-value prose; only short contextual facts stay on one line.
  const compact=row=>{const plain=String(row.value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return plain.length<=24&&!/[.;]/.test(plain)}
  const render=rows=>{const lines=rows.filter(compact),prose=rows.filter(r=>!compact(r));return (lines.length?lines.map(r=>factLine(r)).join(''):'')+(prose.length?proseFacts({items:prose}):'')}
  const rich=groups.filter(g=>g.rows.length>1),short=groups.flatMap(g=>g.rows.length===1?g.rows:[])
  const titled=rich.filter(g=>g.rows.some(r=>!compact(r))),linesOnly=rich.filter(g=>g.rows.every(compact))
  const content=(titled.length?`<div class="reference-fact-groups">${titled.map(g=>`<section class="reference-fact-group"><p class="reference-fact-group-title">${e(g.title)}</p>${proseFacts({items:g.rows})}</section>`).join('')}</div>`:'')
    +(titled.length&&(short.length||linesOnly.length)?'<div class="reference-fact-sep"></div>':'')
    +[...linesOnly.flatMap(g=>g.rows),...short].map(r=>compact(r)?factLine(r):'').join('')
    +[...short.filter(r=>!compact(r))].map(r=>proseFacts({items:[r]})).join('')
  return readingSection({title:heading,content})
}
function boundaryReading(row) {
  const details=row.card.details||{},items=[],blockFields=new Set((trackBlocks[row.trackKey]||[]).flatMap(([,fields])=>fields))
  for(const [key,make] of Object.entries(statementFields)){const sentence=make(details[key]);if(sentence)items.push(e(sentence))}
  for(const key of boundaryFields){
    const value=details[key];if(knownEmpty(value))continue
    if(key==='limits'||key==='limitationsOfEvidence'){if(typeof value==='string')items.push(e(deangle(value)));else for(const item of list(value))items.push(e(deangle(typeof item==='string'?item:scalar(item))));continue}
    // Decoded status facts carry their Russian subject; a raw key or a bare «не наблюдалось» explains nothing.
    for(let part of readingParts(key,value)){if(/^неизвестно\.?$/.test(part))part='нет данных';items.push(`<strong>${e(labels[key]||'Ограничение примера')}</strong> — ${part}`)}
  }
  const walk=(value,key)=>{if(!value||typeof value!=='object')return
    if(typeof value.status==='string'&&conflictStates.has(value.status)&&typeof value.text==='string'&&!knownEmpty(value.text)&&!blockFields.has(key)&&!boundaryFields.has(key))
      items.push(`${e(labels[key]||key)}: ${e(deangle(value.text))} <span class="reference-conflict">Противоречивые сведения</span>`)
    for(const [k,v] of Object.entries(value))walk(v,k)
  }
  walk(details,'')
  return [...new Set(items)]
}
// Archive view of the remaining saved facts: verbatim wording, codes decoded where the dictionary knows them.
function archiveValue(value) {
  if(typeof value==='boolean')return value?'Да':'Нет'
  if(typeof value==='number')return String(value)
  if(typeof value!=='string')return ''
  const decoded=decode(value)
  if(decoded!==undefined)return e(decoded)
  if(languageNames[value])return e(languageNames[value])
  return e(deangle(value))
}
function leftoverObservations(row) {
  const details=row.card.details||{}
  const used=new Set([...(trackBlocks[row.trackKey]||[]).flatMap(([,fields])=>fields),...boundaryFields,...Object.keys(statementFields)])
  const rows=Object.entries(details).filter(([key,value])=>labels[key]&&!technicalFields.has(key)&&!used.has(key)&&!knownEmpty(value)&&!languageFields.has(key))
    .map(([key,value])=>{
      if(Array.isArray(value)){const items=list(value).map(v=>archiveValue(v)).filter(Boolean);return items.length?{label:labels[key],value:`<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`}:null}
      if(value&&typeof value==='object')return {label:labels[key],value:e(deangle(scalar(value)))}
      const shown=archiveValue(value)
      return shown?{label:labels[key],value:shown}:null
    }).filter(Boolean)
  return rows.length?disclosure({title:'Ещё из сохранённых наблюдений',className:'reference-technical',content:`${proseFacts({items:rows})}<p class="reference-meta">Полный исходный вид полей — в технических данных карточки.</p>`}):''
}
function facts(value,row,technical=false) {
  if(value===null||typeof value!=='object')return `<p>${valueText(value,row)}</p>`
  if(Array.isArray(value))return value.length?`<ul>${value.map(v=>`<li>${facts(v,row,technical)}</li>`).join('')}</ul>`:'<p>Не указано.</p>'
  const entries=Object.entries(value),visible=technical?entries:entries.filter(([key])=>labels[key]&&!technicalFields.has(key)),other=technical?[]:entries.filter(([key])=>!labels[key]||technicalFields.has(key))
  return `${visible.length?`<dl class="os-facts">${visible.map(([key,v])=>`<div><dt>${e(labels[key]||key)}</dt><dd>${key==='text'&&value.sourceId?sourced(v,row,[value.sourceId]):facts(v,row,technical)}</dd></div>`).join('')}</dl>`:''}${other.length?disclosure({title:`Дополнительные сведения о сборе (${other.length})`,className:'reference-technical',content:facts(Object.fromEntries(other),row,true)}):''}`
}
function imageURL(data,card,media) {
  return data.example && /^\/assets\/[a-zA-Z0-9_./-]+\.png$/.test(media.previewURL||'') ? media.previewURL : '/api/product-references/image?'+new URLSearchParams({productId:data.productId,library:data.library.artifactId,card:card.id,media:media.id})
}
const imageDimensions = media => Number.isSafeInteger(media.width)&&media.width>0&&Number.isSafeInteger(media.height)&&media.height>0?` width="${media.width}" height="${media.height}"`:''
function image(data,row,media,thumbnail=false) {
  const c=row.card
  // The visible label describes the example in human terms; capture caption/alt stay inside the source panel.
  const humanAlt=typeof media.alt==='string'&&media.alt.trim()&&media.alt!==media.caption?media.alt.trim():''
  const imageLabel=humanAlt||row.readingView?.title||c.title||'изображение примера'
  return `<figure class="reference-image${thumbnail?' reference-thumbnail':''}"><button type="button" class="reference-image-open" data-reference-image="${e(media.id)}" data-reference-card="${e(c.id)}" aria-label="${e('Увеличить: '+imageLabel)}"><img loading="lazy"${imageDimensions(media)} src="${e(imageURL(data,c,media))}" alt="${e(imageLabel)}" data-reference-raster><span class="reference-image-loading" data-reference-image-loading>Загрузка изображения…</span><span data-reference-image-error hidden>Изображение недоступно. Оригинал и пробелы сохранены в карточке.</span></button>${!thumbnail?`<figcaption>${sourceNote({variant:'link',text:'Источник изображения',content:`<p>${valueText(media.caption||'Подпись не сохранена',row)}</p>${media.alt&&media.alt!==media.caption?`<p>Описание изображения: ${e(media.alt)}</p>`:''}<details><summary>Сведения об изображении</summary><p>Где найти в оригинале: ${e(scalar(media.locator))}</p>${facts(media.visualInspection??null,row,true)}</details>`+sourceList({entries:sourceEntries(row,[media.sourceId])})})}</figcaption>`:''}</figure>`
}
const metadata = (c,trackTitle) => `<p class="reference-meta">${e(c.product?.name||'Продукт не указан')} · ${e(trackTitle||'')}</p>`
const accessDetails = c => disclosure({title:'Версия и условия доступа',className:'reference-technical',content:`<p>Платформа: ${e(named(c.product?.platform))}</p><p>Версия: ${e(named(c.product?.version))}</p><p>Доступ: ${e(named(c.product?.accessMode))}</p>`})
function originalCheckedData(card) {
  const provenance=card.assemblyProvenance
  if(!list(provenance?.boundedFields).length)return ''
  const links=[readerLink(provenance.originalReportPath,'.md','Полный проверенный каталог'),readerLink(provenance.originalCardsPath,'.json','Исходные проверенные карточки')].filter(Boolean)
  return `<p>Здесь показан сокращённый разбор. Полное описание и данные доступны в материалах направления.</p>${links.length?`<div class="os-actions">${links.join('')}</div>`:''}`
}
export function referenceRoute({library='',track='',competitor='',page=1,card=''}={}) {
  const q=new URLSearchParams();if(library)q.set('library',library);if(track)q.set('track',track);if(competitor)q.set('competitor',competitor);if(page>1)q.set('page',String(page))
  return 'library/references'+(card?'/'+encodeURIComponent(card):'')+(q.size?'?'+q:'')
}
export function referenceMaterialsRoute({library=''}={}) {
  return 'library/elements?'+new URLSearchParams({documents:'1',...(library?{library}:{})})
}
const librarySelect=data=>list(data.libraries).length>1?field({name:'library',label:'Библиотека',type:'select',attributes:{id:'reference-library','data-reference-filter':'library'},optionsHtml:list(data.libraries).map(l=>`<option value="${e(l.id)}"${l.id===data.library?.artifactId?' selected':''}>${e(l.title)}</option>`).join('')}):''
function aiData(data) {
  return disclosure({title:'Данные для AI',className:'reference-ai',content:`<p>Начните с манифеста и выбранного направления. Предложения требуют ручного рассмотрения.</p><ul>${list(data.files).map(f=>`<li>${textLink({label:f.label,href:(f.path?.endsWith('.md')?'/report':'/asset')+'?path='+encodeURIComponent(f.path||''),attributes:{target:'_blank',rel:'noopener noreferrer'}})}</li>`).join('')}</ul>`})
}
// An overview must expose different directions; each filtered direction retains its saved order.
function overviewOrder(rows,tracks) {
  const groups=new Map(tracks.map(t=>[t.key,[]]))
  for(const row of rows){if(!groups.has(row.trackKey))groups.set(row.trackKey,[]);groups.get(row.trackKey).push(row)}
  const ordered=[],buckets=[...groups.values()],length=Math.max(0,...buckets.map(b=>b.length))
  for(let i=0;i<length;i++)for(const bucket of buckets)if(bucket[i])ordered.push(bucket[i])
  return ordered
}
function readingExample(row) {
  const view=row.readingView
  return view?`${view.example?`<p class="reference-example"><strong>Пример задания:</strong> ${e(view.example)}</p>`:''}${view.note?`<p class="reference-meta">${e(view.note)}</p>`:''}`:''
}
function designMaterials(data) {
  const groups=list(data.library.designMaterials)
  if(!groups.length)return ''
  return readingSection({id:'reference-design-materials',title:'Документы к элементам',intro:'Сохранённые тексты, описания персонажей и варианты оформления.',content:`<div class="reference-grid">${groups.map(group=>summaryCard({title:group.title,level:3,className:'reference-material',meta:`<p>${e(group.decision==='accepted'?'Выбрано владельцем':'Предложение для просмотра')}</p>`,content:`<p>${e(group.description)}</p>`,actions:list(group.links).map(link=>textLink({label:link.label,href:(link.path.endsWith('.md')?'/report':'/asset')+'?path='+encodeURIComponent(link.path),attributes:{target:'_blank',rel:'noopener noreferrer'}})).join('')})).join('')}</div>`})
}
export function renderReferenceMaterials(data,state={}) {
  const retry=button({label:'Повторить загрузку',attributes:{'data-reference-retry':true}})
  if(data.state!=='ready')return emptyState({kind:['error','unsupported'].includes(data.state)?'unavailable':'first-use',title:data.state==='awaiting'?'Материалы готовятся':data.state==='unregistered'?'Материалы продукта пока не добавлены':'Материалы недоступны',description:data.message,actions:retry})
  const library=librarySelect(data),issues=list(data.issues).length?notice({kind:'warning',message:list(data.issues).join('\n')}):''
  return collectionLayout({className:'reference-product-materials',filters:library?filterBar({label:'Библиотека материалов',open:state.filtersOpen,active:Boolean(state.library&&state.library!==data.libraries?.[0]?.id),content:library}):'',notice:issues,content:(designMaterials(data)||emptyState({kind:'first-use',title:'Материалы продукта пока не добавлены',description:'В выбранной библиотеке нет наших текстов, персонажей или вариантов оформления.'}))})
}
// One captured screen is an example image next to its explanation, not a numbered flow.
function exampleScreenSection(row,data,title='Экран примера',shown=new Set()) {
  const c=row.card,media=list(c.media),step=list(c.steps)[0],view=row.readingView
  const sameText=(a,b)=>norm(a)===norm(b)&&String(a??'').trim()!==''
  const paragraphs=[
    view?.example?`<p class="reference-example"><strong>Пример задания:</strong> ${e(view.example)}</p>`:'',
    view?.note?`<p class="reference-meta">${e(view.note)}</p>`:'',
    step&&!sameText(step.whatHappens,c.description)&&!sameText(step.whatHappens,view?.summary)?`<p>${readingText(step.whatHappens,row)}</p>`:'',
  ].filter(Boolean)
  // The concrete action and the app's answer belong beside this very screen, exactly once.
  const rows=[
    step&&!knownEmpty(step.userAction)?{label:'Что делает человек',value:readingText(step.userAction,row)}:null,
    step&&!knownEmpty(step.productResponse)?{label:'Что показывает приложение',value:readingText(step.productResponse,row)}:null,
  ].filter(Boolean)
  for(const v of [step?.userAction,step?.productResponse,step?.whatHappens,view?.example,view?.note])if(!knownEmpty(v))shown.add(norm(scalar(v)))
  const pictures=media.map(m=>image(data,row,m)).join('')
  if(!pictures&&!paragraphs.length&&!rows.length)return notice({kind:'warning',message:'Изображения не сохранены. Пример описан по текстовым источникам.'})
  const notes=paragraphs.length||rows.length?`<div class="reference-step-notes">${paragraphs.join('')}${rows.length?proseFacts({items:rows}):''}</div>`:''
  return readingSection({title,content:`<div class="${pictures&&notes?'reference-step-layout':'reference-screen-stacked'}">${pictures?`<div class="reference-step-pictures">${pictures}</div>`:''}${notes}</div>`})
}
// The saved adaptation is a proposal: main text carries concrete takeaways; the recorded idea and conditions stay archived.
function adaptationSection(c) {
  const a=c.adaptation
  if(!a)return '<p>Идеи применения пока не описаны.</p>'
  const rows=[
    list(a.whatToKeep).length?{label:'Что взять из примера',value:`<ul>${a.whatToKeep.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
    list(a.whatToChange).length?{label:'Что можно поменять под нас',value:`<ul>${a.whatToChange.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
    list(a.risks).length?{label:'На что обратить внимание',value:`<ul>${a.risks.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
  ].filter(Boolean)
  return rows.length?proseFacts({items:rows}):'<p>Идеи применения пока не описаны.</p>'
}
export function renderReferences(data,state={}) {
  const retry=button({label:'Повторить загрузку',attributes:{'data-reference-retry':true}})
  if(data.state!=='ready')return emptyState({kind:data.state==='error'||data.state==='unsupported'?'unavailable':'first-use',title:data.state==='awaiting'?'Библиотека собирается':data.state==='unregistered'?'Референсы пока не добавлены':'Библиотека недоступна',description:data.message,actions:retry})
  const parent=referenceRoute({...state,card:''}),rows=list(data.cards)
  const issues=list(data.issues).length?notice({kind:'warning',message:list(data.issues).join('\n')}):''
  if(state.card) {
   const row=rows.find(r=>r.card.id===state.card)
   if(!row)return emptyState({kind:'unavailable',title:'Карточка не найдена',description:'Ссылка устарела или направление ещё не собрано.',actions:textLink({label:'← К референсам',href:'#'+parent})})
   const c=row.card,media=list(c.media),used=new Set(list(c.steps).flatMap(s=>list(s.screenshotIds)))
   const stepsHeading={path:'Состояния на экране',onboarding:'Шаги первого входа',rpg:'Как проходит механика',characters:'Как показан пример'}[row.trackKey]||'Шаги в приложении'
   const purposes=list(c.steps).map(s=>typeof s.purpose==='string'?s.purpose.trim():'').filter(Boolean)
   const sharedPurpose=purposes.length===list(c.steps).length&&list(c.steps).length>1&&new Set(purposes.map(norm)).size===1?purposes[0]:''
   const shownPurposes=new Set()
   const step=(s,index)=>{
    const stepSources=s.sourceId?[s.sourceId]:c.sourceIds
    const pictures=list(s.screenshotIds).map(id=>{const m=media.find(m=>m.id===id);return m?image(data,row,m):notice({kind:'warning',message:'Скриншот этого шага не найден.'})}).join('')
    const nextIsRepeated=typeof s.productResponse==='string'&&s.productResponse.startsWith('После указанного действия наблюдался следующий экран:')
    const purposeLabel=['editor_inference','inferred'].includes(s.purposeBasis)?'Зачем нужен этот шаг — наша оценка':'Зачем нужен этот шаг'
    const sameAsIntro=(a,b)=>norm(a)===norm(b)&&String(a??'').trim()!==''
    // Unknown actions or responses are not printed as rows; the archive keeps them.
    // A response or action already told by this step's own sentence is not repeated as a row.
    const actionRow=knownEmpty(s.userAction)||sameAsIntro(s.userAction,s.whatHappens)?null:{label:'Что делает человек',value:readingText(s.userAction,row)}
    const responseRow=nextIsRepeated||knownEmpty(s.productResponse)||sameAsIntro(s.productResponse,s.whatHappens)?null:{label:'Как отвечает приложение',value:readingText(s.productResponse,row)}
    for(const v of [s.whatHappens,s.userAction,s.productResponse])if(!knownEmpty(v))shown.add(norm(scalar(v)))
    const repeatedPurpose=sharedPurpose||knownEmpty(s.purpose)||shownPurposes.has(norm(s.purpose))
    if(!sharedPurpose&&!knownEmpty(s.purpose))shownPurposes.add(norm(s.purpose))
    const purposeRow=repeatedPurpose?null:{label:purposeLabel,value:valueText(s.purpose,row)}
    return `<li value="${Number.isInteger(s.order)&&s.order>0?s.order:index+1}"><h3>${e(s.title||'Шаг без названия')}</h3><div class="reference-step-layout"><div class="reference-step-pictures">${pictures||'<p>Скриншот этого шага не сохранён.</p>'}</div><div class="reference-step-notes">${!sameAsIntro(s.whatHappens,c.description)&&!sameAsIntro(s.whatHappens,row.readingView?.summary)?`<p>${readingText(s.whatHappens,row)}</p>`:''}${[actionRow,responseRow,purposeRow].filter(Boolean).length?proseFacts({items:[actionRow,responseRow,purposeRow].filter(Boolean)}):''}<p>${sourceNote({variant:'link',text:'Описание и источник шага',content:`<p>${valueText(s.whatHappens,row)}</p><p>Действие: ${valueText(s.userAction,row)}</p><p>Ответ приложения: ${valueText(s.productResponse,row)}</p>`+sourceList({entries:sourceEntries(row,stepSources)})})}</p></div></div></li>`
   }
   const onboarding=row.trackKey==='onboarding'&&list(c.steps).length>0
   const singleScreen=list(c.steps).length<=1
   const shown=new Set([c.description,row.readingView?.summary,row.readingView?.example].filter(v=>typeof v==='string'&&v.trim()).map(norm))
   const title=row.readingView?.title||(onboarding?`Первый вход в ${c.product?.name||'приложение'}`:c.title||'Пример')
   const introduction=row.readingView?.summary||(onboarding?'Скриншоты первого входа и объяснение каждого шага. Показан один выбранный сценарий; другие варианты могут отличаться.':c.description)
   const introSource=sourceNote({variant:'link',text:'Как собран этот пример',content:`<p>${e(scalar(c.description))}</p><p>${e(named(c.observationType))} · ${e(named(c.verification?.status))}</p>${row.readingView?'<p>Название и краткое объяснение отредактированы по сохранённым материалам. Исходное описание приведено выше.</p>':''}`+sourceList({entries:sourceEntries(row,c.sourceIds)})})
   const boundary=boundaryReading(row),gaps=list(c.gaps)
   const plain=t=>String(t).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
   const limitationKeys=new Set(),limitationItems=[]
   for(const item of [...boundary.map(html=>({html})),...gaps.map(g=>{const text=g&&typeof g==='object'?(typeof g.note==='string'?g.note:typeof g.text==='string'?g.text:null):scalar(g);return text?{html:e(deangle(text))}:null}).filter(Boolean)]){const key=norm(plain(item.html));if(key&&!limitationKeys.has(key)){limitationKeys.add(key);limitationItems.push(item)}}
   const extraImages=!singleScreen?media.filter(m=>!used.has(m.id)):[]
   const reading=paperSurface({content:`
    <p class="reference-meta">Направление: ${e(directionTitle(row.trackKey,row.trackTitle))} · ${e(c.product?.name||'Продукт не указан')}</p>
    <p class="reference-introduction">${readingText(introduction,row)}</p>
    ${singleScreen?'':readingExample(row)}
    <p class="reference-intro-source">${introSource}</p>
    ${singleScreen?exampleScreenSection(row,data,row.trackKey==='exercises'?'Пример из приложения':'Экран примера',shown):extraImages.length?readingSection({title:'Пример из приложения',content:`<div class="reference-media">${extraImages.map(m=>image(data,row,m)).join('')}</div>`}):!media.length?notice({kind:'warning',message:'Изображения не сохранены. Пример описан по текстовым источникам.'}):''}
    ${!singleScreen&&list(c.steps).length?readingSection({title:stepsHeading,intro:sharedPurpose?`Зачем показаны эти экраны — ${e(deangle(sharedPurpose))}${['editor_inference','inferred'].includes(list(c.steps)[0].purposeBasis)?' (наша оценка)':''}.`:'' ,content:`<ol class="reference-steps">${list(c.steps).map(step).join('')}</ol>`}):''}
    ${trackReadingSections(row,shown)}
    ${leftoverObservations(row)}
    ${readingSection({title:'Что можно взять для своего продукта',content:adaptationSection(c)})}
    ${readingSection({title:'Чего этот пример не показывает',content:`${limitationItems.length?`<ul>${limitationItems.map(item=>`<li>${item.html}</li>`).join('')}</ul>`:'<p>Ограничения не перечислены; полноту примера ещё нужно проверить.</p>'}`})}`})
   const technical=disclosure({title:'Технические данные карточки',className:'reference-technical',content:`<p>Исходный вид сохранённых полей, включая неизвестные значения и служебные данные сборки.</p>${facts(c.details??null,row,true)}${list(c.steps).length?`<h3>Шаги как сохранены</h3>${facts(c.steps,row,true)}`:''}${c.adaptation?`<h3>Идея применения как сохранена</h3>${facts(c.adaptation,row,true)}`:''}${gaps.length?`<h3>Ограничения как сохранены</h3>${facts(c.gaps,row,true)}`:''}`})
   // One compact entry keeps six archives reachable without sprawling the footer.
   const materials=readingSection({title:'Источники и подробности',content:disclosure({title:'Исходные материалы',className:'reference-sources',bodyClassName:'reference-sources-body',content:`
    ${sourceList({entries:sourceEntries(row,[...new Set([...list(c.sourceIds),c.primarySourceId,...list(c.claims).map(cl=>cl.sourceId),...media.map(m=>m.sourceId)].filter(Boolean))])})}
    ${list(c.claims).length?disclosure({title:'Дополнительные факты из источников',className:'reference-technical',content:list(c.claims).map(cl=>`<article class="reference-claim"><p>${sourced(cl.text,row,[cl.sourceId],`<p>Где найти в оригинале: ${e(scalar(cl.locator))}</p>`)}</p><p class="reference-meta">${e(named(cl.support))}</p></article>`).join('')}):''}
    ${originalCheckedData(c)?disclosure({title:'Исходный отчёт по направлению',className:'reference-technical',content:originalCheckedData(c)}):''}
    ${accessDetails(c)}
    ${disclosure({title:'Как проверяли источники',className:'reference-technical',content:`${facts(c.verification??null,row,true)}<p>Проверка источников подтверждает сохранённые наблюдения, но не пользу механики для нашего продукта.</p>`})}
    ${technical}`})})
   return detailLayout({className:'reference-detail',header:pageHeader({title,level:2,back:filterLink({label:'← К референсам',href:'#'+parent}),backTight:true}),notice:issues,content:reading+materials})
  }
  const tracks=list(data.library.tracks).filter(t=>t&&typeof t.key==='string'),products=[...new Map(rows.map(r=>[r.card.product?.id||'',r.card.product?.name||'Продукт не указан'])).entries()]
  const count=key=>rows.filter(r=>(!key||r.trackKey===key)&&(!state.competitor||r.card.product?.id===state.competitor)).length
  const select=(label,key,choices,all)=>field({name:key,label,type:'select',attributes:{id:'reference-'+key,'data-reference-filter':key},optionsHtml:`${state[key]&&!choices.some(([id])=>id===state[key])?`<option value="${e(state[key])}" selected disabled>${e(label)} по ссылке ${key==='track'?'недоступно':'недоступен'}</option>`:''}<option value=""${!state[key]?' selected':''}>${e(all)}</option>${choices.map(([id,title])=>`<option value="${e(id)}"${state[key]===id?' selected':''}>${e(title)}</option>`).join('')}`})
  const filters=filterBar({label:'Фильтры референсов',open:state.filtersOpen,active:Boolean(state.track||state.competitor||state.library&&state.library!==data.libraries?.[0]?.id),content:librarySelect(data)+select('Направление','track',tracks.map(t=>[t.key,`${directionTitle(t.key,t.title)} · ${count(t.key)}`]),'Все направления')+select('Конкурент','competitor',products,'Все конкуренты')+(state.track||state.competitor?button({label:'Сбросить фильтры',href:'#'+referenceRoute({library:state.library})}):'')})
  const matching=rows.filter(r=>(!state.track||r.trackKey===state.track)&&(!state.competitor||r.card.product?.id===state.competitor)),filtered=state.track?matching:overviewOrder(matching,tracks),size=12,total=Math.max(1,Math.ceil(filtered.length/size)),requested=Number(state.page),page=Math.min(total,Math.max(1,Number.isSafeInteger(requested)?requested:1))
  const cards=filtered.slice((page-1)*size,page*size).map(row=>{const c=row.card,view=row.readingView;return `<article class="reference-card os-object-card" data-direction="${e(row.trackKey)}">${metadata(c,view?.format||directionTitle(row.trackKey,row.trackTitle))}<h2>${textLink({label:view?.title||c.title||'Без названия',href:'#'+referenceRoute({...state,page,card:c.id})})}</h2>${view?`<p>${e(view.summary)}</p>`:''}${list(c.media).length?image(data,row,c.media[0],true):'<p>Изображение не сохранено.</p>'}${view?readingExample(row):`<p>${sourced(c.description,row,c.sourceIds)}</p>`}</article>`}).join('')
  const unknownFilter=state.track&&!tracks.some(t=>t.key===state.track)||state.competitor&&!products.some(([id])=>id===state.competitor)
  const status=data.library.status?`<p class="reference-meta">${data.library.status==='ready-for-review-partial'?'Некоторые примеры собраны частично.':'Состояние библиотеки: '+e(labels[data.library.status]||'См. сведения о сборе')}</p>`:''
  const selectedProduct=products.find(([id])=>id===state.competitor)?.[1]
  const context=selectedProduct?'Конкурент: '+selectedProduct:''
  const pages=position=>pagination({page,pages:total,total:filtered.length,size,label:'Страницы референсов: '+position,context,href:p=>'#'+referenceRoute({...state,page:p})})
  const results=readingSection({title:state.track&&tracks.some(t=>t.key===state.track)?directionTitle(state.track,tracks.find(t=>t.key===state.track).title):'Примеры',content:pages('над карточками')+(cards?`<div class="reference-grid">${cards}</div>${total>1?pages('под карточками'):''}`:emptyState({kind:'no-results',title:rows.length?'По этим фильтрам карточек нет':'Карточки ещё не добавлены',description:'Выберите другое направление или конкурента.'}))})
  const packageArea=readingSection({title:'Ограничения подборки',intro:'Эти пробелы учитывайте при выборе примера для своего продукта.',content:`${status}${disclosure({title:'Что ещё не удалось собрать',className:'reference-technical',content:`${facts(data.library.gaps,null)}<p>Ограничения отдельных примеров перечислены внутри карточек.</p>`})}`})
  return collectionLayout({className:'reference-library',filters,notice:issues+(unknownFilter?notice({kind:'warning',message:'В адресе указан отсутствующий фильтр. Сбросьте фильтры, чтобы увидеть библиотеку.'}):''),content:results+packageArea})
}
export function mountReferences(root,{productId,versionKey='',state={},data,view='references',navigate=route=>window.AtlasNavigation?.navigate(route)}={}) {
  const abort=new AbortController();let disposed=false,panel,request=0
  const images=()=>{for(const img of root.querySelectorAll('[data-reference-raster]')){const loading=img.parentElement.querySelector('[data-reference-image-loading]'),error=img.parentElement.querySelector('[data-reference-image-error]'),loaded=()=>{loading.hidden=true},failed=()=>{img.hidden=true;loading.hidden=true;error.hidden=false};img.addEventListener('load',loaded,{signal:abort.signal});img.addEventListener('error',failed,{signal:abort.signal});if(img.complete)img.naturalWidth?loaded():failed()}}
  const render=value=>{if(disposed)return;data={...value,productId};root.innerHTML=view==='materials'?renderReferenceMaterials(data,state):renderReferences(data,state);root.removeAttribute('aria-busy');images()}
  async function load(refresh=false){const token=++request,scope={productId,library:state.library||'',versionKey},cached=!refresh&&referenceLibraryCache.peek(scope);if(cached){render(cached);return}root.setAttribute('aria-busy','true');root.innerHTML=loadingState({label:view==='materials'?'Загрузка материалов…':'Загрузка референсов…'});try{const value=await referenceLibraryCache.load(scope,{refresh});if(token===request)render(value)}catch(error){if(token===request)render({state:'error',message:'Не удалось загрузить библиотеку. Повторите попытку.'})}}
  root.addEventListener('change',event=>{const key=event.target.dataset.referenceFilter;if(key)navigate((view==='materials'?referenceMaterialsRoute:referenceRoute)({...state,[key]:event.target.value,page:1,card:''}))},{signal:abort.signal})
  root.addEventListener('click',event=>{if(event.target.closest('[data-reference-retry]')){load(true);return}const b=event.target.closest('[data-reference-image]');if(!b)return;const row=list(data?.cards).find(r=>r.card.id===b.dataset.referenceCard),m=list(row?.card.media).find(m=>m.id===b.dataset.referenceImage);if(!m)return;panel=evidencePanel({title:named(m.caption||m.alt||'Изображение референса'),trigger:b,content:`<div class="reference-enlarged"><img src="${e(imageURL(data,row.card,m))}" alt="${e(named(m.alt||m.caption||'Изображение референса'))}"></div>${sourceList({entries:sourceEntries(row,[m.sourceId])})}`});const img=panel.element.querySelector('img');img.addEventListener('error',()=>{img.replaceWith(Object.assign(document.createElement('p'),{textContent:'Изображение недоступно.'}))},{once:true})},{signal:abort.signal})
  const ready=data?(render(data),Promise.resolve()):load()
  return {ready,destroy(){disposed=true;abort.abort();panel?.destroy()}}
}
