const {projection}=require('../research/store')
const {emptySupport}=require('../research/interview-support')

// Reading rollups follow recorded hierarchy only. They do not create memberships,
// deduplicate identities across sources, or promote a parent's interview support.
function attachSegmentResearch(galaxy,data,graph){
 const direct=projection(data),retired=new Set(data.records.flatMap(r=>r.supersedes||[]))
 const records=data.records.filter(r=>!retired.has(r.id)),by=new Map(records.map(r=>[r.id,r]))
 const members=records.filter(r=>r.type==='MembershipAssertion'&&['candidate','supported'].includes(r.status))
 const all=[...galaxy.segments,...galaxy.subSegments||[]]
 for(const segment of all){
  const descendantIds=new Set([segment.id]);let expanded=true;while(expanded){expanded=false;for(const child of all)if(descendantIds.has(child.parentId)&&!descendantIds.has(child.id)&&!child.cohortView){descendantIds.add(child.id);expanded=true}}
  const children=all.filter(child=>child.id!==segment.id&&descendantIds.has(child.id)),scope=new Set([segment.researchSegmentId||segment.id,segment.id,...segment.archivedResearchSegmentIds||[],...children.flatMap(child=>[child.id,child.researchSegmentId].filter(Boolean))])
  const selected=members.filter(m=>scope.has(m.segmentId)&&by.has(m.personId)),people=new Map(),episodes=new Set(),sessions=new Set(),kinds={}
  for(const m of selected){people.set(m.personId,{id:m.personId,displayName:by.get(m.personId).displayName,membershipStatus:m.status});episodes.add(m.episodeId);for(const id of by.get(m.episodeId)?.sessionIds||[])sessions.add(id)}
  for(const id of episodes){
   const episode=by.get(id),sessionKinds=new Set((episode?.sessionIds||[]).map(id=>by.get(id)?.kind||'unknown'))
   // A written case collected through a form is still a case story. Use an
   // explicit episode kind, never a product ID, filename or inferred prose label.
   const kind=['case_story','written_case_story_self_report'].includes(episode?.kind)?'case_story':sessionKinds.size===1?[...sessionKinds][0]:sessionKinds.size?'mixed':'unknown'
   kinds[kind]=(kinds[kind]||0)+1
  }
  const directSupport=direct.segments[segment.researchSegmentId||segment.id]?.interviewSupport||emptySupport()
  segment.participants=[...people.values()].slice(0,8)
  segment.participantCount=people.size
  segment.researchSummary={materialCount:episodes.size,sessionCount:sessions.size,kinds,includesSubsegments:children.length>0,includesArchivedGroups:!!segment.archivedResearchSegmentIds?.length,uniquePeopleKnown:false,
   stale:directSupport.stale||(segment.archivedResearchSegmentIds||[]).some(id=>direct.segments[id]?.interviewSupport.stale)||children.some(c=>direct.segments[c.researchSegmentId||c.id]?.interviewSupport.stale)}
  segment.interviewSupport=directSupport
 }
 if(graph)for(const segment of all.filter(s=>s.cohortView)){
  const analysis=require('../research/segment-analysis'),model=analysis.build(data,graph,segment.id),selected=analysis.aggregate(model,analysis.normalizeFilters(model.savedFilters,model.parameters))
  segment.participants=[...new Map(selected.cases.flatMap(c=>c.people).map(p=>[p.id,{id:p.id,displayName:p.label,membershipStatus:'candidate'}])).values()].slice(0,8)
  segment.participantCount=selected.dossierCount
  segment.researchSummary={materialCount:selected.materialCount,kinds:selected.kinds,uniquePeopleKnown:false,includesSubsegments:false,stale:model.groups.some(g=>g.stale)}
 }
 return galaxy
}
module.exports={attachSegmentResearch}
