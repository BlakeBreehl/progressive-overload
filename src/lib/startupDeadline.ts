/** Bound startup waits even when the transport never settles. Late results are ignored. */
export function startupDeadline<T>(request:PromiseLike<T>,milliseconds=15000):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Object.assign(new Error('Startup request timed out'),{status:408})),milliseconds);
  Promise.resolve(request).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}
