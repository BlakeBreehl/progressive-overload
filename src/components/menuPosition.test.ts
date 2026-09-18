import {expect,it} from 'vitest';
import {menuPosition} from './menuPosition';
it.each([320,360,375,390,393,412,430])('contains an oversized portal at %s px',width=>{const result=menuPosition({left:300,top:100,bottom:144,width:900},{left:0,top:0,width,height:568,layoutHeight:568});expect(result.left).toBeGreaterThanOrEqual(8);expect(result.left+result.width).toBeLessThanOrEqual(width-8);});
it('keeps the menu in the visual viewport above an iOS keyboard',()=>{const result=menuPosition({left:0,top:560,bottom:604,width:300},{left:0,top:200,width:375,height:400,layoutHeight:844});expect(result.bottom).toBe(290);expect(844-result.bottom!-result.maxHeight).toBeGreaterThanOrEqual(208);});
it('recomputes width and position when rotating or scrolling away from an anchor',()=>{const result=menuPosition({left:600,top:-200,bottom:-156,width:600},{left:0,top:0,width:320,height:568,layoutHeight:568});expect(result).toMatchObject({left:8,top:8,width:304,maxHeight:320});});
