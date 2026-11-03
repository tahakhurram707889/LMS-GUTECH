import { describe,it,expect,vi } from 'vitest';
import type { LmsRepository } from '../src/repositories/lms.repository.js';
import { uploadFile } from '../src/services/files.service.js';
const file=(overrides:Partial<Express.Multer.File>={}):Express.Multer.File=>({fieldname:'file',originalname:'notes.pdf',encoding:'7bit',mimetype:'application/pdf',size:20,buffer:Buffer.from('%PDF-1.4\nExample content'),destination:'',filename:'',path:'',stream:undefined as unknown as Express.Multer.File['stream'],...overrides});
describe('Verified private uploads',()=>{
  const repo={upload:vi.fn().mockResolvedValue(undefined)} as unknown as LmsRepository;
  it('uploads actual PDF content under a generated safe path',async()=>{
    const result=await uploadFile(repo,'resources','course/user',file());expect(result.filePath).toMatch(/^course\/user\/[a-f0-9-]+-notes.pdf$/);expect(result.mimeType).toBe('application/pdf');
  });
  it('rejects disguised executables and mismatched extensions',async()=>{
    await expect(uploadFile(repo,'resources','course/user',file({originalname:'notes.exe'}))).rejects.toMatchObject({status:422});
    await expect(uploadFile(repo,'resources','course/user',file({buffer:Buffer.from('MZ executable content')}))).rejects.toMatchObject({status:422});
  });
  it('rejects 30 MB resources and 11 MB complaint attachments',async()=>{
    await expect(uploadFile(repo,'resources','course/user',file({size:30*1024*1024}))).rejects.toMatchObject({code:'FILE_TOO_LARGE'});
    await expect(uploadFile(repo,'complaint-attachments','user',file({size:11*1024*1024}))).rejects.toMatchObject({code:'FILE_TOO_LARGE'});
  });
});
