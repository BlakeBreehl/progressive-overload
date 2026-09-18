/** Register only for a recoverable failure. Visibility events never reset a ready account. */
export function watchConnectionRecovery(retry:()=>void,win:EventTarget=window,doc:EventTarget&{visibilityState:string}=document,isOnline=()=>navigator.onLine){
 const resume=()=>{if(doc.visibilityState==='visible'&&isOnline())retry();};
 win.addEventListener('online',resume);doc.addEventListener('visibilitychange',resume);
 return()=>{win.removeEventListener('online',resume);doc.removeEventListener('visibilitychange',resume);};
}
