import { UploadCloud } from 'lucide-react';
export function FilePicker({file,onChange,progress}:{file:File|null;onChange:(file:File|null)=>void;progress?:number}){
  return <label className="file-picker" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();onChange(e.dataTransfer.files[0]??null);}}><UploadCloud/><strong>{file?.name??'Drop a file here, or browse'}</strong><small>PDF, DOCX, PPTX, images or ZIP · max 25 MB</small><input aria-label="Choose attachment" type="file" accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.zip" onChange={(e)=>onChange(e.target.files?.[0]??null)}/>{progress!==undefined&&<progress max="100" value={progress} aria-label="Upload progress"/>}</label>;
}
