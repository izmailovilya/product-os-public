// Presentation only: never rewrites the channel or attached research records.
const normalize = value => String(value || '').trim().toLowerCase()
export function channelContentMode(channel) {
  const explicit = channel?.data?.contentMode
  if (['page','feed','resource'].includes(explicit)) return explicit
  const platform = normalize(channel?.data?.platform)
  if (['сайт','веб-сайт','веб сайт','website','web-site','лендинг','landing','landing page'].includes(platform)) return 'page'
  if (['telegram','email-рассылка','блог / сайт','блог','twitter / x','facebook','instagram','youtube','вконтакте','подкаст','сообщество'].includes(platform)) return 'feed'
  return 'resource'
}
export function isChannelContent(material, channel) {
  const mode = channelContentMode(channel), format = normalize(material?.data?.format)
  if (mode === 'page') return ['блок страницы','лендинг','страница','page','landing page'].includes(format)
  if (mode === 'feed') return ['пост','статья','письмо','post','article','email','видео','подкаст'].includes(format)
  return false
}

// reached_via data belongs to the segment/channel pair, not the global node.
export function channelsForSegment(segment, channels, edges=[]) {
 return channels.filter(c=>(segment.channels||[]).some(x=>x.id===c.id)||edges.some(x=>x.type==='channel_segment'&&x.from===c.id&&x.to===segment.id)||(c.data?.contexts||[]).some(x=>x.segmentId===segment.id)).map(c=>{
  const scoped=(segment.channels||[]).find(x=>x.id===c.id)||edges.find(x=>x.type==='reached_via'&&x.from===segment.id&&x.to===c.id)?.data||{}
  return {...c,data:{...c.data,...scoped}}
 })
}
