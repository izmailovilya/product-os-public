// Read-only bridge from observations to reviewed competitors. An Alternative is
// an answer in a case, not a new competitor: keep unreviewed names in the case.
function withConsideration(nodes, records) {
 const retired=new Set(records.flatMap(r=>r.supersedes||[])),active=records.filter(r=>!retired.has(r.id));
 const result=nodes.map(n=>({...n,data:{...n.data}}));
 const segments=result.filter(n=>n.type==='segment');
 for(const alternative of active.filter(r=>r.type==='Alternative')){
  const memberships=active.filter(r=>r.type==='MembershipAssertion'&&r.status!=='withdrawn'&&r.episodeId===alternative.episodeId);
  const segmentIds=[...new Set(memberships.flatMap(m=>segments.filter(s=>s.id===m.segmentId||s.data.researchSegmentId===m.segmentId).map(s=>s.id)))];
  const competitors=result.filter(n=>n.type==='competitor'&&n.status!=='dropped');
  // An explicit identity review may map a compound answer to several products.
  // Ambiguous name matches never acquire that authority.
  const explicit=competitors.filter(n=>n.id===alternative.id||(n.data.researchAlternativeIds||[]).includes(alternative.id));
  const exact=alternative.identification==='identified'?competitors.filter(n=>n.label===alternative.rawName):[];
  const matches=explicit.length?explicit:exact.length===1?exact:[];
  if(!matches.length)continue;
  const episode=active.find(r=>r.type==='Episode'&&r.id===alternative.episodeId);
  const personIds=[...new Set([...(episode?.personIds||[]),...memberships.map(m=>m.personId)].filter(Boolean))];
  const choices=active.filter(r=>r.type==='ChoiceEvent'&&r.alternativeId===alternative.id&&r.episodeId===alternative.episodeId);
  for(const node of matches){
   const prior=(node.data.considerationCases||[]).filter(c=>c.alternativeId!==alternative.id);
   const context=(node.data.researchAlternativeContexts||[]).find(c=>c.alternativeId===alternative.id);
   node.data.considerationCases=[...prior,{alternativeId:alternative.id,episodeId:alternative.episodeId,segmentIds,personIds,stages:[...new Set(choices.map(c=>c.stage))],...(matches.length>1?{choiceScope:'compound'}:{}),...(context?{contextNote:context.note||'',usageQualified:context.usageQualified!==false}:{}),evidenceRefs:[...(alternative.evidenceRefs||[]),...choices.flatMap(c=>c.evidenceRefs||[])]}];
  }
 }
 return result;
}
module.exports={withConsideration};
