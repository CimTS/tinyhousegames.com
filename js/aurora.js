// Aurora "Kaleidoscope" ribbons background. WebGL, 0.5x res, 30 fps cap, pauses when hidden.
import { VS, FS } from './aurora-shader.js';

function start(){
var c=document.getElementById('aurora'),S=0.5,IV=1000/30;
var gl=c&&c.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
function off(){document.documentElement.className+=' no-gl'}
if(!gl)return off();
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
var pr=gl.createProgram();
gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));
gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'#define S0 '+S.toFixed(2)+'\n'+FS));
gl.bindAttribLocation(pr,0,"p");gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return off();
gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
var uR=gl.getUniformLocation(pr,'r'),uT=gl.getUniformLocation(pr,'t'),uH=gl.getUniformLocation(pr,'h');
var still=matchMedia('(prefers-reduced-motion: reduce)').matches,t=3,hue=200,last=0,run=false;
function size(){c.width=Math.max(1,innerWidth*S|0);c.height=Math.max(1,innerHeight*S|0);
gl.viewport(0,0,c.width,c.height);gl.uniform2f(uR,c.width,c.height)}
function draw(){gl.uniform1f(uT,t);gl.uniform1f(uH,hue);gl.drawArrays(gl.TRIANGLES,0,3)}
function frame(now){if(document.hidden||still){run=false;return}requestAnimationFrame(frame);
var dt=now-last;if(dt<IV-1)return;if(dt>250)dt=IV;last=now;
t+=dt/1000*.35;hue=(hue+dt/1000*6)%360;draw()}
function go(){if(!run&&!still&&!document.hidden){run=true;last=performance.now();requestAnimationFrame(frame)}}
addEventListener('resize',function(){size();draw()});
document.addEventListener('visibilitychange',go);
size();draw();go();
}
start();
