import ExcelJS from 'exceljs';
import {parseDay,formatDay,DAYS,type DayName,type DayType,type Interval} from './domain.js';
import {LegalValidationEngine} from './legal/engine.js';
import {dayMetrics,type EmployeePlanning,type LegalContext,type LegalResult,type LegalRule} from './legal/types.js';

export type BrowserFile={name:string;data:ArrayBuffer};
export type Correction={fileIndex:number;sheetName:string;rowNumber:number;columnNumber:number;value:string};
const rule=(code:string,name:string,value:string,severity:'ERROR'|'WARNING'='ERROR',blocking=1):LegalRule=>({id:code,code,name,category:'COMPANY_RULE',valid_from:'2026-01-01',severity,scope:'GLOBAL',parameter_type:'JSON',parameter_value:value,enabled:1,blocking,version:1});
const RULES:LegalRule[]=[
 rule('MAX_WEEKLY_ORDINARY_HOURS','Máximo semanal ordinario','2520'),rule('MAX_DAILY_ORDINARY_HOURS','Máximo diario ordinario','600'),
 rule('MIN_REST_BETWEEN_WORK_DAYS','Descanso mínimo entre jornadas','720'),rule('MAX_CONSECUTIVE_WORK_DAYS','Máximo de días consecutivos','6'),
 rule('BREAK_REQUIRED','Colación requerida','{"thresholdMinutes":300,"minMinutes":30}','WARNING',0),rule('MAX_WORK_BEFORE_BREAK_MINUTES','Supera las 5 horas para colación','300'),
 rule('MAX_WEEKLY_NIGHT_SELLER_HOURS','Máximo semanal vendedor nocturno','2400'),rule('MAX_CONSECUTIVE_WEEKS_SAME_START_OR_END_TIME','Rotación de horario semanal','{"maxConsecutiveWeeks":3,"checkStartTime":true,"checkEndTime":true}')
];
const text=(v:any)=>v==null?'':typeof v==='object'&&'text'in v?String(v.text):String(v);
const iso=(v:any)=>{if(v instanceof Date)return v.toISOString().slice(0,10);const s=text(v),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:''};
const normalize=(raw:any)=>{let s=text(raw).trim();if(/^libre$/i.test(s))s='L';s=s.replace(/^(Col\s+\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/gim,'$1 a $2');return parseDay(s)};
export async function validateBrowserFiles(files:BrowserFile[],corrections:Correction[]=[]){
 const results:LegalResult[]=[],output:any[]=[],history:any[]=[];
 for(let fi=0;fi<files.length;fi++){
  const file=files[fi],wb=new ExcelJS.Workbook();await wb.xlsx.load(file.data);const employees=new Map<string,any>(),sheets:any[]=[];let inferredStore='';
  for(const ws of wb.worksheets){
   const dates=Array.from({length:7},(_,i)=>iso(ws.getRow(10).getCell(i+6).value));if(dates.some(x=>!x)){results.push({ruleCode:'MONTHLY_INVALID_DATES',severity:'ERROR',blocking:true,message:`La hoja ${ws.name} no contiene siete fechas válidas.`,metadata:{file:file.name,sheet:ws.name}});continue}
   inferredStore=text(ws.getCell('A5').value).replace(/^Local:\s*/i,'')||inferredStore;const plans:EmployeePlanning[]=[],rows:any[]=[];
   for(let r=11;r<=ws.rowCount;r++){const name=text(ws.getRow(r).getCell(1).value).trim(),code=text(ws.getRow(r).getCell(2).value).trim();if(!name&&!code)continue;const store=text(ws.getRow(r).getCell(4).value).trim()||inferredStore,key=`${store}|${code}`,workUnit=text(ws.getRow(r).getCell(5).value),contract=text(ws.getRow(r).getCell(3).value),entry=employees.get(key)??{key,code,name,contract,store,workUnit,days:[]};
    const days=dates.map((date,i)=>{const original=text(ws.getRow(r).getCell(i+6).value),fix=corrections.find(c=>c.fileIndex===fi&&c.sheetName===ws.name&&c.rowNumber===r&&c.columnNumber===i+6)?.value,parsed=normalize(fix??original);return{id:`${ws.name}-${r}-${i}`,date,dayName:DAYS[i] as DayName,dayType:parsed.dayType,intervals:parsed.intervals,issues:parsed.issues,originalValue:original,correctedValue:fix,rowNumber:r,columnNumber:i+6}});
    entry.days.push(...days);employees.set(key,entry);plans.push({rowId:key,storeName:store,employee:{rut:code,name,workUnitId:workUnit},contract:{contractType:contract},days});const workedMinutes=days.reduce((n,d)=>n+dayMetrics(d).workedMinutes,0);rows.push({key,rowNumber:r,name,code,contract,store,workUnit,days,workedMinutes,showWeeklyHours:/\/(Vendedor|Operaciones)(?:\b|$)/i.test(workUnit)});
   }
   const context:LegalContext={weekStart:dates[0],weekEnd:dates[6],employees:plans,rules:RULES,history:[...history],openingHours:[],employeeMasterAvailable:false},validation=new LegalValidationEngine().run(context);
   const relevant=validation.results.filter(x=>x.ruleCode!=='EMPLOYEE_FROM_IMPORT'&&x.ruleCode!=='MAX_CONSECUTIVE_WORK_DAYS').filter(x=>{if(x.ruleCode!=='MAX_WEEKLY_ORDINARY_HOURS')return true;const unit=employees.get(String(x.metadata?.rowId))?.workUnit??'';return !/Vendedor\s+Noct\.?/i.test(unit)&&/\/(Vendedor|Operaciones)(?:\b|$)/i.test(unit)});
   results.push(...relevant.map(x=>({...x,metadata:{...(x.metadata||{}),file:file.name,sheet:ws.name}})));
   for(const row of rows.filter(x=>/\/\s*Vendedor\s+Noct\.?/i.test(x.workUnit)))if(row.workedMinutes>2400){let sum=0,causing=row.days.at(-1);for(const d of row.days){sum+=dayMetrics(d).workedMinutes;if(sum>2400){causing=d;break}}results.push({ruleCode:'MAX_WEEKLY_NIGHT_SELLER_HOURS',severity:'ERROR',blocking:true,date:causing.date,message:`${row.name}: jornada nocturna semanal superior al máximo de 40:00. El turno del ${causing.date} hace superar el límite.`,metadata:{file:file.name,sheet:ws.name,rowId:row.key,rut:row.code}})}
   sheets.push({sheet:ws.name,weekStart:dates[0],weekEnd:dates[6],employees:plans.length,dates,rows});
  }
  for(const e of employees.values()){let streak=0;for(const d of e.days.sort((a:any,b:any)=>a.date.localeCompare(b.date))){streak=d.dayType==='WORK'?streak+1:0;if(streak>6)results.push({ruleCode:'MAX_CONSECUTIVE_WORK_DAYS',severity:'ERROR',blocking:true,date:d.date,message:`No se permiten más de 6 días laborales consecutivos. ${e.name} alcanza ${streak} días el ${d.date}.`,metadata:{file:file.name,rowId:e.key,rut:e.code}});for(const issue of d.issues)results.push({ruleCode:issue.code,severity:issue.severity,blocking:issue.severity==='ERROR',date:d.date,message:`${e.name}: ${issue.message}`,metadata:{file:file.name,rowId:e.key,rut:e.code}})}}
  output.push({filename:file.name,store:inferredStore,sheets,employees:[...employees.values()].map(e=>({key:e.key,code:e.code,name:e.name,contract:e.contract,store:e.store,workUnit:e.workUnit,days:e.days.length}))});for(const e of employees.values())for(const d of e.days){const m=dayMetrics(d);history.push({employeeId:e.key,storeId:e.store,date:d.date,dayType:d.dayType,firstStart:m.firstStart,lastEnd:m.lastEnd,status:'VALIDATED'})}
 }
 const unique=[...new Map(results.map(x=>[`${x.ruleCode}|${x.date}|${x.metadata?.file}|${x.metadata?.sheet}|${x.metadata?.rowId}|${x.message}`,x])).values()];return{id:'browser',files:output,results:unique,summary:{files:files.length,stores:new Set(output.map(x=>x.store)).size,employees:new Set(output.flatMap(x=>x.employees.map((e:any)=>`${e.store}|${e.code}`))).size,errors:unique.filter(x=>x.severity==='ERROR').length,warnings:unique.filter(x=>x.severity==='WARNING').length,blockingErrors:unique.filter(x=>x.blocking).length}};
}
export async function exportBrowserFile(file:BrowserFile,fileIndex:number,result:any,corrections:Correction[]){const wb=new ExcelJS.Workbook();await wb.xlsx.load(file.data);for(const c of corrections.filter(x=>x.fileIndex===fileIndex)){const ws=wb.getWorksheet(c.sheetName);if(ws)ws.getRow(c.rowNumber).getCell(c.columnNumber).value=c.value}const data=result.files[fileIndex];for(const sheet of data.sheets){const ws=wb.getWorksheet(sheet.sheet);if(!ws)continue;const totalCol=Math.max(...sheet.rows.flatMap((r:any)=>r.days.map((d:any)=>d.columnNumber)))+1;ws.getRow(10).getCell(totalCol).value='Total horas de trabajo';for(const row of sheet.rows){for(const day of row.days){const m=dayMetrics(day);ws.getRow(row.rowNumber).getCell(day.columnNumber).note=`Jornada laboral efectiva: ${Math.floor(m.workedMinutes/60)}h ${m.workedMinutes%60}m\nTiempo de colación: ${Math.floor(m.breakMinutes/60)}h ${m.breakMinutes%60}m`}const cell=ws.getRow(row.rowNumber).getCell(totalCol);cell.value=row.workedMinutes/1440;cell.numFmt='[h]:mm'}}return wb.xlsx.writeBuffer()}
export const formatBrowserDay=(type:DayType,intervals:Interval[])=>formatDay(type,intervals);
