/** Position dialogs inside the visible viewport when an iOS keyboard opens. */
export function observeKeyboardViewport(){
 const viewport=window.visualViewport;if(!viewport)return()=>{};
 const update=()=>{document.documentElement.style.setProperty('--keyboard-height',`${viewport.height}px`);document.documentElement.style.setProperty('--keyboard-top',`${viewport.offsetTop}px`);};
 update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
 return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);document.documentElement.style.removeProperty('--keyboard-height');document.documentElement.style.removeProperty('--keyboard-top');};
}
