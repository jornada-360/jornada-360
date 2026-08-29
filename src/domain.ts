export const DAYS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'] as const;
export const COLUMNS = ['NOMBRE Y APELLIDOS COLABORADOR','RUT',...DAYS] as const;
export const LEGACY_COLUMNS = ['LOCAL',...COLUMNS] as const;
export type DayName = typeof DAYS[number];
export type DayType = 'WORK'|'FREE'|'VACATION'|'FLEX'|'ABSENCE'|'UNWAIVABLE_HOLIDAY'|'ADDITIONAL_SUNDAY'|'EMPTY'|'INVALID';
export type Severity = 'WARNING'|'ERROR';
export interface Interval { type:'WORK'|'BREAK'; start:string; end:string; position:number }
export interface Issue { code:string; message:string; severity:Severity; row?:number; column?:string; originalValue?:string }
export interface ParsedDay { originalValue:string; dayType:DayType; intervals:Interval[]; issues:Issue[] }
export interface ParsedRow { rowNumber:number; storeOriginal:string; employeeNameOriginal:string; rutOriginal:string; rutNormalized:string; days:Record<DayName,ParsedDay>; issues:Issue[] }

const TIME = '(?:[01]\\d|2[0-3]):[0-5]\\d';
const WORK_RE = new RegExp(`^(${TIME})\\s+a\\s+(${TIME})$`, 'i');
const BREAK_RE = new RegExp(`^Col\\s+(${TIME})\\s+a\\s+(${TIME})$`, 'i');
const mins = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m };
const endMins=(start:string,end:string)=>end==='00:00'&&start!=='00:00'?1440:mins(end);

export function normalizeRut(value:string):string { return value.toUpperCase().replace(/[^0-9K]/g,'') }
export function validRut(value:string):boolean {
  const rut=normalizeRut(value); if(!/^\d{7,8}[0-9K]$/.test(rut)) return false;
  const body=rut.slice(0,-1); let sum=0,m=2;
  for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*m; m=m===7?2:m+1}
  const n=11-(sum%11); const dv=n===11?'0':n===10?'K':String(n);
  return dv===rut.at(-1);
}
export function parseDay(raw:unknown):ParsedDay {
  const originalValue=raw==null?'':String(raw); const value=originalValue.trim(); const issues:Issue[]=[];
  if(!value){issues.push({code:'EMPTY_DAY',message:'Sin información; debe revisarse.',severity:'ERROR',originalValue}); return {originalValue,dayType:'EMPTY',intervals:[],issues}}
  if(/^l$/i.test(value)) return {originalValue,dayType:'FREE',intervals:[],issues};
  if(/^(vac\.?|vacaciones)$/i.test(value)) return {originalValue,dayType:'VACATION',intervals:[],issues};
  if(/^d[ií]a\s+flex$/i.test(value)) return {originalValue,dayType:'FLEX',intervals:[],issues};
  if(/^ausencia$/i.test(value)) return {originalValue,dayType:'ABSENCE',intervals:[],issues};
  if(/^feriado\s+irrenunciable$/i.test(value)) return {originalValue,dayType:'UNWAIVABLE_HOLIDAY',intervals:[],issues};
  if(/^da$/i.test(value)) return {originalValue,dayType:'ADDITIONAL_SUNDAY',intervals:[],issues};
  const lines=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const intervals:Interval[]=[]; let invalid=false;
  for(const line of lines){ const b=line.match(BREAK_RE); const w=line.match(WORK_RE); if(b) intervals.push({type:'BREAK',start:b[1],end:b[2],position:intervals.filter(x=>x.type==='BREAK').length+1}); else if(w) intervals.push({type:'WORK',start:w[1],end:w[2],position:intervals.filter(x=>x.type==='WORK').length+1}); else invalid=true }
  const work=intervals.filter(x=>x.type==='WORK'), breaks=intervals.filter(x=>x.type==='BREAK');
  if(intervals.some(x=>mins(x.start)%15!==0||mins(x.end)%15!==0)) issues.push({code:'INVALID_15_MINUTE_INCREMENT',message:'Las horas deben usar intervalos de 15 minutos (:00, :15, :30 o :45).',severity:'ERROR',originalValue});
  if(invalid||work.length===0||work.length>2||breaks.length>1) issues.push({code:'INVALID_WORK_INTERVAL',message:'El horario informado no tiene un formato válido.',severity:'ERROR',originalValue});
  for(const x of intervals) if(mins(x.start)>=endMins(x.start,x.end)) issues.push({code:'INVALID_TIME_ORDER',message:'La hora de inicio debe ser anterior a la hora de fin.',severity:'ERROR',originalValue});
  if(work.length===2 && mins(work[0].start)<endMins(work[1].start,work[1].end)&&mins(work[1].start)<endMins(work[0].start,work[0].end)) issues.push({code:'OVERLAPPING_WORK_INTERVALS',message:'Los turnos se superponen.',severity:'ERROR',originalValue});
  for(const b of breaks) if(!work.some(w=>{const ws=mins(w.start),we=endMins(w.start,w.end),bs=mins(b.start)<ws?mins(b.start)+1440:mins(b.start),be=endMins(b.start,b.end)<bs?endMins(b.start,b.end)+1440:endMins(b.start,b.end);return bs>=ws&&be<=we})) issues.push({code:'BREAK_OUTSIDE_WORK',message:'La colación está fuera del horario laboral.',severity:'ERROR',originalValue});
  return {originalValue,dayType:issues.length?'INVALID':'WORK',intervals,issues};
}
export function formatDay(type:DayType, intervals:Interval[]):string {
  if(type==='FREE') return 'Libre'; if(type==='VACATION') return 'Vac'; if(type==='FLEX') return 'Día Flex'; if(type==='ABSENCE')return'Ausencia';if(type==='UNWAIVABLE_HOLIDAY')return'Feriado irrenunciable';if(type==='ADDITIONAL_SUNDAY')return'DA';if(type==='EMPTY') return '';
  return [...intervals.filter(x=>x.type==='WORK'),...intervals.filter(x=>x.type==='BREAK')].map(x=>`${x.type==='BREAK'?'Col ':''}${x.start} a ${x.end}`).join('\n');
}
