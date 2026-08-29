import{resolveRules}from'./resolver.js';
import{EmploymentEvaluator,HoursEvaluator,QfCoverageEvaluator,RestHistoryEvaluator,SplitBreakEvaluator}from'./evaluators.js';
import{ConsecutiveWeeksScheduleRotationRule}from'./rotation.js';
import type{LegalContext,LegalResult,LegalRuleEvaluator}from'./types.js';
export class LegalValidationEngine{
 constructor(private evaluators:LegalRuleEvaluator[]=[new EmploymentEvaluator(),new HoursEvaluator(),new SplitBreakEvaluator(),new RestHistoryEvaluator(),new ConsecutiveWeeksScheduleRotationRule(),new QfCoverageEvaluator()]){}
 run(context:LegalContext){
  const results:LegalResult[]=[];
  for(const employee of context.employees){
   const rules=resolveRules(context.rules,context.weekStart,employee);
   for(const evaluator of this.evaluators)if(!(evaluator instanceof QfCoverageEvaluator)){
    const employeeResults=evaluator.evaluate(context,employee,rules).map(item=>({...item,metadata:{...(item.metadata||{}),rowId:employee.rowId,rut:employee.employee.rut}}));
    results.push(...employeeResults);
   }
  }
  for(const evaluator of this.evaluators)if(evaluator instanceof QfCoverageEvaluator)results.push(...evaluator.evaluate(context));
  return{results,rulesEvaluated:this.evaluators.length*context.employees.length,errors:results.filter(x=>x.severity==='ERROR').length,warnings:results.filter(x=>x.severity==='WARNING').length,info:results.filter(x=>x.severity==='INFO').length,blockingErrors:results.filter(x=>x.blocking).length};
 }
}
