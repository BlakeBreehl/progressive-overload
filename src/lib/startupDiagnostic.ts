/** Development-only fixed-vocabulary events. Never pass identities or record data. */
export function startupTrace(feature:'Auth'|'Account'|'Announcements'|'Groups'|'Features',operation:string,classification:'started'|'ready'|'event'|'ignored'|'cleared'='started'){
 if(import.meta.env.DEV)console.debug('Startup trace',{feature,operation,code:undefined,status:undefined,classification});
}
