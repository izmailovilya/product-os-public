// Layout follows recorded edges only. Strongly connected jobs share a tier;
// an absent edge never becomes an implied research relationship.
;(function(root){
 function layout(jobs,relations,mode='motives') {
  if(mode==='unified'){
   const vertical=layout(jobs,relations.filter(r=>r.kind==='in_order_to'||r.kind==='part_of'),'motives')
   const ranks={big:0,core:1,small:1,micro:2},rows=new Map(),positions=new Map()
   for(const j of jobs){const rank=ranks[j.level]??Math.round((vertical.positions.get(j.id).y-32)/316);if(!rows.has(rank))rows.set(rank,[]);rows.get(rank).push(j)}
   const height=Math.max(220,...jobs.map(j=>Math.ceil(String(j.label||j.normalizedOutcome||j.rawOutcome||'').length/25)*29+112))
   for(const [rank,row]of rows){
    // Ordering within a band follows explicit time links only; proximity is not an edge.
    const scores=new Map(row.map(j=>[j.id,0]))
    for(let i=0;i<row.length;i++)for(const r of relations.filter(r=>r.kind==='precedes'))if(scores.has(r.from)&&scores.has(r.to))scores.set(r.to,Math.max(scores.get(r.to),Math.min(row.length,scores.get(r.from)+1)))
    row.sort((a,b)=>scores.get(a.id)-scores.get(b.id)||a.id.localeCompare(b.id))
    row.forEach((j,i)=>positions.set(j.id,{x:32+i*396,y:32+rank*(height+120)}))
   }
   const ids=new Set(jobs.map(j=>j.id))
   const temporal=layout(jobs,relations.filter(r=>['precedes','depends_on','conditional'].includes(r.kind)),'process')
   const cycles=[...new Map([...vertical.cycles,...temporal.cycles].map(c=>[[...c].sort().join('|'),c])).values()]
   return {...vertical,cycles,positions,edges:relations.filter(r=>ids.has(r.from)&&ids.has(r.to)),nodeHeight:height,width:Math.max(400,...[...positions.values()].map(p=>p.x+332)),height:Math.max(260,...[...positions.values()].map(p=>p.y+height+32))}
  }
  const ids=new Set(jobs.map(j=>j.id)),edges=relations.filter(r=>ids.has(r.from)&&ids.has(r.to));
  const next=new Map(jobs.map(j=>[j.id,[]]));
  for(const e of edges){const reverse=mode==='motives'||e.kind==='depends_on';next.get(reverse?e.to:e.from).push(reverse?e.from:e.to)}
  let index=0;const indices=new Map(),low=new Map(),stack=[],on=new Set(),components=[];
  function visit(id){indices.set(id,index);low.set(id,index++);stack.push(id);on.add(id);for(const to of next.get(id)){if(!indices.has(to)){visit(to);low.set(id,Math.min(low.get(id),low.get(to)))}else if(on.has(to))low.set(id,Math.min(low.get(id),indices.get(to)))}if(low.get(id)===indices.get(id)){const c=[];let x;do{x=stack.pop();on.delete(x);c.push(x)}while(x!==id);components.push(c)}}
  for(const j of jobs)if(!indices.has(j.id))visit(j.id);
  const owner=new Map(components.flatMap((c,i)=>c.map(id=>[id,i]))),ranks=components.map(()=>0);
  for(let i=0;i<components.length;i++){let changed=false;for(const [from,tos]of next)for(const to of tos){const a=owner.get(from),b=owner.get(to);if(a!==b&&ranks[b]<ranks[a]+1){ranks[b]=ranks[a]+1;changed=true}}if(!changed)break}
  const tiers=new Map();for(const j of jobs){const rank=ranks[owner.get(j.id)];if(!tiers.has(rank))tiers.set(rank,[]);tiers.get(rank).push(j)}
  const width=300,height=220,gap=96,pad=32,positions=new Map();const breadth=Math.max(1,...[...tiers.values()].map(a=>a.length));
  for(const [rank,rows]of tiers)rows.forEach((j,i)=>positions.set(j.id,mode==='motives'?{x:pad+(i+(breadth-rows.length)/2)*(width+36),y:pad+rank*(height+gap)}:{x:pad+rank*(width+gap),y:pad+i*(height+36)}));
  return {positions,edges,nodeWidth:width,nodeHeight:height,width:Math.max(400,...[...positions.values()].map(p=>p.x+width+pad)),height:Math.max(260,...[...positions.values()].map(p=>p.y+height+pad)),cycles:components.filter(c=>c.length>1||next.get(c[0]).includes(c[0]))};
 }
 if(typeof module!=='undefined')module.exports=layout;else root.researchJobLayout=layout;
})(typeof window==='undefined'?globalThis:window)
