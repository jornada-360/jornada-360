import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); fs.mkdirSync(path.join(root,'data'),{recursive:true});
export const db=new DatabaseSync(path.join(root,'data','planning.db'));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS planning_import(id TEXT PRIMARY KEY,original_filename TEXT,week_start TEXT,week_end TEXT,uploaded_by TEXT,uploaded_at TEXT,status TEXT,total_rows INTEGER DEFAULT 0,valid_rows INTEGER DEFAULT 0,warning_rows INTEGER DEFAULT 0,error_rows INTEGER DEFAULT 0,original_file_path TEXT);
CREATE TABLE IF NOT EXISTS planning_import_row(id TEXT PRIMARY KEY,import_id TEXT,row_number INTEGER,store_original TEXT,store_id TEXT,employee_name_original TEXT,rut_original TEXT,rut_normalized TEXT,employee_id TEXT,status TEXT,FOREIGN KEY(import_id) REFERENCES planning_import(id));
CREATE TABLE IF NOT EXISTS planning_import_day(id TEXT PRIMARY KEY,import_row_id TEXT,date TEXT,day_of_week TEXT,original_value TEXT,corrected_value TEXT,day_type TEXT,status TEXT,FOREIGN KEY(import_row_id) REFERENCES planning_import_row(id));
CREATE TABLE IF NOT EXISTS planning_import_interval(id TEXT PRIMARY KEY,planning_import_day_id TEXT,interval_type TEXT,start_time TEXT,end_time TEXT,position INTEGER,FOREIGN KEY(planning_import_day_id) REFERENCES planning_import_day(id));
CREATE TABLE IF NOT EXISTS planning_import_issue(id TEXT PRIMARY KEY,import_id TEXT,row_id TEXT,day_id TEXT,code TEXT,message TEXT,severity TEXT,column_name TEXT,original_value TEXT,resolved INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS planning_correction(id TEXT PRIMARY KEY,import_batch_id TEXT,row_id TEXT,employee_id TEXT,date TEXT,original_value TEXT,corrected_value TEXT,changed_by TEXT,changed_at TEXT,reason TEXT);
CREATE TABLE IF NOT EXISTS planning_validation(id TEXT PRIMARY KEY,import_id TEXT,validated_by TEXT,validated_at TEXT,result TEXT,error_count INTEGER,warning_count INTEGER);
CREATE TABLE IF NOT EXISTS planning_export(id TEXT PRIMARY KEY,import_id TEXT,file_path TEXT,filename TEXT,created_by TEXT,created_at TEXT,version INTEGER);
CREATE TABLE IF NOT EXISTS planning_audit(id TEXT PRIMARY KEY,import_id TEXT,action TEXT,user_name TEXT,created_at TEXT,details TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS store(id TEXT PRIMARY KEY,code TEXT UNIQUE,name TEXT UNIQUE,type TEXT,organization_id TEXT,region TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS store_opening_hours(id TEXT PRIMARY KEY,store_id TEXT,day_of_week TEXT,start_time TEXT,end_time TEXT,valid_from TEXT,valid_to TEXT);
CREATE TABLE IF NOT EXISTS employee(id TEXT PRIMARY KEY,rut TEXT UNIQUE,first_name TEXT,last_name TEXT,second_last_name TEXT,hire_date TEXT,termination_date TEXT,base_store_id TEXT,work_unit_id TEXT,role_code TEXT,status TEXT DEFAULT 'ACTIVE',active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS employee_contract(id TEXT PRIMARY KEY,employee_id TEXT,valid_from TEXT,valid_to TEXT,contract_type TEXT,weekly_contract_minutes INTEGER,weekly_contract_days INTEGER,labor_regime TEXT,commerce_worker INTEGER,sunday_rest_regime TEXT,additional_sunday_regime TEXT,holiday_regime TEXT,split_shift_allowed INTEGER,overtime_allowed INTEGER,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS employee_store_authorization(id TEXT PRIMARY KEY,employee_id TEXT,store_id TEXT,authorization_type TEXT,valid_from TEXT,valid_to TEXT);
CREATE TABLE IF NOT EXISTS legal_rule(id TEXT PRIMARY KEY,code TEXT,name TEXT,description TEXT,category TEXT,country TEXT,valid_from TEXT,valid_to TEXT,severity TEXT,scope TEXT,scope_ref_id TEXT,parameter_type TEXT,parameter_value TEXT,enabled INTEGER,blocking INTEGER,source_reference TEXT,version INTEGER,created_at TEXT,updated_at TEXT,created_by TEXT,updated_by TEXT);
CREATE TABLE IF NOT EXISTS legal_validation_run(id TEXT PRIMARY KEY,planning_import_id TEXT,started_at TEXT,finished_at TEXT,rules_evaluated INTEGER,errors INTEGER,warnings INTEGER,info INTEGER,status TEXT,rule_set_version TEXT,rule_snapshot TEXT);
CREATE TABLE IF NOT EXISTS legal_validation_result(id TEXT PRIMARY KEY,run_id TEXT,rule_code TEXT,severity TEXT,blocking INTEGER,employee_id TEXT,store_id TEXT,date TEXT,from_time TEXT,to_time TEXT,actual_value TEXT,expected_value TEXT,message TEXT,metadata TEXT);
CREATE TABLE IF NOT EXISTS validated_planning_history(id TEXT PRIMARY KEY,employee_id TEXT,store_id TEXT,date TEXT,day_type TEXT,first_start TEXT,last_end TEXT,worked_minutes INTEGER,planning_import_id TEXT);
CREATE TABLE IF NOT EXISTS employee_monthly_sunday_counter(id TEXT PRIMARY KEY,employee_id TEXT,year INTEGER,month INTEGER,worked INTEGER,free INTEGER,status TEXT,UNIQUE(employee_id,year,month));
CREATE TABLE IF NOT EXISTS employee_additional_sunday_balance(id TEXT PRIMARY KEY,employee_id TEXT,year INTEGER,eligible INTEGER,entitled INTEGER,used INTEGER,remaining INTEGER);
CREATE TABLE IF NOT EXISTS holiday(id TEXT PRIMARY KEY,date TEXT,name TEXT,type TEXT,national INTEGER,region TEXT,local TEXT,mandatory INTEGER,irrenounceable INTEGER);
CREATE TABLE IF NOT EXISTS sunday_exchange(id TEXT PRIMARY KEY,employee_id TEXT,original_sunday TEXT,replacement_date TEXT,reason TEXT,approved_by TEXT,approved_at TEXT,status TEXT);
CREATE TABLE IF NOT EXISTS compensatory_rest(id TEXT PRIMARY KEY,employee_id TEXT,origin_date TEXT,rest_date TEXT,type TEXT,status TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS monthly_validation_batch(id TEXT PRIMARY KEY,uploaded_by TEXT,uploaded_at TEXT,status TEXT,file_count INTEGER,store_count INTEGER,employee_count INTEGER,error_count INTEGER,warning_count INTEGER,result_json TEXT);
CREATE TABLE IF NOT EXISTS monthly_validation_file(id TEXT PRIMARY KEY,batch_id TEXT,original_filename TEXT,original_file_path TEXT,store_name TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS monthly_correction(id TEXT PRIMARY KEY,batch_id TEXT,file_index INTEGER,sheet_name TEXT,row_number INTEGER,column_number INTEGER,original_value TEXT,corrected_value TEXT,changed_by TEXT,changed_at TEXT);`);
const seedRule=db.prepare(`INSERT INTO legal_rule(id,code,name,description,category,country,valid_from,valid_to,severity,scope,scope_ref_id,parameter_type,parameter_value,enabled,blocking,source_reference,version,created_at,updated_at,created_by,updated_by) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21 WHERE NOT EXISTS(SELECT 1 FROM legal_rule WHERE code=?22 AND scope='GLOBAL' AND valid_from=?23)`);
const now=new Date().toISOString();
for(const r of [
 ['MAX_WEEKLY_ORDINARY_HOURS','Máximo semanal ordinario','Límite general configurable en minutos','LABOR_LEGAL','2026-04-26','ERROR','MINUTES','2520',1],
 ['MAX_DAILY_ORDINARY_HOURS','Máximo diario ordinario','Límite diario configurable en minutos','LABOR_LEGAL','2026-04-26','ERROR','MINUTES','600',1],
 ['MIN_REST_BETWEEN_WORK_DAYS','Descanso entre jornadas','Descanso mínimo configurable en minutos','LABOR_LEGAL','2026-04-26','ERROR','MINUTES','720',1],
 ['MAX_CONSECUTIVE_WORK_DAYS','Máximo de días consecutivos','Control que incluye histórico validado','HISTORICAL','2026-04-26','ERROR','INTEGER','6',1],
 ['BREAK_REQUIRED','Colación requerida','Requiere colación cuando se supera el umbral','LABOR_LEGAL','2026-04-26','WARNING','JSON','{"thresholdMinutes":300,"minMinutes":30}',0],
 ['MAX_WORK_BEFORE_BREAK_MINUTES','Máximo antes de colación','Máximo transcurrido desde el inicio de jornada hasta el inicio de colación','COMPANY_RULE','2026-04-26','ERROR','MINUTES','300',1]
 ,['MAX_WEEKLY_NIGHT_SELLER_HOURS','Máximo semanal vendedor nocturno','Límite semanal para unidades Vendedor Noct.','COMPANY_RULE','2026-04-26','ERROR','MINUTES','2400',1]
 ,['MAX_CONSECUTIVE_WEEKS_SAME_START_OR_END_TIME','Rotación de horario semanal','Máximo de semanas consecutivas con la misma hora predominante de inicio o término','COMPANY_RULE','2026-04-26','ERROR','JSON','{"maxConsecutiveWeeks":3,"checkStartTime":true,"checkEndTime":true}',1]
] as const) seedRule.run(crypto.randomUUID(),r[0],r[1],r[2],r[3],'CL',r[4],null,r[5],'GLOBAL',null,r[6],r[7],1,r[8],null,1,now,now,'SYSTEM','SYSTEM',r[0],r[4]);
db.prepare(`UPDATE legal_rule SET parameter_value='{"maxConsecutiveWeeks":3,"checkStartTime":true,"checkEndTime":true}',updated_at=? WHERE code='MAX_CONSECUTIVE_WEEKS_SAME_START_OR_END_TIME' AND parameter_value='{"maxConsecutiveWeeks":2,"checkStartTime":true,"checkEndTime":true}'`).run(now);
db.prepare(`UPDATE legal_rule SET name='Supera las 5 horas para colación',updated_at=? WHERE code='MAX_WORK_BEFORE_BREAK_MINUTES' AND name='Máximo antes de colación'`).run(now);
db.prepare(`UPDATE legal_rule SET name='Descanso mínimo entre jornadas menor a 12 horas',updated_at=? WHERE code='MIN_REST_BETWEEN_WORK_DAYS' AND name='Descanso entre jornadas'`).run(now);
export const id=()=>crypto.randomUUID();
export const audit=(importId:string|null,action:string,user:string,details={})=>db.prepare('INSERT INTO planning_audit VALUES(?,?,?,?,?,?)').run(id(),importId,action,user,new Date().toISOString(),JSON.stringify(details));
