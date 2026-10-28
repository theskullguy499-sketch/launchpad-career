import {validatePractice} from "./interview-practice.mjs";
// User-authored career material, stored through the existing owned workspace.
export const STUDIO_KEY = 'careerStudio55';
export const MAX_RESUMES = 5;
export const MAX_PRACTICES = 30;
export const safeCareerUrl = value => {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch { return ''; }
};
export function emptyResume(id = crypto.randomUUID()) {
  return {id,label:'Untitled resume',template:'classic',name:'',title:'',email:'',phone:'',location:'',summary:'',github:'',portfolio:'',skills:'',languages:'',experience:[],education:[],projects:[]};
}
const limits={label:80,name:100,title:120,email:160,phone:60,location:120,summary:1400,github:500,portfolio:500,skills:1000,languages:500};
export function validateResume(value) {
  if(!value || typeof value.id!=='string' || !value.id || value.id.length>100) throw Error('Invalid resume version. Restore a valid backup.');
  const r={id:value.id,template:['classic','modern'].includes(value.template)?value.template:'classic'};
  for(const [key,max] of Object.entries(limits)) {
    const text=String(value[key]??'');
    if(text.length>max) throw Error(`${key} is too long (${max} characters maximum).`);
    r[key]=text.trim();
  }
  if(!r.label) throw Error('Give this resume version a name.');
  if(r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw Error('Enter a valid email address, or leave it empty.');
  for(const key of ['github','portfolio']) if(r[key] && !safeCareerUrl(r[key])) throw Error('Use an http:// or https:// link without embedded credentials.');
  for(const key of ['experience','education','projects']) {
    if(!Array.isArray(value[key]) || value[key].length>8) throw Error('Use up to 8 entries per section.');
    r[key]=value[key].map(row=>{
      if(!row || typeof row!=='object') throw Error('Invalid resume entry.');
      const out={};
      for(const [field,max] of Object.entries({heading:160,organization:160,period:100,description:1400,url:500})) {
        const text=String(row[field]??''); if(text.length>max) throw Error('A resume entry is too long.');out[field]=text.trim();
      }
      if(out.url && !safeCareerUrl(out.url)) throw Error('Use a safe project link without embedded credentials.');
      return out;
    });
  }
  r.updatedAt=typeof value.updatedAt==='string'?value.updatedAt:'';
  return r;
}
export function readStudio(preferences={}) {
  const raw=preferences[STUDIO_KEY];
  if(raw===undefined) return {version:1,resumes:[],practices:[],checklist:[]};
  if(!raw || raw.version!==1 || !Array.isArray(raw.resumes) || raw.resumes.length>MAX_RESUMES || !Array.isArray(raw.practices) || raw.practices.length>MAX_PRACTICES || !Array.isArray(raw.checklist)) throw Error('Unsupported career studio data. Keep a JSON backup before editing.');
  const resumes=raw.resumes.map(validateResume);
  if(new Set(resumes.map(r=>r.id)).size!==resumes.length) throw Error('Duplicate resume IDs in backup.');
  const practices=raw.practices.map(validatePractice);
  if(new Set(practices.map(p=>p.id)).size!==practices.length) throw Error("Duplicate exercise IDs in backup.");
  if(raw.checklist.some(x=>!["0","1","2","3","4","5"].includes(x))) throw Error("Invalid preparation checklist.");
  return {...raw,resumes,practices};
}
export function writeStudio(preferences, studio) {
  const next={...preferences,[STUDIO_KEY]:studio};
  readStudio(next);
  if(new TextEncoder().encode(JSON.stringify(next)).length>45000) throw Error('Workspace settings are full. Export a JSON backup, then shorten or remove unused versions, practice history or saved jobs. Nothing was saved.');
  return next;
}
export function mergeStudio(existing, incoming) {
  const merge=(a,b)=>[...new Map([...b,...a].map(x=>[x.id,x])).values()];
  const merged={...existing,resumes:merge(existing.resumes,incoming.resumes),practices:merge(existing.practices,incoming.practices),checklist:[...new Set([...existing.checklist,...incoming.checklist])]};
  if(merged.resumes.length>MAX_RESUMES || merged.practices.length>MAX_PRACTICES) throw Error('Import would exceed the studio limits. Export a backup and remove unused entries first.');
  return merged;
}
