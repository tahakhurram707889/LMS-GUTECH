import type { Request, Response } from 'express';
import type { Environment } from '../config/env.js';
import { LmsService } from '../services/lms.service.js';
export function lmsController(env:Environment,operation:string) {
  const service=new LmsService(env);
  return async(req:Request,res:Response)=>{
    const output=await service.execute(operation,{user:req.user!,db:req.db!,token:req.accessToken!,params:req.params,query:req.query,body:req.body,file:req.file});
    res.set('Cache-Control','no-store');
    if(operation==='gradebook.csv'){
      res.type('text/csv; charset=utf-8').attachment('gradebook.csv').send((output as {csv:string}).csv);return;
    }
    res.json(output);
  };
}
