// Aurora ribbon shaders (GLSL). S0 is injected as a #define at compile time.
export const VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
export const FS=['precision mediump float;uniform vec2 r;uniform float t,h;',
'vec3 hsl(float H,float s,float l){vec3 k=clamp(abs(mod(H*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return l+s*(k-.5)*(1.-abs(2.*l-1.));}',
'void main(){vec2 u=gl_FragCoord.xy/r;float x=gl_FragCoord.x/S0,y=1.-u.y;',
'vec3 c=mix(hsl(fract((h+230.)/360.),.6,.07),hsl(fract((h+290.)/360.),.7,.10),(u.x+y)*.5);',
'for(int i=0;i<4;i++){float k=float(i),y0=.18+k*.17;',
'float w=y0+sin(x*.006+t*(.6+k*.17)+k)*.07+sin(x*.015-t*.9+k*2.)*.03;',
'float d=y-w;if(d>0.&&d<.25){float a=d<.0875?d/.0875:1.-(d-.0875)/.1625;',
'c+=hsl(fract((h+k*55.)/360.),.95,.6)*a*.26;}}',
'gl_FragColor=vec4(c,1.);}'].join('\n');
