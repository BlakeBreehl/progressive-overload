import type {SupabaseClient} from '@supabase/supabase-js';
import {startupDeadline} from './startupDeadline';
export const confirmationPath='/auth/confirm';
export function authCallback(href:string){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 const type=hash.get('type')??url.searchParams.get('type');
 const recovery=url.pathname==='/auth/reset-password'||type==='recovery';
 const active=url.pathname===confirmationPath||url.searchParams.has('code')||hash.has('access_token')||hash.has('error')||url.searchParams.has('error')||hash.has('error_code')||url.searchParams.has('error_code')||type==='signup'||type==='email'||type==='recovery'||hash.has('error_description')||url.searchParams.has('error_description');
 return {active,recovery,code:url.searchParams.get('code'),accessToken:hash.get('access_token'),refreshToken:hash.get('refresh_token'),error:hash.get('error_code')??url.searchParams.get('error_code')??hash.get('error')??url.searchParams.get('error')};
}
export const callbackSnapshot=typeof window==='undefined'?null:authCallback(window.location.href);
export const confirmationRedirect=(origin:string)=>new URL(confirmationPath,origin).href;
export function confirmationMessage(code?:string){
 if(code==='email_already_confirmed')return 'Your email is already confirmed. Return to sign in.';
 if(code==='otp_expired'||code==='access_denied')return 'This link has expired or was already used. Sign in if you already confirmed your email, or request a new link.';
 if(code==='bad_code_verifier'||code==='flow_state_not_found'||code==='flow_state_expired')return 'Open this link in the browser where you requested it. If it has expired, request a new verification email.';
 if(code==='malformed')return 'This verification link is incomplete. Open the newest email or request a new link.';
 return 'We could not verify this link. It may have expired or already been used. Request a new link, or try again when connected.';
}
const pending=new WeakMap<SupabaseClient,Promise<void>>();
/** Share callback exchange across Strict Mode remounts; authorization codes are single use. */
export function completeAuthCallback(client:SupabaseClient,callback:ReturnType<typeof authCallback>){
 const existing=pending.get(client);if(existing)return existing;
 const request=(async()=>{
  if(callback.error)throw Object.assign(new Error('Callback rejected'),{code:callback.error});
  const result=callback.code?await startupDeadline(client.auth.exchangeCodeForSession(callback.code)):callback.accessToken&&callback.refreshToken?await startupDeadline(client.auth.setSession({access_token:callback.accessToken,refresh_token:callback.refreshToken})):null;
  if(!result)throw Object.assign(new Error('Incomplete callback'),{code:'malformed'});
  if(result.error)throw result.error;
  if(!result.data.session)throw Object.assign(new Error('Missing callback session'),{code:'malformed'});
 })();pending.set(client,request);return request;
}
export const verificationResponse='If this address can receive a verification email, a link will arrive shortly. Check your inbox and spam folder.';
export async function resendVerification(client:SupabaseClient,email:string,origin:string){
 try{await startupDeadline(client.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:confirmationRedirect(origin)}}));}catch{/* Keep the same response for every account and failure. */}
 return verificationResponse;
}
