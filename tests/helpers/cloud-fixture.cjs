// In-memory HTTP fixture for browser tests only. Live authorization is tested separately in SQL.
function workspace(){return {applications:[],completed:[],companies:[],goals:[],milestones:[],tasks:[],profile:{display_name:'',age_band:'18+'},preferences:{},aiHistory:[],revision:0};}
exports.cloudFixture=function(initial={}){
 let state={...workspace(),...initial};
 return async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/rpc/load_workspace')){await route.fulfill({json:state});return true;}
  if(path.endsWith('/rpc/commit_workspace')){const body=route.request().postDataJSON();if(body.expected_revision!==state.revision){await route.fulfill({status:409,json:{code:'40001',message:'Workspace changed in another tab'}});return true;}state={...body.payload,revision:state.revision+1};await route.fulfill({json:state.revision});return true;}
  if(path.endsWith('/rpc/import_guest_workspace')){const body=route.request().postDataJSON();for(const key of ['applications','companies','goals','milestones','tasks'])state[key]=[...new Map([...body.guest[key],...state[key]].map(item=>[item.id,item])).values()];state.completed=[...new Set([...state.completed,...body.guest.completed])];state.revision++;await route.fulfill({json:state.revision});return true;}
  if(path.endsWith('/ai_planning_history')||path.endsWith('/feedback')){await route.fulfill({json:[]});return true;}
  return false;
 };
};
