import type { DayName,Interval } from '../domain.js';
export type LegalSeverity='ERROR'|'WARNING'|'INFO';
export interface LegalRule{ id:string;code:string;name:string;category:string;valid_from:string;valid_to?:string|null;severity:LegalSeverity;scope:string;scope_ref_id?:string|null;parameter_type:string;parameter_value:string;enabled:number;blocking:number;version:number }
export interface LegalResult{ruleCode:string;severity:LegalSeverity;blocking:boolean;employeeId?:string;storeId?:string;date?:string;fromTime?:string;toTime?:string;actualValue?:string;expectedValue?:string;message:string;metadata?:Record<string,unknown>}
export interface LegalDay{id:string;date:string;dayName:DayName;dayType:string;intervals:Interval[]}
export interface LegalEmployee{id?:string;rut:string;name:string;hireDate?:string;terminationDate?:string;active?:boolean;status?:string;roleCode?:string;baseStoreId?:string;workUnitId?:string}
export interface LegalContract{id?:string;weeklyContractMinutes?:number;splitShiftAllowed?:boolean|null;laborRegime?:string;contractType?:string;sundayRestRegime?:string;commerceWorker?:boolean}
export interface EmployeePlanning{rowId:string;storeId?:string;storeName:string;employee:LegalEmployee;contract?:LegalContract;days:LegalDay[]}
export interface OpeningHour{storeId:string;date:string;start:string;end:string}
export interface HistoricalDay{employeeId:string;storeId?:string;date:string;dayType:string;firstStart?:string;lastEnd?:string;status?:'VALIDATED'|'PUBLISHED'|'DISCARDED'|string}
export interface LegalContext{weekStart:string;weekEnd:string;employees:EmployeePlanning[];rules:LegalRule[];history:HistoricalDay[];openingHours:OpeningHour[];employeeMasterAvailable?:boolean}
export interface LegalRuleEvaluator{codes:string[];evaluate(context:LegalContext,employee:EmployeePlanning|undefined,rules:Map<string,LegalRule>):LegalResult[]}
export const minutes=(t:string)=>{const[h,m]=t.split(':').map(Number);return h*60+m};
export const hhmm=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const crossesMidnight=(start:string,end:string)=>(minutes(end)===0&&minutes(start)>0)||(minutes(start)>=18*60&&minutes(end)<=12*60);
export const intervalMinutes=(start:string,end:string)=>{const a=minutes(start),b=minutes(end)+(crossesMidnight(start,end)?1440:0);return Math.max(0,b-a)};
export function dayMetrics(day:LegalDay){const work=day.intervals.filter(x=>x.type==='WORK'),breaks=day.intervals.filter(x=>x.type==='BREAK');const presence=work.reduce((n,x)=>n+intervalMinutes(x.start,x.end),0),breakMinutes=breaks.reduce((n,x)=>n+intervalMinutes(x.start,x.end),0);return{presenceMinutes:presence,breakMinutes,workedMinutes:Math.max(0,presence-breakMinutes),firstStart:work.map(x=>x.start).sort()[0],lastEnd:work.map(x=>x.end).sort().at(-1),work,breaks}}
