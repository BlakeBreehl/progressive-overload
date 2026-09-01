import{describe,expect,it}from'vitest'
import app from'./App.tsx?raw';import auth from'./AuthScreen.tsx?raw';import settings from'./features/settings/SettingsPanel.tsx?raw';import manifest from'../public/manifest.webmanifest?raw';import sw from'../public/sw.js?raw'
describe('deployment-facing contracts',()=>{
 it('ships manual entry without the workbook importer',()=>{const shipped=app+settings;expect(shipped).not.toMatch(/Data Import|Import History|read-excel-file|features\/import|LazyImport/);expect(settings).toContain('Module Visibility');expect(settings).toContain('Locations');expect(settings).toContain('Manage Exercises &amp; Activities')})
 it('uses the canonical icon instead of a PO placeholder',()=>{expect(auth).toContain('/brand-icon.svg');expect(auth).not.toContain('>PO<');expect(manifest).toContain('/icons/icon-192.png');expect(manifest).toContain('/icons/icon-maskable-512.png');expect(manifest).toContain('"purpose":"maskable"');expect(sw).toContain('/brand-icon.svg')})
 it('contains no browser-native popup calls in active feature source',()=>{expect(app).not.toMatch(/\b(?:confirm|alert|prompt)\(/);expect(settings).not.toMatch(/\b(?:confirm|alert|prompt)\(/)})
})
