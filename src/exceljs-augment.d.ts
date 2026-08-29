import 'exceljs';
declare module 'exceljs'{interface Worksheet{dataValidations:{add(range:string,validation:unknown):void}}}
