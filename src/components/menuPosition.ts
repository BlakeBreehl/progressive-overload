export function menuPosition(rect:{left:number;top:number;bottom:number;width:number},viewport:{left:number;top:number;width:number;height:number;layoutHeight:number}){
 const right=viewport.left+viewport.width,bottom=viewport.top+viewport.height,width=Math.min(Math.max(0,viewport.width-16),Math.max(rect.width,220));
 const belowSpace=bottom-rect.bottom-14,aboveSpace=rect.top-viewport.top-14,below=belowSpace>=240||belowSpace>=aboveSpace;
 const anchor=below?Math.max(viewport.top+8,Math.min(rect.bottom+6,bottom-52)):Math.max(viewport.top+52,Math.min(rect.top-6,bottom-8));
 return {position:'fixed' as const,left:Math.max(viewport.left+8,Math.min(rect.left,right-width-8)),width,top:below?anchor:undefined,bottom:below?undefined:viewport.layoutHeight-anchor,maxHeight:Math.max(0,Math.min(320,below?bottom-anchor-8:anchor-viewport.top-8))};
}
