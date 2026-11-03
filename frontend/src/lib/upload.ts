import { getAccessToken } from './api';
export function upload<T>(path:string,form:FormData,onProgress:(percent:number)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();request.open('POST',`${import.meta.env.VITE_API_URL??'http://localhost:4000/api'}${path}`);request.withCredentials=true;
    const token=getAccessToken();if(token)request.setRequestHeader('Authorization',`Bearer ${token}`);
    request.upload.onprogress=(event)=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    request.onerror=()=>reject(new Error('Upload connection failed. Please retry.'));
    request.onload=()=>{try{const response=JSON.parse(request.responseText);if(request.status>=200&&request.status<300)resolve(response.data as T);else reject(new Error(response.error?.message??'Upload failed'));}catch{reject(new Error('Invalid upload response'));}};
    request.send(form);
  });
}
