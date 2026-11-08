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
const countWords=(number,one,few,many)=>number===1?one:many
const directionNames={characters:"Characters",exercises:"Exercises",rpg:"Game mechanics",path:"Study path",onboarding:"Getting to know the application",personalization:"Goals and personalization",progress:"Progress",reminders:"Reminders",ui_voice:"Interface, emotions and dialogues"}
const directionTitle=(key,fallback)=>directionNames[key]||fallback||"Direction without name"
const labels = {
  firsthand_ui:"Viewed in the application",official_screenshot:"Official screenshot",official_demo:"Official demo",third_party_walkthrough:"User video review",documented_feature:"Function description",user_report:"User review",reconstructed:"Restored example",proposed_adaptation:"Idea for our product",
  direct:"Straight base",inferred:"Interpretation",unknown:"Unknown",source_stated:"Specified by source",editor_inference:"Author's output",not_checked:"Not checked",verified:"Source check completed",mixed:"There are discrepancies",unconfirmed:"Not confirmed",proposed:"Offer",draft:"Draft",conflicting:"Conflicting information",
  name:"Name",appearance:"Appearance",biography:"Biography",personality:"Character",role:"Role",speech:"Speech",voice:"Voice",emotions:"Emotions",relationships:"Relationships",memory:"Memory",states:"States",contexts:"Contexts",exerciseTypeId:"Exercise type",stimulus:"Job or source material",prompt:"Mission",requiredAction:"User action",exampleAnswer:"Example response",feedback:"Feedback",help:"Help",retry:"Repeat",difficulty:"Difficulty",completion:"Termination",trigger:"Trigger condition",action:"Action",reward:"Reward",progression:"Development",limits:"Restrictions",failure:"Error",destination:"Where does it lead?",optOut:"Disconnection",text:"Text",basis:"Base",status:"Status",claimIds:"Related statements",sourceId:"Source",locator:"Location in source",notes:"Notes",timestamp:"Timecode",page:"Page",section:"Section",screen:"Screen",inspectedAt:"Date viewed",inspectedBy:"Viewed",result:"Result",relevant:"Matches card",not_inspected:"Not viewed",unusable:"Unusable",
  idea:"Application idea",whatToKeep:"What to save",whatToChange:"What to change",risks:"Risks",dependencies:"Dependencies",checkedBy:"Checked",checkedAt:"Check date",issues:"Notes",reopenedSourceIds:"Reopened sources",mediaReviewedIds:"Verified images",
  official_doc:"Official documentation",official_ui:"Official interface",first_party_post:"Product publication",opened:"Open",partial:"Partial access",unavailable:"Not available",
  'ready-for-review':"Ready for viewing",'ready-for-review-partial':"Ready for viewing, there are spaces",
  motivation:"Motivation",speechStyle:"Manner of speech",gestures:"Gestures",helpBehavior:"How it helps",productPosition:"Place in product",variants:"Options",observedInteractions:"Observed interactions",accessNotes:"Access conditions",preferences:"Preferences",additionalExpressions:"Other expressions",biographyInterests:"Biography and interests",voiceEvidenceLimit:"What is known about the voice",sharedProductPersonality:"General character settings",sharedProductMemory:"Product shared memory",productDesignRationale:"Developers' explanation",documentedTouchInteractions:"Touch reactions",featureGenerationNotes:"What has changed in the latest versions",roleLabel:"Role",designRationale:"Developers' explanation",
  observedAnswer:"Answer in example",repeat:"Retry",audioEvidence:"What is known about audio",targetLanguage:"Practice language",preAnswerState:"State before response",specimenBoundary:"Example boundaries",guidance:"Hints",
  next:"Next step",concreteCase:"Specific example",stimulates:"What does it encourage?",possibleIrritation:"What can be annoying",quantitativeExample:"Accrual example",currentAvailability:"Current availability",scopeNote:"Application area",limitationsOfEvidence:"Surveillance restrictions",retentionEffect:"Returnability data",failureEvidence:"What is known about errors",
  algorithm:"How the next step is selected",urgentTaskEvidence:"What is known about the urgent task",durationSeconds:"Duration in seconds",audioObserved:"Audio heard",continuity:"Sequence connectivity",displayNumbersBasis:"Base of numbers on screen",displayTotalMinutes:"Time on screen in minutes",
  shortTitle:"Title",accessMode:"Access conditions",interfaceLanguage:"Interface language",learningLanguage:"Learning language",accountState:"Account status",paywallObserved:"Payment offer observed",paywallScope:"Payment monitoring limits",permissionState:"Permission requests",skipState:"Skipable",branchInputs:"Elections in this thread",observedOutput:"Shown result",mentorNamesVisible:"Mentor names on screen",capturePeriod:"Observation period",visibleUiStepNumbers:"Step numbers on screen",hoverNote:"Hover behavior",imageComposition:"Image composition",
  inputs:"What the user specifies",observedOutputs:"How the product responds",internalAlgorithm:"What is known about the algorithm",inputOutputEvidence:"Relationship between choice and outcome",beforeAfter:"Before and after",surfacePlatform:"Platform",sourceDateMeaning:"What does the source date mean?",
  progressTypes:"Progress types",measuredObject:"What is being measured",observedNumbers:"Numbers in example",numberProvenance:"Where did the numbers come from?",scaleLimits:"Scale limits",beforeAfterSameSpeaker:"Comparison of records of one person",comparisonEvidence:"Comparison basis",editorAnalysis:"Author's output",relatedDocumentedFeature:"Related function",
  messageParaphrase:"Message retelling",messageText:"Message text",knownTrigger:"When appears",triggerBasis:"Condition basis",cta:"Suggested action",destinationBasis:"What is known about the transition",tapObserved:"Pressing observed",productionFrequency:"Sending frequency",ctaPresentation:"Action shown",ctaBasis:"Reason for action",channel:"Channel",visibleCondition:"Condition on screen",suppression:"When the message is not sent",conditionThresholds:"Threshold values",desiredAction:"Expected action",desiredActionBasis:"Reason for expected action",visibleControls:"Screen settings",inputCaptured:"Saved selection",saveResult:"Result of saving",permissionPresentation:"How permission is requested",visibleCategories:"Notification categories",accessConstraint:"Access restrictions",visibleRoutePanels:"Transition Screens",isPreviewMessage:"Demo text",exampleDeliveryObserved:"Message delivery observed",dailyNotificationScenario:"Daily scenario",activationDelayMaxHours:"Maximum delay in hours",illustratedPlatform:"Platform in the image",scenarios:"Scripts",documentedDailyCap:"Message limit per day",dailyCapBasis:"Limit base",
  expectedUserAction:"User action",characterEmotion:"Character emotion",gesture:"Gesture",sound:"Sound",previousTurn:"Previous replica",nextObservedState:"Next observed state",retentionEvidence:"Returnability data",dialogue:"Dialogue",voiceExample:"Speech example",documentedBehavior:"Described behavior",liveOutcome:"Result in application",secondAttempt:"Second attempt",selectedState:"Selected state",contradiction:"Contradiction",feedbackValidity:"Evaluation restrictions",performanceAssessment:"Result evaluation",sourceAvailabilityConflict:"Source availability discrepancy",
  sequenceContinuity:"Screen connectivity",sessionContinuity:"Session connectivity",versionSessionContinuity:"Version coherence",sequenceType:"What the screens show",textRef:"Text source",copyMode:"Transfer form",goal:"Target",focus:"Focus",native:"Mother tongue",target:"Target language",experience:"Experience",desiredOutcome:"Desired result",concern:"Alarm",weakSkill:"Weak skill",newLesson:"New lesson",legendaryOption:"Legendary mode",review:"Repetitions",unit:"Unit",kind:"View",startContext:"Start of context",endContext:"End of context",sequenceBasis:"Sequence base",genre:"Genre",accessBoundary:"Access limits"
}
const omittedDescription="Part available in original image/source; see saved locator and exact source field in assemblyProvenance."
const named = value => value === null || value === undefined || value === ''?"Unknown":value===true?"Yes":value===false?"No":value===omittedDescription?"Details are in the full direction material.":labels[value]||String(value)
const scalar = value => value!==null&&typeof value==='object'?(Array.isArray(value)?value.map(scalar).join(' · '):Object.entries(value).map(([key,v])=>`${labels[key]||key}: ${scalar(v)}`).join(' · ')):named(value)

// Display boundary: saved codes and enum markers become Russian or stay in the technical view.
const languageNames={ru:"Russian",en:"English",ja:"Japanese",de:"German",es:"Spanish",fr:"French",ko:"Korean",it:"Italian",pt:"Portuguese",zh:"Chinese",ar:"Arabic",hi:"Hindi",tr:"Turkish",pl:"Polish",nl:"Dutch"}
const decodedValues={
  'unknown':"unknown",'not_observed':"not observed",'not established':"not installed",'not observed':"not observed",'not_accessed':"the application was not installed",
  'Illustrative still(s); not a captured continuous app session':"individual illustration frames rather than a recorded continuous application session",
  'not a captured session':"Application session not recorded",
  'unknown across cut from processing to result; no independent app replay':"transition from processing to result is not confirmed by a separate repeat",
  'unknown unless explicit sequence below':"unknown without explicit screen sequence",
  'unknown unless source states it':"unknown unless the source specifies otherwise",
  same_session_observed:"one continuous viewing",same_session_with_capture_gap:"one view with a skip in the recording",same_session_with_transition_gap:"one view with skip transition",unestablished:"continuity not established",unestablished_mixed_platform_dossier:"continuity not established: materials from different platforms",
  'official illustrated state sequence':"Official Illustration State Series",'official annotated help collage; ordering explanatory, session unknown':"official certificate collage; explanatory order, session unknown",
  single_map_states:"separate states of one card",chapter_gate:"transition between chapters",completion_exit:"exit on completion",documented_lesson_history:"documented lesson history",documented_resume:"documented resume",documented_route:"documented route",format_node:"format selection node",
  'published_images_and_help':"official images and help",'documented_only':"documentation only",comparable:"comparable to our format",partial_match:"partially similar to our format",related_format:"adjacent format",
  direct_paraphrase:"retelling of what was seen on the screen",editor_inference:"our assessment",'editor_inference_from_visible_stimulus; not backend eligibility':"our assessment based on what is visible on the screen; the actual delivery was not checked",'source_stated_intent':"stated by source",
  push:"Push notifications",email:"Letters to the post office",
  daily:"daily reminder",comeback:"return after a break",continuation:"continued practice",event:"event",pause:"after the break",documented:"documented example",
  button:"button",settings_controls:"screen settings",textual_invitation:"text invitation",
  audio_present:"audio saved",'no_audio_stream_in_saved_file':"there is no audio track in the saved file",'not independently listened':"not listened to independently",'not independently listened/validated':"not independently listened to or verified",'not attempted':"not executed",'unknown; no observed error or failed action':"unknown; No errors or unsuccessful actions were observed",
  source_condition:"only the condition is described in the source",
  published_comparison:"published comparison",'published_instruction_with_gaps':"official instructions with spaces",single_state:"one state shown",
  'rendered promotional fragment':"advertising render fragment",'staged promotional dialogue':"staged advertising dialogue",'visible transcript fragment':"visible transcript fragment",'greeting visible':"greeting visible",'greetings visible':"greetings visible",
  'firsthand captures/actions':"action and first-hand footage",'firsthand clicks and captures':"clicks and first-hand footage",'gallery order; scroll substates grouped':"gallery order; scroll substates are grouped",confidence:"confidence",levels:"levels",'course-progress':"course progress",'only this observed prefix':"only part of the path shown",'anonymous new visitor; no account created':"anonymous new visitor; account was not created",'anonymous; no account created':"anonymous browsing; account was not created",'anonymous; no new account':"anonymous browsing; without a new account",'gallery has signup and named profile; new/existing continuity unknown':"the gallery has registration and a personal profile; continuity of new/existing account is unknown",'named home screen in public tester capture; account history unknown':"personalized home screen in the tester's public record; account history unknown",'signup shown, later returning-user wording; continuity unknown':"registration is shown, followed by wording for the returning user; continuity unknown",'in-page primer declined; OS/browser permission unknown outside branch':"Built-in training request rejected; system resolution outside this branch is unknown",'iOS-styled prompt visible; actual OS invocation and outcome unknown':"iOS style query shown; the actual system call and its result are unknown",'not_observed in prefix':"not observed in the part shown",'not_observed in retained article images':"was not observed in the saved images of the article",'close control on sign-in visible; outcome unknown':"the closing cross at the input is visible; outcome unknown",'paywall skip/decline visible; selection unknown':"pass and refusal of payment are visible; choice unknown",career:"career",'work/immigration':"work or emigration",speaking:"spoken language",'first exam':"first exam",'converse confidently':"Conduct a conversation confidently",'XP':'XP','player commendations':"player approvals",'date unknown; document created 2024-06-28':"date unknown; document created 06/28/2024",
  'source_ui_example; not Speaky parameters':"example from the source interface; not Speaky parameters",'source_marketing_example; not Speaky parameters':"marketing source example; not Speaky parameters",'published mobile UI, iOS-style; exact OS unknown':"public mobile interface in iOS style; exact OS unknown",'date shown by page; may be update date, not capture or build date':"date on page; may be an update date, not a shooting or assembly date",
}
const conflictStates=new Set(['conflicting','mixed','unconfirmed'])
// Fields whose values are pipeline codes: they reach the main text only decoded, otherwise they stay in the archive views.
const enumFields=new Set(['triggerBasis','ctaBasis','destinationBasis','desiredActionBasis','referenceClassBasis','visibleConditionBasis','dailyCapBasis','inputOutputEvidence','referenceClass','channel','ctaPresentation','currentAvailability','sequenceContinuity','sessionContinuity','versionSessionContinuity','urgentTaskEvidence','previousTurn','liveOutcome','secondAttempt','sourceDateMeaning','surfacePlatform','capturePeriod','illustratedPlatform','nativeAppAccess','evidenceGenre','formatFit','genre','sequenceGenre','sequenceType','accountState','paywallScope','permissionState','skipState'])
const technicalFields=new Set(['screenState','accessMode','exerciseTypeId','claimIds','sourceId','locator','checkedBy','checkedAt','inspectedBy','inspectedAt','reopenedSourceIds','mediaReviewedIds','fieldProvenance','sourcePeriods','unknownFields','fieldEvidenceStatus','collectorProvenance','claimIdsByField','detailProvenance','sessionId','primaryLocator','observationLocator','canonicalLocator','optOutCardId','nativeAppAccess','picturedBuild','documentVersion','evidenceGenre','quotaEligible','quotaBasis','quotaClass','quotaExclusionReason','formatFit','countsTowardImageQuota','relatedTrackReferences','countAsNewGlobalExample','directQuoteWords','verifierReplay','workflowRunId','referenceClassBasis','visibleConditionBasis','dailyCapBasis','qualifyingNodePath','actualSessionObserved','observedRuntimeTransitions','evidenceScope','continuityCheck','relatedDocumentedFeature','contentVersionDate','frameSourceId','independentVerification'])
// Important saved negatives become one readable sentence each instead of «Unknown» rows.
const statementFields={
  paywallObserved:v=>v===false?"Payment was not offered for the part shown":v===true?"The part shown offered payment":null,
  fullProposedCycleObserved:v=>v===false?"The full cycle of the task - up to the result and assessment - has not been viewed":null,
  promptIsParaphrase:v=>v===true?"The task on the screen retells the original situation":null,
  tapObserved:v=>v===false?"The offer was not clicked":v===true?"Sentence click observed":null,
  completionScreenCaptured:v=>v===false?"Completion screen not cleared":null,
  countsAsActualRpgGame:v=>v===true?"This is a full-fledged game, not an educational simulation of mechanics":null,
  isPreviewMessage:v=>v===true?"This is a demo text, not a real submission":null,
  exampleDeliveryObserved:v=>v===false?"Message delivery was not observed":null,
}
// Limitations that qualify the whole example; decoded and shown as sentences.
const boundaryFields=new Set(['sequenceContinuity','sessionContinuity','versionSessionContinuity','continuity','currentAvailability','previousTurn','liveOutcome','secondAttempt','retentionEffect','failureEvidence','limits','limitationsOfEvidence','scopeNote'])
// The reading model: each direction answers the reader's questions with named blocks, not a field dump.
const trackBlocks={
  characters:[
    ["Who is this character",['name','role','appearance','biography','personality','motivation']],
    ["How he behaves and speaks",['speechStyle','emotions','gestures','observedInteractions','helpBehavior','documentedTouchInteractions','variants','observedAnswer']],
    ["Memory, connections and place in the product",['memory','relationships','productPosition','preferences','biographyInterests','sharedProductPersonality','sharedProductMemory','states','contexts','featureGenerationNotes','productDesignRationale']],
    ["What is known about voice and access",['voice','voiceEvidenceLimit','audioEvidence','accessNotes']],
  ],
  exercises:[
    ["Mission and situation",['stimulus','prompt','concreteCase']],
    ["What does a person do",['requiredAction','expectedUserAction','desiredAction']],
    ["Answer, hints and feedback",['observedAnswer','exampleAnswer','help','guidance','feedback','repeat','retry']],
    ["Example conditions",['targetLanguage','learningLanguage','difficulty','completion','durationSeconds','audioObserved','audioEvidence','preAnswerState','accessBoundary']],
  ],
  rpg:[
    ["How the mechanics start",['trigger','knownTrigger']],
    ["What's happening",['action','feedback','failure']],
    ["Reward and development",['reward','progression','next','quantitativeExample']],
    ["Numbers and genre example",['concreteCase','genre']],
    ["Our material ratings",['stimulates','possibleIrritation']],
  ],
  path:[
    ["How the path is arranged",['algorithm','destination','sequenceType']],
    ["Urgent task",['urgentTaskEvidence']],
  ],
  onboarding:[
    ["Example languages",['interfaceLanguage','learningLanguage','targetLanguage']],
    ["Viewing conditions",['accountState','paywallScope','permissionState','skipState','capturePeriod','accessNotes','hoverNote','imageComposition','mentorNamesVisible','visibleUiStepNumbers']],
    ["Elections and branch result",['branchInputs','observedOutput','observedOutputs']],
  ],
  personalization:[
    ["What does the person ask?",['inputs']],
    ["How the product responds",['observedOutputs','observedOutput','internalAlgorithm']],
    ["How complete is the observation?",['inputOutputEvidence','beforeAfter','sourceDateMeaning','surfacePlatform','accessNotes']],
  ],
  progress:[
    ["What progress shows",['progressTypes','measuredObject']],
    ["Numbers in example",['observedNumbers','displayNumbersBasis','displayTotalMinutes','numberProvenance','scaleLimits']],
    ["Comparison and our ratings",['beforeAfterSameSpeaker','comparisonEvidence','editorAnalysis','performanceAssessment']],
  ],
  reminders:[
    ["Which message is shown",['messageText']],
    ["When appears",['knownTrigger','productionFrequency','dailyNotificationScenario','suppression','conditionThresholds','documentedDailyCap','visibleCondition']],
    ["What does he propose to do?",['cta','ctaPresentation','destination','desiredAction']],
    ["Channel and disconnect",['channel','optOut','visibleControls','visibleCategories','permissionPresentation','accessConstraint']],
  ],
  ui_voice:[
    ["What is shown",['stimulus','documentedBehavior','imageComposition']],
    ["What does a person do",['expectedUserAction','gesture','characterEmotion']],
    ["Speech and sound",['dialogue','voiceExample','nextObservedState','sound']],
    ["How the sequence was filmed",['sequenceGenre']],
  ],
}
const languageFields=new Set(['interfaceLanguage','learningLanguage','targetLanguage','native','target'])
const knownEmpty=v=>v===null||v===undefined||v===''||v===omittedDescription
// Values equal up to whitespace, case and trailing punctuation are one text for the reader.
const norm=t=>String(t??'').replace(/\s+/g,' ').replace(/[.;:,!?«»"']+$/,'').trim().toLowerCase()
// The editorial vocabulary of saved proposals: closed phrase list, applied only to adaptation display.
const glossRules=[
  [/Ручной review/g,"Manual check"],[/ручного review/g,"manual check"],[/после review/g,"after verification"],
  [/\bReview\b/g,"Check"],[/\breview\b/g,"checks"],[/\bretention\b/gi,"return to application"],
  [/целевая модальность/gi,"required form of practice"],[/целевой модальности/gi,"the desired form of practice"],
]
const gloss=text=>typeof text==='string'?glossRules.reduce((acc,[from,to])=>acc.replace(from,to),text):text
// Mixed Russian prose gets its inline English markers translated; literal foreign example text stays untouched.
const deangle=text=>typeof text==='string'&&/[а-яё]/i.test(text)?text.replace(/\s*\bunknown\b\s*\./gi," - no data.").replace(/\s*\bunknown\b/gi," - no data").replace(/\bnot observed\b/gi,"not observed"):text
const decode=v=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(decodedValues,v)?decodedValues[v]:undefined

function publicURL(value) {
  if(typeof value!=='string'||/[\u0000-\u0020\u007f\\]/.test(value))return ''
  try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}
}
function sourceEntries(row,ids) {
  return list(ids).map(id=>{const s=list(row?.sources).find(s=>s.id===id);return s?{title:s.title||"Source",href:publicURL(s.url),meta:[named(s.sourceType),`Access: ${named(s.accessStatus)}`,`Platform: ${named(s.platform)}`,`Version: ${named(s.version)}`,`Published: ${named(s.publishedAt)}`,`Saved: ${named(s.retrievedAt)}`].join(' · '),context:s.notes?`<p>${e(scalar(s.notes))}</p>`:''}:{title:"Source not linked",meta:String(id)}})
}
function readerLink(value,extension,label) {
  return typeof value==='string'&&/^(reports|sources)\//.test(value)&&!/[\\\u0000-\u001f\u007f]/.test(value)&&value.split('/').every(part=>part&&!part.startsWith('.'))&&value.endsWith(extension)?textLink({label,href:(extension==='.md'?'/report':'/asset')+'?path='+encodeURIComponent(value),attributes:{target:'_blank',rel:'noopener noreferrer'}}):''
}
const fullDescription = row => readerLink(row?.card?.assemblyProvenance?.originalReportPath,'.md',"Details - in the original direction report")||e(named(omittedDescription))
const valueText = (value,row) => value===omittedDescription?fullDescription(row):e(scalar(value))
// Main-reading variant: mixed Russian prose is decoded; literal foreign example text stays as saved.
const readingText = (value,row) => value===omittedDescription?fullDescription(row):e(deangle(scalar(value)))
const sourced = (text,row,ids,extra='') => text===omittedDescription?fullDescription(row):sourceNote({text:scalar(text),content:extra+sourceList({entries:sourceEntries(row,ids)})})

// Reading renderer: known, decoded content only. Codes travel through the dictionary or stay archived.
function readingValue(key,value) {
  if(typeof value==='number')return String(value)
  if(typeof value==='boolean')return value?"Yes":"No"
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
      return [e(deangle(value.text))+(conflict?" <span class=\"reference-conflict\">Conflicting information</span>":'')]
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
const detailsHeadings={characters:"Character and behavior",exercises:"How the exercise works",rpg:"Rules and rewards",path:"How the learning path works",personalization:"How the application is adjusted",progress:"What progress shows",reminders:"When and what is sent",ui_voice:"Interface and replica behavior"}
function trackReadingSections(row,shown=new Set()) {
  const groups=(trackBlocks[row.trackKey]||[]).map(([title,fields])=>({title,rows:factRows(fields,row.card.details,shown)})).filter(g=>g.rows.length)
  if(!groups.length)return ''
  const heading=detailsHeadings[row.trackKey]||"More about the example"
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
    // Decoded status facts carry their Russian subject; a raw key or a bare «not observed» explains nothing.
    for(let part of readingParts(key,value)){if(/^неизвестно\.?$/.test(part))part="no data";items.push(`<strong>${e(labels[key]||"Example limitation")}</strong> — ${part}`)}
  }
  const walk=(value,key)=>{if(!value||typeof value!=='object')return
    if(typeof value.status==='string'&&conflictStates.has(value.status)&&typeof value.text==='string'&&!knownEmpty(value.text)&&!blockFields.has(key)&&!boundaryFields.has(key))
      items.push(`${e(labels[key]||key)}: ${e(deangle(value.text))} <span class="reference-conflict">Conflicting information</span>`)
    for(const [k,v] of Object.entries(value))walk(v,k)
  }
  walk(details,'')
  return [...new Set(items)]
}
// Archive view of the remaining saved facts: verbatim wording, codes decoded where the dictionary knows them.
function archiveValue(value) {
  if(typeof value==='boolean')return value?"Yes":"No"
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
  return rows.length?disclosure({title:"More from saved observations",className:'reference-technical',content:`${proseFacts({items:rows})}<p class="reference-meta">The full initial view of the fields is in the technical data of the card.</p>`}):''
}
function facts(value,row,technical=false) {
  if(value===null||typeof value!=='object')return `<p>${valueText(value,row)}</p>`
  if(Array.isArray(value))return value.length?`<ul>${value.map(v=>`<li>${facts(v,row,technical)}</li>`).join('')}</ul>`:"<p>Not specified.</p>"
  const entries=Object.entries(value),visible=technical?entries:entries.filter(([key])=>labels[key]&&!technicalFields.has(key)),other=technical?[]:entries.filter(([key])=>!labels[key]||technicalFields.has(key))
  return `${visible.length?`<dl class="os-facts">${visible.map(([key,v])=>`<div><dt>${e(labels[key]||key)}</dt><dd>${key==='text'&&value.sourceId?sourced(v,row,[value.sourceId]):facts(v,row,technical)}</dd></div>`).join('')}</dl>`:''}${other.length?disclosure({title:`Additional collection information (${other.length})`,className:'reference-technical',content:facts(Object.fromEntries(other),row,true)}):''}`
}
function imageURL(data,card,media) {
  return data.example && /^\/assets\/[a-zA-Z0-9_./-]+\.png$/.test(media.previewURL||'') ? media.previewURL : '/api/product-references/image?'+new URLSearchParams({productId:data.productId,library:data.library.artifactId,card:card.id,media:media.id})
}
const imageDimensions = media => Number.isSafeInteger(media.width)&&media.width>0&&Number.isSafeInteger(media.height)&&media.height>0?` width="${media.width}" height="${media.height}"`:''
function image(data,row,media,thumbnail=false) {
  const c=row.card
  // The visible label describes the example in human terms; capture caption/alt stay inside the source panel.
  const humanAlt=typeof media.alt==='string'&&media.alt.trim()&&media.alt!==media.caption?media.alt.trim():''
  const imageLabel=humanAlt||row.readingView?.title||c.title||"example image"
  return `<figure class="reference-image${thumbnail?' reference-thumbnail':''}"><button type="button" class="reference-image-open" data-reference-image="${e(media.id)}" data-reference-card="${e(c.id)}" aria-label="${e("Increase: "+imageLabel)}"><img loading="lazy"${imageDimensions(media)} src="${e(imageURL(data,c,media))}" alt="${e(imageLabel)}" data-reference-raster><span class="reference-image-loading" data-reference-image-loading>Loading image…</span><span data-reference-image-error hidden>Image not available. The original and spaces are saved in the card.</span></button>${!thumbnail?`<figcaption>${sourceNote({variant:'link',text:"Image source",content:`<p>${valueText(media.caption||"Signature not saved",row)}</p>${media.alt&&media.alt!==media.caption?`<p>Image description: ${e(media.alt)}</p>`:''}<details><summary>Image information</summary><p>Where to find it in the original: ${e(scalar(media.locator))}</p>${facts(media.visualInspection??null,row,true)}</details>`+sourceList({entries:sourceEntries(row,[media.sourceId])})})}</figcaption>`:''}</figure>`
}
const metadata = (c,trackTitle) => `<p class="reference-meta">${e(c.product?.name||"Product not specified")} · ${e(trackTitle||'')}</p>`
const accessDetails = c => disclosure({title:"Version and access conditions",className:'reference-technical',content:`<p>Platform: ${e(named(c.product?.platform))}</p><p>Version: ${e(named(c.product?.version))}</p><p>Access: ${e(named(c.product?.accessMode))}</p>`})
function originalCheckedData(card) {
  const provenance=card.assemblyProvenance
  if(!list(provenance?.boundedFields).length)return ''
  const links=[readerLink(provenance.originalReportPath,'.md',"Full verified catalog"),readerLink(provenance.originalCardsPath,'.json',"Original verified cards")].filter(Boolean)
  return `<p>A shortened parsing is shown here. Full description and data are available in the direction materials.</p>${links.length?`<div class="os-actions">${links.join('')}</div>`:''}`
}
export function referenceRoute({library='',track='',competitor='',page=1,card=''}={}) {
  const q=new URLSearchParams();if(library)q.set('library',library);if(track)q.set('track',track);if(competitor)q.set('competitor',competitor);if(page>1)q.set('page',String(page))
  return 'library/references'+(card?'/'+encodeURIComponent(card):'')+(q.size?'?'+q:'')
}
export function referenceMaterialsRoute({library=''}={}) {
  return 'library/elements?'+new URLSearchParams({documents:'1',...(library?{library}:{})})
}
const librarySelect=data=>list(data.libraries).length>1?field({name:'library',label:"Library",type:'select',attributes:{id:'reference-library','data-reference-filter':'library'},optionsHtml:list(data.libraries).map(l=>`<option value="${e(l.id)}"${l.id===data.library?.artifactId?' selected':''}>${e(l.title)}</option>`).join('')}):''
function aiData(data) {
  return disclosure({title:"Data for AI",className:'reference-ai',content:`<p>Start with a manifesto and a chosen direction. Proposals require manual review.</p><ul>${list(data.files).map(f=>`<li>${textLink({label:f.label,href:(f.path?.endsWith('.md')?'/report':'/asset')+'?path='+encodeURIComponent(f.path||''),attributes:{target:'_blank',rel:'noopener noreferrer'}})}</li>`).join('')}</ul>`})
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
  return view?`${view.example?`<p class="reference-example"><strong>Job example:</strong> ${e(view.example)}</p>`:''}${view.note?`<p class="reference-meta">${e(view.note)}</p>`:''}`:''
}
function designMaterials(data) {
  const groups=list(data.library.designMaterials)
  if(!groups.length)return ''
  return readingSection({id:'reference-design-materials',title:"Documents for elements",intro:"Saved texts, character descriptions and design options.",content:`<div class="reference-grid">${groups.map(group=>summaryCard({title:group.title,level:3,className:'reference-material',meta:`<p>${e(group.decision==='accepted'?"Selected by owner":"Suggestion for viewing")}</p>`,content:`<p>${e(group.description)}</p>`,actions:list(group.links).map(link=>textLink({label:link.label,href:(link.path.endsWith('.md')?'/report':'/asset')+'?path='+encodeURIComponent(link.path),attributes:{target:'_blank',rel:'noopener noreferrer'}})).join('')})).join('')}</div>`})
}
export function renderReferenceMaterials(data,state={}) {
  const retry=button({label:"Retry loading",attributes:{'data-reference-retry':true}})
  if(data.state!=='ready')return emptyState({kind:['error','unsupported'].includes(data.state)?'unavailable':'first-use',title:data.state==='awaiting'?"Materials are being prepared":data.state==='unregistered'?"Product materials have not been added yet":"Materials not available",description:data.message,actions:retry})
  const library=librarySelect(data),issues=list(data.issues).length?notice({kind:'warning',message:list(data.issues).join('\n')}):''
  return collectionLayout({className:'reference-product-materials',filters:library?filterBar({label:"Material library",open:state.filtersOpen,active:Boolean(state.library&&state.library!==data.libraries?.[0]?.id),content:library}):'',notice:issues,content:(designMaterials(data)||emptyState({kind:'first-use',title:"Product materials have not been added yet",description:"The selected library does not contain our texts, characters or design options."}))})
}
// One captured screen is an example image next to its explanation, not a numbered flow.
function exampleScreenSection(row,data,title="Example screen",shown=new Set()) {
  const c=row.card,media=list(c.media),step=list(c.steps)[0],view=row.readingView
  const sameText=(a,b)=>norm(a)===norm(b)&&String(a??'').trim()!==''
  const paragraphs=[
    view?.example?`<p class="reference-example"><strong>Job example:</strong> ${e(view.example)}</p>`:'',
    view?.note?`<p class="reference-meta">${e(view.note)}</p>`:'',
    step&&!sameText(step.whatHappens,c.description)&&!sameText(step.whatHappens,view?.summary)?`<p>${readingText(step.whatHappens,row)}</p>`:'',
  ].filter(Boolean)
  // The concrete action and the app's answer belong beside this very screen, exactly once.
  const rows=[
    step&&!knownEmpty(step.userAction)?{label:"What does a person do",value:readingText(step.userAction,row)}:null,
    step&&!knownEmpty(step.productResponse)?{label:"What the application shows",value:readingText(step.productResponse,row)}:null,
  ].filter(Boolean)
  for(const v of [step?.userAction,step?.productResponse,step?.whatHappens,view?.example,view?.note])if(!knownEmpty(v))shown.add(norm(scalar(v)))
  const pictures=media.map(m=>image(data,row,m)).join('')
  if(!pictures&&!paragraphs.length&&!rows.length)return notice({kind:'warning',message:"Images not saved. The example is described from text sources."})
  const notes=paragraphs.length||rows.length?`<div class="reference-step-notes">${paragraphs.join('')}${rows.length?proseFacts({items:rows}):''}</div>`:''
  return readingSection({title,content:`<div class="${pictures&&notes?'reference-step-layout':'reference-screen-stacked'}">${pictures?`<div class="reference-step-pictures">${pictures}</div>`:''}${notes}</div>`})
}
// The saved adaptation is a proposal: main text carries concrete takeaways; the recorded idea and conditions stay archived.
function adaptationSection(c) {
  const a=c.adaptation
  if(!a)return "<p>Application ideas not yet described.</p>"
  const rows=[
    list(a.whatToKeep).length?{label:"What to take from the example",value:`<ul>${a.whatToKeep.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
    list(a.whatToChange).length?{label:"What can be changed for us",value:`<ul>${a.whatToChange.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
    list(a.risks).length?{label:"What to pay attention to",value:`<ul>${a.risks.map(x=>`<li>${e(gloss(x))}</li>`).join('')}</ul>`}:null,
  ].filter(Boolean)
  return rows.length?proseFacts({items:rows}):"<p>Application ideas not yet described.</p>"
}
export function renderReferences(data,state={}) {
  const retry=button({label:"Retry loading",attributes:{'data-reference-retry':true}})
  if(data.state!=='ready')return emptyState({kind:data.state==='error'||data.state==='unsupported'?'unavailable':'first-use',title:data.state==='awaiting'?"The library is being assembled":data.state==='unregistered'?"No references yet":"Library unavailable",description:data.message,actions:retry})
  const parent=referenceRoute({...state,card:''}),rows=list(data.cards)
  const issues=list(data.issues).length?notice({kind:'warning',message:list(data.issues).join('\n')}):''
  if(state.card) {
   const row=rows.find(r=>r.card.id===state.card)
   if(!row)return emptyState({kind:'unavailable',title:"Card not found",description:"The link is out of date or the direction has not yet been collected.",actions:textLink({label:"← To references",href:'#'+parent})})
   const c=row.card,media=list(c.media),used=new Set(list(c.steps).flatMap(s=>list(s.screenshotIds)))
   const stepsHeading={path:"Screen states",onboarding:"First login steps",rpg:"How the mechanics work",characters:"As shown in the example"}[row.trackKey]||"Steps in the application"
   const purposes=list(c.steps).map(s=>typeof s.purpose==='string'?s.purpose.trim():'').filter(Boolean)
   const sharedPurpose=purposes.length===list(c.steps).length&&list(c.steps).length>1&&new Set(purposes.map(norm)).size===1?purposes[0]:''
   const shownPurposes=new Set()
   const step=(s,index)=>{
    const stepSources=s.sourceId?[s.sourceId]:c.sourceIds
    const pictures=list(s.screenshotIds).map(id=>{const m=media.find(m=>m.id===id);return m?image(data,row,m):notice({kind:'warning',message:"The screenshot of this step was not found."})}).join('')
    const nextIsRepeated=typeof s.productResponse==='string'&&s.productResponse.startsWith("After the specified action, the following screen was observed:")
    const purposeLabel=['editor_inference','inferred'].includes(s.purposeBasis)?"Why this step is needed - our assessment":"Why this step is needed"
    const sameAsIntro=(a,b)=>norm(a)===norm(b)&&String(a??'').trim()!==''
    // Unknown actions or responses are not printed as rows; the archive keeps them.
    // A response or action already told by this step's own sentence is not repeated as a row.
    const actionRow=knownEmpty(s.userAction)||sameAsIntro(s.userAction,s.whatHappens)?null:{label:"What does a person do",value:readingText(s.userAction,row)}
    const responseRow=nextIsRepeated||knownEmpty(s.productResponse)||sameAsIntro(s.productResponse,s.whatHappens)?null:{label:"How the application responds",value:readingText(s.productResponse,row)}
    for(const v of [s.whatHappens,s.userAction,s.productResponse])if(!knownEmpty(v))shown.add(norm(scalar(v)))
    const repeatedPurpose=sharedPurpose||knownEmpty(s.purpose)||shownPurposes.has(norm(s.purpose))
    if(!sharedPurpose&&!knownEmpty(s.purpose))shownPurposes.add(norm(s.purpose))
    const purposeRow=repeatedPurpose?null:{label:purposeLabel,value:valueText(s.purpose,row)}
    return `<li value="${Number.isInteger(s.order)&&s.order>0?s.order:index+1}"><h3>${e(s.title||"Untitled step")}</h3><div class="reference-step-layout"><div class="reference-step-pictures">${pictures||"<p>The screenshot of this step was not saved.</p>"}</div><div class="reference-step-notes">${!sameAsIntro(s.whatHappens,c.description)&&!sameAsIntro(s.whatHappens,row.readingView?.summary)?`<p>${readingText(s.whatHappens,row)}</p>`:''}${[actionRow,responseRow,purposeRow].filter(Boolean).length?proseFacts({items:[actionRow,responseRow,purposeRow].filter(Boolean)}):''}<p>${sourceNote({variant:'link',text:"Step description and source",content:`<p>${valueText(s.whatHappens,row)}</p><p>Action: ${valueText(s.userAction,row)}</p><p>Application response: ${valueText(s.productResponse,row)}</p>`+sourceList({entries:sourceEntries(row,stepSources)})})}</p></div></div></li>`
   }
   const onboarding=row.trackKey==='onboarding'&&list(c.steps).length>0
   const singleScreen=list(c.steps).length<=1
   const shown=new Set([c.description,row.readingView?.summary,row.readingView?.example].filter(v=>typeof v==='string'&&v.trim()).map(norm))
   const title=row.readingView?.title||(onboarding?`First entrance to ${c.product?.name||"application"}`:c.title||"Example")
   const introduction=row.readingView?.summary||(onboarding?"Screenshots of the first login and explanation of each step. One selected scenario is shown; other options may vary.":c.description)
   const introSource=sourceNote({variant:'link',text:"How this example is put together",content:`<p>${e(scalar(c.description))}</p><p>${e(named(c.observationType))} · ${e(named(c.verification?.status))}</p>${row.readingView?"<p>The title and brief explanation have been edited based on saved materials. Original description given above.</p>":''}`+sourceList({entries:sourceEntries(row,c.sourceIds)})})
   const boundary=boundaryReading(row),gaps=list(c.gaps)
   const plain=t=>String(t).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
   const limitationKeys=new Set(),limitationItems=[]
   for(const item of [...boundary.map(html=>({html})),...gaps.map(g=>{const text=g&&typeof g==='object'?(typeof g.note==='string'?g.note:typeof g.text==='string'?g.text:null):scalar(g);return text?{html:e(deangle(text))}:null}).filter(Boolean)]){const key=norm(plain(item.html));if(key&&!limitationKeys.has(key)){limitationKeys.add(key);limitationItems.push(item)}}
   const extraImages=!singleScreen?media.filter(m=>!used.has(m.id)):[]
   const reading=paperSurface({content:`
    <p class="reference-meta">Direction: ${e(directionTitle(row.trackKey,row.trackTitle))} · ${e(c.product?.name||"Product not specified")}</p>
    <p class="reference-introduction">${readingText(introduction,row)}</p>
    ${singleScreen?'':readingExample(row)}
    <p class="reference-intro-source">${introSource}</p>
    ${singleScreen?exampleScreenSection(row,data,row.trackKey==='exercises'?"Example from application":"Example screen",shown):extraImages.length?readingSection({title:"Example from application",content:`<div class="reference-media">${extraImages.map(m=>image(data,row,m)).join('')}</div>`}):!media.length?notice({kind:'warning',message:"Images not saved. The example is described from text sources."}):''}
    ${!singleScreen&&list(c.steps).length?readingSection({title:stepsHeading,intro:sharedPurpose?`Why are these screens shown? — ${e(deangle(sharedPurpose))}${['editor_inference','inferred'].includes(list(c.steps)[0].purposeBasis)?" (our assessment)":''}.`:'' ,content:`<ol class="reference-steps">${list(c.steps).map(step).join('')}</ol>`}):''}
    ${trackReadingSections(row,shown)}
    ${leftoverObservations(row)}
    ${readingSection({title:"What you can take for your product",content:adaptationSection(c)})}
    ${readingSection({title:"What this example doesn't show",content:`${limitationItems.length?`<ul>${limitationItems.map(item=>`<li>${item.html}</li>`).join('')}</ul>`:"<p>No restrictions listed; the completeness of the example still needs to be checked.</p>"}`})}`})
   const technical=disclosure({title:"Card technical data",className:'reference-technical',content:`<p>Initial view of saved fields, including unknown values and assembly overhead.</p>${facts(c.details??null,row,true)}${list(c.steps).length?`<h3>Steps as saved</h3>${facts(c.steps,row,true)}`:''}${c.adaptation?`<h3>Application idea as saved</h3>${facts(c.adaptation,row,true)}`:''}${gaps.length?`<h3>Restrictions as saved</h3>${facts(c.gaps,row,true)}`:''}`})
   // One compact entry keeps six archives reachable without sprawling the footer.
   const materials=readingSection({title:"Sources and details",content:disclosure({title:"Source materials",className:'reference-sources',bodyClassName:'reference-sources-body',content:`
    ${sourceList({entries:sourceEntries(row,[...new Set([...list(c.sourceIds),c.primarySourceId,...list(c.claims).map(cl=>cl.sourceId),...media.map(m=>m.sourceId)].filter(Boolean))])})}
    ${list(c.claims).length?disclosure({title:"Additional facts from sources",className:'reference-technical',content:list(c.claims).map(cl=>`<article class="reference-claim"><p>${sourced(cl.text,row,[cl.sourceId],`<p>Where to find it in the original: ${e(scalar(cl.locator))}</p>`)}</p><p class="reference-meta">${e(named(cl.support))}</p></article>`).join('')}):''}
    ${originalCheckedData(c)?disclosure({title:"Initial report on direction",className:'reference-technical',content:originalCheckedData(c)}):''}
    ${accessDetails(c)}
    ${disclosure({title:"How sources were checked",className:'reference-technical',content:`${facts(c.verification??null,row,true)}<p>Checking the sources confirms the saved observations, but not the benefit of the mechanics for our product.</p>`})}
    ${technical}`})})
   return detailLayout({className:'reference-detail',header:pageHeader({title,level:2,back:filterLink({label:"← To references",href:'#'+parent}),backTight:true}),notice:issues,content:reading+materials})
  }
  const tracks=list(data.library.tracks).filter(t=>t&&typeof t.key==='string'),products=[...new Map(rows.map(r=>[r.card.product?.id||'',r.card.product?.name||"Product not specified"])).entries()]
  const count=key=>rows.filter(r=>(!key||r.trackKey===key)&&(!state.competitor||r.card.product?.id===state.competitor)).length
  const select=(label,key,choices,all)=>field({name:key,label,type:'select',attributes:{id:'reference-'+key,'data-reference-filter':key},optionsHtml:`${state[key]&&!choices.some(([id])=>id===state[key])?`<option value="${e(state[key])}" selected disabled>${e(label)} via link ${key==='track'?"not available":"not available"}</option>`:''}<option value=""${!state[key]?' selected':''}>${e(all)}</option>${choices.map(([id,title])=>`<option value="${e(id)}"${state[key]===id?' selected':''}>${e(title)}</option>`).join('')}`})
  const filters=filterBar({label:"Reference filters",open:state.filtersOpen,active:Boolean(state.track||state.competitor||state.library&&state.library!==data.libraries?.[0]?.id),content:librarySelect(data)+select("Direction",'track',tracks.map(t=>[t.key,`${directionTitle(t.key,t.title)} · ${count(t.key)}`]),"All directions")+select("Competitor",'competitor',products,"All competitors")+(state.track||state.competitor?button({label:"Reset filters",href:'#'+referenceRoute({library:state.library})}):'')})
  const matching=rows.filter(r=>(!state.track||r.trackKey===state.track)&&(!state.competitor||r.card.product?.id===state.competitor)),filtered=state.track?matching:overviewOrder(matching,tracks),size=12,total=Math.max(1,Math.ceil(filtered.length/size)),requested=Number(state.page),page=Math.min(total,Math.max(1,Number.isSafeInteger(requested)?requested:1))
  const cards=filtered.slice((page-1)*size,page*size).map(row=>{const c=row.card,view=row.readingView;return `<article class="reference-card os-object-card" data-direction="${e(row.trackKey)}">${metadata(c,view?.format||directionTitle(row.trackKey,row.trackTitle))}<h2>${textLink({label:view?.title||c.title||"Untitled",href:'#'+referenceRoute({...state,page,card:c.id})})}</h2>${view?`<p>${e(view.summary)}</p>`:''}${list(c.media).length?image(data,row,c.media[0],true):"<p>Image not saved.</p>"}${view?readingExample(row):`<p>${sourced(c.description,row,c.sourceIds)}</p>`}</article>`}).join('')
  const unknownFilter=state.track&&!tracks.some(t=>t.key===state.track)||state.competitor&&!products.some(([id])=>id===state.competitor)
  const status=data.library.status?`<p class="reference-meta">${data.library.status==='ready-for-review-partial'?"Some examples are partially collected.":"Library status: "+e(labels[data.library.status]||"See collection details")}</p>`:''
  const selectedProduct=products.find(([id])=>id===state.competitor)?.[1]
  const context=selectedProduct?"Competitor: "+selectedProduct:''
  const pages=position=>pagination({page,pages:total,total:filtered.length,size,label:"Reference pages: "+position,context,href:p=>'#'+referenceRoute({...state,page:p})})
  const results=readingSection({title:state.track&&tracks.some(t=>t.key===state.track)?directionTitle(state.track,tracks.find(t=>t.key===state.track).title):"Examples",content:pages("above cards")+(cards?`<div class="reference-grid">${cards}</div>${total>1?pages("under cards"):''}`:emptyState({kind:'no-results',title:rows.length?"There are no cards for these filters":"Cards have not been added yet",description:"Select another direction or competitor."}))})
  const packageArea=readingSection({title:"Collection restrictions",intro:"Consider these spaces when choosing an example for your product.",content:`${status}${disclosure({title:"What has not yet been collected",className:'reference-technical',content:`${facts(data.library.gaps,null)}<p>Limitations of individual examples are listed inside cards.</p>`})}`})
  return collectionLayout({className:'reference-library',filters,notice:issues+(unknownFilter?notice({kind:'warning',message:"The address specified a missing filter. Reset filters to see the library."}):''),content:results+packageArea})
}
export function mountReferences(root,{productId,versionKey='',state={},data,view='references',navigate=route=>window.AtlasNavigation?.navigate(route)}={}) {
  const abort=new AbortController();let disposed=false,panel,request=0
  const images=()=>{for(const img of root.querySelectorAll('[data-reference-raster]')){const loading=img.parentElement.querySelector('[data-reference-image-loading]'),error=img.parentElement.querySelector('[data-reference-image-error]'),loaded=()=>{loading.hidden=true},failed=()=>{img.hidden=true;loading.hidden=true;error.hidden=false};img.addEventListener('load',loaded,{signal:abort.signal});img.addEventListener('error',failed,{signal:abort.signal});if(img.complete)img.naturalWidth?loaded():failed()}}
  const render=value=>{if(disposed)return;data={...value,productId};root.innerHTML=view==='materials'?renderReferenceMaterials(data,state):renderReferences(data,state);root.removeAttribute('aria-busy');images()}
  async function load(refresh=false){const token=++request,scope={productId,library:state.library||'',versionKey},cached=!refresh&&referenceLibraryCache.peek(scope);if(cached){render(cached);return}root.setAttribute('aria-busy','true');root.innerHTML=loadingState({label:view==='materials'?"Loading materials...":"Loading references..."});try{const value=await referenceLibraryCache.load(scope,{refresh});if(token===request)render(value)}catch(error){if(token===request)render({state:'error',message:"Failed to load library. Please try again."})}}
  root.addEventListener('change',event=>{const key=event.target.dataset.referenceFilter;if(key)navigate((view==='materials'?referenceMaterialsRoute:referenceRoute)({...state,[key]:event.target.value,page:1,card:''}))},{signal:abort.signal})
  root.addEventListener('click',event=>{if(event.target.closest('[data-reference-retry]')){load(true);return}const b=event.target.closest('[data-reference-image]');if(!b)return;const row=list(data?.cards).find(r=>r.card.id===b.dataset.referenceCard),m=list(row?.card.media).find(m=>m.id===b.dataset.referenceImage);if(!m)return;panel=evidencePanel({title:named(m.caption||m.alt||"Reference image"),trigger:b,content:`<div class="reference-enlarged"><img src="${e(imageURL(data,row.card,m))}" alt="${e(named(m.alt||m.caption||"Reference image"))}"></div>${sourceList({entries:sourceEntries(row,[m.sourceId])})}`});const img=panel.element.querySelector('img');img.addEventListener('error',()=>{img.replaceWith(Object.assign(document.createElement('p'),{textContent:"Image not available."}))},{once:true})},{signal:abort.signal})
  const ready=data?(render(data),Promise.resolve()):load()
  return {ready,destroy(){disposed=true;abort.abort();panel?.destroy()}}
}
