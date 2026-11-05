import{o as h,t as w}from"./index-CsukEJ1c.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z",key:"1qvrer"}],["path",{d:"M6 17h12",key:"1jwigz"}]],I=h("chef-hat",f);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]],C=h("layout-dashboard",k);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],L=h("shield",M);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],z=h("trash-2",v),_=(i,c=800,a=800,s=.75)=>new Promise((o,g)=>{const y=new FileReader;y.readAsDataURL(i),y.onload=l=>{var m;const n=(m=l.target)==null?void 0:m.result;if(!n)return g(new Error("Failed to read file"));const r=new Image;r.src=n,r.onload=()=>{const d=document.createElement("canvas");let e=r.width,t=r.height;e>t?e>c&&(t=Math.round(t*c/e),e=c):t>a&&(e=Math.round(e*a/t),t=a),d.width=e,d.height=t;const p=d.getContext("2d");if(p){p.drawImage(r,0,0,e,t);const u=d.toDataURL("image/jpeg",s);o(u)}else o(n)},r.onerror=()=>o(n)},y.onerror=l=>g(l)}),N=async(i,c)=>{var s;const a=(s=i.target.files)==null?void 0:s[0];if(a)try{const o=await _(a);c(o),w.success("Imagen optimizada y cargada ✨")}catch{w.error("Error al procesar la imagen")}};export{I as C,C as L,L as S,z as T,_ as c,N as h};
