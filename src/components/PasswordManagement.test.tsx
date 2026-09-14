import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ForgotPassword,PasswordForm,RecoveryScreen} from './PasswordManagement';
import provider from '../lib/AuthProvider.tsx?raw';
import passwordSource from './PasswordManagement.tsx?raw';
import worker from '../../public/sw.js?raw';
it('renders labeled browser-password-manager fields and generic request UI',()=>{const client={} as never;const form=renderToStaticMarkup(<PasswordForm client={client} onDone={()=>{}}/>);expect(form).toContain('current-password');expect(form.match(/autoComplete="new-password"/g)).toHaveLength(2);expect(form).toContain('type="password"');expect(renderToStaticMarkup(<ForgotPassword client={client} onBack={()=>{}}/>)).toContain('Send reset link');});
it('provides dedicated loading, invalid and verified recovery screens',()=>{const props={client:{} as never,retry:()=>{}};expect(renderToStaticMarkup(<RecoveryScreen {...props} loading hasSession={false} invalid={false}/>)).toContain('Checking recovery session');const invalid=renderToStaticMarkup(<RecoveryScreen {...props} loading={false} hasSession={false} invalid/>);expect(invalid).toContain('Request a new link');expect(invalid).not.toContain('autoComplete="new-password"');expect(renderToStaticMarkup(<RecoveryScreen {...props} loading={false} hasSession invalid={false}/>)).toContain('Set New Password');});
it('gates the app behind recovery without custom credential persistence or API caching',()=>{expect(provider).toContain('recovery.active&&supabase?<RecoveryScreen');expect(provider).toContain('history.replaceState');expect(passwordSource).not.toMatch(/localStorage|sessionStorage|console\.|access_token|refresh_token/);expect(worker).toContain("url.pathname.startsWith('/auth/')");});
