import type {SupabaseClient} from '@supabase/supabase-js';
export const recoveryPath='/auth/reset-password';
/** Keep only routing flags, never copy credentials out of the SDK callback URL. */
export function recoveryLocation(href:string){const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));return {active:url.pathname===recoveryPath||hash.get('type')==='recovery',invalid:['error','error_code','error_description'].some(key=>hash.has(key)||url.searchParams.has(key))};}
export const initialRecovery=typeof window==='undefined'?{active:false,invalid:false}:recoveryLocation(window.location.href);
export const recoveryRedirect=(origin:string)=>new URL(recoveryPath,origin).href;
export const resetResponse='If an account can receive a reset email, a link will arrive shortly. Check your inbox and spam folder.';
export async function requestPasswordReset(client:SupabaseClient,email:string,origin:string){
 try{await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:recoveryRedirect(origin)});}catch{/* Same response for existing, unknown, throttled and failed requests. */}
 return resetResponse;
}
export function recoveryView(loading:boolean,hasSession:boolean,invalid:boolean){return loading?'loading':invalid||!hasSession?'invalid':'password';}
export function passwordError(code?:string){
 if(code==='same_password')return 'Choose a password different from your current password.';
 if(code==='weak_password')return 'Use a stronger password that meets the account password requirements.';
 if(code==='reauthentication_needed'||code==='reauthentication_not_valid')return 'Verify your account with the email code, then try again.';
 if(code==='session_not_found'||code==='bad_jwt')return 'Your session has expired. Request a new reset link or sign in again.';
 return 'Could not change your password. Check your current password or connection and try again.';
}
