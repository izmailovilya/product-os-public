// One competitor node per real solution — whichever agent named it and however it spelled it.
//
// Six agents (market + one per segment) each write the solutions people hire in their own
// words: "Raketa Pay", "RaketaPay", "Raketa Pay (raketapay.ru)", "Raketa Pay (agency
// contract for AI subscriptions)". By GRAPH.md that is ONE competitor node with four segment links, so
// the id must not depend on spelling. Key = the site's registrable domain when a URL (or a
// domain-looking token in the name) is known, else the normalized brand — the text before
// the first descriptor separator (" — ", " (", ": "), transliterated, letters+digits only.
//
// DIY / do-nothing entries are behaviours, not brands: "employee pays himself" and "sit on
// the free tier" are different solutions. Reviewed behaviour keys unite paraphrases;
// unreviewed legacy wording stays separate until an explicit identity decision.
const { validBehaviourKey, behaviourKind } = require('./behaviour-identity')
const RU = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
const DOMAIN_RE = /(?:^|[^a-z0-9.-])((?:[a-z0-9-]+\.)+[a-z]{2,})(?=$|[^a-z0-9-])/i
const ONLY_DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/?$/i
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'])
const BEHAVIOUR = /^(diy|do_nothing|do-nothing|workaround)$/
// an explicit enumeration is the signature of a category bucket, not of one solution
const ENUMERATOR = /(?:^|[^0-9a-zа-яё])(?:например|напр\.|такие как|в духе|сервисы типа|типа|such as|e\.?\s?g\.?|like)(?:\s|[,:])/i

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[а-яё]/g, ch => RU[ch] ?? '').replace(/[^a-z0-9]+/g, '')
}

// registrable domain: "https://www.corp.pay-saas.ru/x" → "pay-saas.ru"; "example.co.uk" stays
function domainOf(text) {
  const m = DOMAIN_RE.exec(String(text || '').replace(/^\s*https?:\/\//i, ' '))
  if (!m) return null
  const labels = m[1].toLowerCase().replace(/^www\./, '').split('.')
  const n = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2
  return labels.slice(-n).join('.')
}

// A parenthetical is the entry's own address only when it holds nothing but a domain —
// "Raketa Pay (raketapay.ru)" is Raketa Pay, while "Платёжные агенты (например, «Плати
// Легко»/pay-saas.ru, Global-Payments…)" is a category that merely mentions other people's
// sites; keying it by pay-saas.ru would silently claim the bucket IS Плати Легко.
function splitName(raw) {
  const head = String(raw || '').split(/\s[—–]\s|:\s/)[0].trim()
  const paren = /\(([^)]*)\)/.exec(head)
  const parenDomain = paren && ONLY_DOMAIN_RE.test(paren[1].trim()) ? domainOf(paren[1]) : null
  const bare = head.replace(/\([^)]*\)/g, ' ')
  return { head, bare, parenDomain }
}

// { key, brandKey, domain } — `key` is the id-forming part; `brandKey` lets a domain-less
// spelling ("Raketa Pay") find the node created from a domain-bearing one ("raketapay.ru")
function competitorKey({ name, url, kind, behaviourKey, productKey } = {}) {
  const raw = String(name || '').trim()
  if (BEHAVIOUR.test(String(kind || ''))) {
    if (behaviourKey != null && !validBehaviourKey(behaviourKey)) throw new Error('Invalid behaviourKey')
    return { key: behaviourKey ? `behaviour-${behaviourKey}` : normalize(raw) || 'x', brandKey: null, domain: null }
  }
  const { bare, parenDomain } = splitName(raw)
  const domain = domainOf(url) || parenDomain || domainOf(bare)
  let brand = bare.split(/\s-\s|\s*[/,]\s*/)[0].replace(/^diy\s*:\s*/i, '').replace(/[«»"'“”]/g, '').trim()
  if (domain) brand = brand.replace(DOMAIN_RE, ' ').trim() || domain.split('.')[0]
  const brandKey = normalize(brand) || null
  if (productKey != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productKey)) throw new Error('productKey must be a stable lowercase product slug')
  const base = domain ? domain.replace(/\./g, '-') : (brandKey || 'x')
  return { key: productKey ? `${base.slice(0, 28)}--${productKey.slice(0, 40)}` : base, brandKey, domain }
}

// A category bucket: one entry standing for several vendors. The prompts forbid it, older
// graphs are full of it, and no code can safely split it — so it is only ever reported.
function isCategoryBucket({ name, kind } = {}) {
  if (BEHAVIOUR.test(String(kind || ''))) return false
  const raw = String(name || '')
  if (ENUMERATOR.test(raw)) return true
  // the enumeration can sit after a colon ("посредники: Платежка (platejka.com), GetCard, …")
  // or inside the first parenthetical ("(FunPay, GGsel, Plati.ru)") — read whichever comes first
  const colon = raw.indexOf(':')
  const paren = /\(([^)]*)\)/.exec(raw)
  const tail = colon >= 0 && (!paren || colon < paren.index) ? raw.slice(colon + 1) : (paren ? paren[1] : '')
  const items = tail.split(/\s*[,;]\s*/).map(i => i.trim()).filter(Boolean)
  return items.length >= 2 && items.some(i => DOMAIN_RE.test(i) || /^[«"A-ZА-ЯЁ]/.test(i))
}

// Order-independent resolver: feed every raw entry (and existing nodes) via `learn`, then
// `idFor` maps a brand-only spelling onto the domain-keyed id when one exists.
function competitorResolver() {
  const brandToKey = new Map()
  const behaviourAliases = new Map(), behaviourNodes = new Map()
  return {
    learn(entry) {
      const k = competitorKey(entry)
      if (k.domain && k.brandKey) brandToKey.set(k.brandKey, k.key)
      if (BEHAVIOUR.test(String(entry.kind || '')) && entry.behaviourKey) {
        if (entry.nodeId) behaviourNodes.set(k.key, entry.nodeId)
        for (const name of [entry.name, ...(entry.aliases || [])]) {
          const alias = `${behaviourKind(entry.kind)}:${normalize(name)}`, previous = behaviourAliases.get(alias)
          // Generic wording can refer to distinct mechanisms. Only explicit reviewed
          // keys may resolve those entries; a legacy ambiguous alias must not guess.
          behaviourAliases.set(alias, behaviourAliases.has(alias) && previous !== k.key ? null : k.key)
        }
      }
      return k
    },
    idFor(entry) {
      const k = competitorKey(entry)
      if (BEHAVIOUR.test(String(entry.kind || ''))) {
        const key = entry.behaviourKey ? k.key : behaviourAliases.get(`${behaviourKind(entry.kind)}:${normalize(entry.name)}`) || k.key
        return { id: behaviourNodes.get(key) || `comp-${key.startsWith('behaviour-') ? key : key.slice(0, 48)}`, domain: null }
      }
      const key = k.domain ? k.key : (k.brandKey && brandToKey.get(k.brandKey)) || k.key
      return { id: `comp-${entry.productKey || key.includes('--') ? key : key.slice(0, 48)}`, domain: k.domain }
    },
  }
}

// The identity rule, and the reason the category check above is only a backstop.
// A vendor is identified by the address it lives at, not by the words an agent chose. Asking
// for a homepage per entry makes a category impossible to express — no single site serves
// "payment agents such as X, Y and Z" — so the shape is enforced constructively instead of
// being pattern-matched after the fact. Behaviours (DIY, do nothing) have no vendor and no site.
function needsIdentity(entry) {
  const kind = String((entry && entry.kind) || '')
  if (BEHAVIOUR.test(kind)) return false
  const url = String((entry && entry.url) || '')
  return !domainOf(url) && !domainOf(String((entry && entry.name) || ''))
}

module.exports = { competitorKey, competitorResolver, domainOf, isCategoryBucket, needsIdentity }
