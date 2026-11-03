import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../utils/api-error.js';
import type { LmsRepository } from '../repositories/lms.repository.js';
const accepted=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp','application/zip']);
export async function uploadFile(repo:LmsRepository,bucket:string,prefix:string,file:Express.Multer.File) {
  const detected=await fileTypeFromBuffer(file.buffer);
  const aliases:Record<string,string>={'application/x-zip-compressed':'application/zip','image/jpg':'image/jpeg'};
  const declared=aliases[file.mimetype]??file.mimetype;
  if(!detected||!accepted.has(detected.mime)||(declared!=='application/octet-stream'&&declared!==detected.mime))throw new ApiError(422,'INVALID_FILE','File content must match an allowed PDF, Office document, image or ZIP MIME type');
  const extensions:Record<string,string[]>={'application/pdf':['.pdf'],'application/zip':['.zip'],'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'],'application/vnd.openxmlformats-officedocument.presentationml.presentation':['.pptx']};
  if(!extensions[detected.mime]?.includes(extname(file.originalname).toLowerCase()))throw new ApiError(422,'INVALID_FILE','File extension does not match its verified content type');
  if(bucket==='complaint-attachments'&&!['application/pdf','image/png','image/jpeg','image/webp'].includes(detected.mime))throw new ApiError(422,'INVALID_FILE','Complaint attachments must be PDF or images');
  const maximum=bucket==='complaint-attachments'?10*1024*1024:25*1024*1024;
  if(file.size>maximum)throw new ApiError(422,'FILE_TOO_LARGE',`Maximum file size is ${maximum/1024/1024} MB`);
  const filename=file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-150)||`file.${detected.ext}`;
  const path=`${prefix}/${randomUUID()}-${filename}`;
  await repo.upload(bucket,path,file.buffer,detected.mime);
  return {filePath:path,fileName:filename,mimeType:detected.mime,sizeBytes:file.size};
}
