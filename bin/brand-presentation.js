// Saved, file-bound brand presentations. No model calls or product-specific layouts.
const list=value=>Array.isArray(value)?value:[]
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=12000
const hex=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)
const topics={logo:'Логотип',color:'Цвета',typography:'Типографика',character:'Персонаж',positioning:'Имя и описание',composition:'Композиция',layout:'Композиция',graphics:'Графика',graphic:'Графика',voice:'Голос бренда',tone:'Голос бренда',application:'Применение'}
function contrast(a,b){
 const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
function validatePresentation(value,profile){
 const errors=[],files=new Map(list(profile.files).map(f=>[f.id,f])),rules=new Set(list(profile.rules).map(r=>r.id)),usedRules=new Set()
 const fail=message=>errors.push(message)
 if(!value||typeof value!=='object'||value.schemaVersion!==1)return ['presentation.schemaVersion must be 1']
 const copy=(v,label,required=false)=>{if(v!==undefined&&v!==null&&v!==''&&!text(v)||required&&!text(v))fail(label+' needs readable text')}
 const file=(id,label,kind)=>{const f=files.get(id);if(!f)fail(label+' references an unknown file');else if(kind==='image'&&!/\.(svg|png|jpe?g|webp|gif)$/i.test(f.path))fail(label+' needs an image');else if(kind==='font'&&!/\.(woff2?|[ot]tf)$/i.test(f.path))fail(label+' needs a font')}
 const image=(v,label)=>{if(!v||typeof v!=='object'){fail(label+' needs an image reference');return}file(v.fileId,label,'image');copy(v.alt,label+'.alt',true);if(v.region){const r=v.region;if(!['columns','rows','column','row'].every(k=>Number.isInteger(r[k]))||r.columns<1||r.rows<1||r.columns>12||r.rows>12||r.column<0||r.column>=r.columns||r.row<0||r.row>=r.rows)fail(label+' has an invalid sprite region')}}
 const refs=(v,label)=>{if(v===undefined)return;if(!Array.isArray(v)||v.some(id=>!rules.has(id)))fail(label+' references an unknown rule');else v.forEach(id=>usedRules.add(id))}
 const theme=(v,label)=>{if(!v||typeof v!=='object')return fail(label+' needs a colour pair');for(const key of ['background','foreground'])if(!hex(v[key]))fail(label+'.'+key+' needs #rrggbb');if(hex(v.background)&&hex(v.foreground)&&contrast(v.background,v.foreground)<4.5)fail(label+' text contrast is below 4.5:1')}
 copy(value.title,'presentation.title',true);copy(value.description,'presentation.description');if(value.theme)theme(value.theme,'presentation.theme')
 const cover=value.cover
 if(!cover||typeof cover!=='object')fail('presentation.cover is required')
 else {copy(cover.title,'cover.title');copy(cover.description,'cover.description');copy(cover.caption,'cover.caption');if(cover.logoFileId)file(cover.logoFileId,'cover.logo','image');if(cover.image)image(cover.image,'cover.image');if(cover.theme)theme(cover.theme,'cover.theme');if(!text(cover.title)&&!cover.logoFileId)fail('cover needs a title or logo')}
 if(!Array.isArray(value.sections)||value.sections.length>40)fail('presentation.sections must be an array of at most 40 sections')
 const ids=new Set()
 for(const s of list(value.sections)){
  if(!s||typeof s!=='object'){fail('Invalid presentation section');continue}
  if(!/^[a-z][a-z0-9-]{0,70}$/.test(s.id||'')||ids.has(s.id))fail('Section ids must be unique readable anchors');ids.add(s.id)
  copy(s.title,'section.title',true);copy(s.description,'section.description');refs(s.ruleIds,'section.ruleIds')
  if(!['showcase','gallery','palette','typography','text','downloads','applications'].includes(s.type)){fail('Unknown presentation section type');continue}
  if(['showcase','gallery','downloads','applications'].includes(s.type)){
   if(!Array.isArray(s.items)||!s.items.length||s.items.length>200)fail(s.id+' needs 1–200 items')
   for(const item of list(s.items)){
    if(!item||typeof item!=='object'){fail('Invalid section item');continue}
    copy(item.title,'item.title',true);copy(item.description,'item.description');refs(item.ruleIds,'item.ruleIds')
    if(s.type==='downloads')file(item.fileId,'download')
    else if(s.type==='applications'){
     copy(item.heading,'application.heading',true);copy(item.supportingText,'application.supportingText');if(item.logoFileId)file(item.logoFileId,'application.logo','image');if(item.image)image(item.image,'application.image');if(item.theme)theme(item.theme,'application.theme')
     // A newly composed example never inherits acceptance from its ingredients.
     if(item.proposed!==true)fail('Composed applications must be explicitly proposed')
    }else {image(item.image,'item.image');if(item.theme)theme(item.theme,'item.theme')}
   }
  }
  if(s.type==='palette'){
   if(!Array.isArray(s.colors)||!s.colors.length||s.colors.length>24)fail('Palette needs 1–24 colours')
   for(const color of list(s.colors)){if(!color||!hex(color.value)||!text(color.label))fail('Palette colours need a label and #rrggbb')}
  }
  if(s.type==='typography'){
   copy(s.family,'typography.family',true);copy(s.sample,'typography.sample',true);if(s.fontFileId)file(s.fontFileId,'typography.font','font')
   if(s.fontWeightRange!==undefined&&(!s.fontFileId||!Array.isArray(s.fontWeightRange)||s.fontWeightRange.length!==2||s.fontWeightRange.some(w=>!Number.isInteger(w)||w<1||w>1000)||s.fontWeightRange[0]>s.fontWeightRange[1]))fail('typography.fontWeightRange needs an ordered font weight range')
   if(s.specimen!==undefined){
    const t=s.specimen
    if(!t||typeof t!=='object'||Array.isArray(t))fail('typography.specimen needs an object')
    else{for(const key of ['glyphs','title','body'])copy(t[key],'specimen.'+key,true);for(const key of ['secondaryGlyphs','heading'])copy(t[key],'specimen.'+key);if(!Array.isArray(t.characters)||!t.characters.length||t.characters.length>8||t.characters.some(v=>!text(v)))fail('specimen.characters needs 1–8 readable lines')}
   }
  }
  if(s.type==='text')copy(s.body,'section.body',true)
 }
 for(const rule of list(profile.rules))if(rule.strength==='required'&&!usedRules.has(rule.id))fail('Required rule is absent from the presentation: '+rule.id)
 return errors
}
function fileTitle(file){return file.title||file.label||({'logo':'Логотип','typography':'Образец типографики','palette':'Образец палитры','application':'Пример применения','concept-board':'Концепция','presentation':'Презентация','logobook':'Руководство'}[file.role])||file.path.split('/').pop()}
function legacyPresentation(profile){
 // A file inventory is not a brand presentation. In particular, the next
 // preview may be a favicon or an old concept, not a cover illustration.
 const files=list(profile.files),visual=files.filter(f=>f.preview),logos=visual.filter(f=>f.role==='logo'),groups=new Map(),used=new Set(),sections=[]
 // Technical rasters (the validator's 16/32/64 px logo previews) never become
 // large heroes through file order or demo references; vector masters win.
 // Auto-assembly heuristic only — file validity and authored use are unaffected.
 const technical=f=>Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width<=64&&f.height<=64
 const logo=logos.find(f=>/\.svg$/i.test(f.path))||logos.find(f=>!technical(f))
 for(const rule of list(profile.rules)){const group=groups.get(rule.topic)||[];group.push(rule);groups.set(rule.topic,group)}
 for(const [topic,rules] of groups){
  const images=visual.filter(f=>!used.has(f.id)&&!technical(f)&&(rules.some(r=>list(r.demoFileIds).includes(f.id))||({logo:'logo',color:'palette',typography:'typography'}[topic]===f.role)))
  images.forEach(f=>used.add(f.id));const id='topic-'+sections.length,title=topics[topic]||'Правила применения'
  const colors=topic==='color'?[...new Map(rules.flatMap(r=>list(r.pairs).flatMap(p=>[{value:p.fg,label:'Текст · '+(p.role||'основной')},{value:p.bg,label:'Фон · '+(p.role||'основной')}])).filter(c=>hex(c.value)).map(c=>[c.value,c])).values()]:[]
  if(colors.length)sections.push({id,type:'palette',title,colors,ruleIds:rules.map(r=>r.id)})
  else if(images.length)sections.push({id,type:'showcase',title,items:images.map(f=>({title:fileTitle(f),image:{fileId:f.id,alt:fileTitle(f)}})),ruleIds:rules.map(r=>r.id)})
  else sections.push({id,type:'text',title,body:rules.map(r=>r.value).join('\n\n'),ruleIds:rules.map(r=>r.id)})
 }
 // Unassigned exports, research screenshots and historic concepts stay in the
 // complete file archive. Only authored sections can give them a primary role.
 const downloads=files.filter(f=>['logo','typography','logobook'].includes(f.role)||f.purpose==='brand-signature'||/\.(zip|woff2?|[ot]tf)$/i.test(f.path))
 if(downloads.length)sections.push({id:'files',type:'downloads',title:'Взять в работу',items:downloads.map(f=>({fileId:f.id,title:fileTitle(f)}))})
 return {schemaVersion:1,title:profile.product?.name||'Айдентика',description:profile.brief?.descriptor||'',cover:{title:profile.product?.name||'Айдентика',description:profile.brief?.descriptor||'',...(logo?{logoFileId:logo.id}:{})},sections}
}
module.exports={validatePresentation,legacyPresentation,fileTitle,contrast}
