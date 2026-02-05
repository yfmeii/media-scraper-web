import{i as x,j as l}from"./UNimWYyO.js";function $(t){const n=t-1;return n*n*n+1}function S(t){return--t*t*t*t*t+1}function q(t,{delay:n=0,duration:s=400,easing:c=x}={}){const a=+getComputedStyle(t).opacity;return{delay:n,duration:s,easing:c,css:r=>`opacity: ${r*a}`}}function O(t,{delay:n=0,duration:s=400,easing:c=$,x:a=0,y:r=0,opacity:e=0}={}){const o=getComputedStyle(t),i=+o.opacity,f=o.transform==="none"?"":o.transform,y=i*(1-e),[p,u]=l(a),[d,g]=l(r);return{delay:n,duration:s,easing:c,css:(m,_)=>`
			transform: ${f} translate(${(1-m)*p}${u}, ${(1-m)*d}${g});
			opacity: ${i-y*_}`}}function U(t,{delay:n=0,duration:s=400,easing:c=$,start:a=0,opacity:r=0}={}){const e=getComputedStyle(t),o=+e.opacity,i=e.transform==="none"?"":e.transform,f=1-a,y=o*(1-r);return{delay:n,duration:s,easing:c,css:(p,u)=>`
			transform: ${i} scale(${1-f*u});
			opacity: ${o-y*u}
		`}}export{O as a,q as f,S as q,U as s};
