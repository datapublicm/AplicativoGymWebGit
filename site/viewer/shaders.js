export const VERTEX_SHADER_SOURCE = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uMvp;
uniform mat4 uModel;
varying vec3 vNormal;
void main() {
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;
export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 uColor;
uniform vec3 uLightDirection;
varying vec3 vNormal;
#define uKeyLightDirection uLightDirection
const vec3 uFillLightDirection = vec3(-0.58, 0.26, 0.76);
void main() {
  vec3 normal = normalize(vNormal);
  vec3 keyDirection = normalize(uKeyLightDirection);
  vec3 fillDirection = normalize(uFillLightDirection);
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);

  float keyDiffuse = max(dot(normal, keyDirection), 0.0);
  float fillDiffuse = max(dot(normal, fillDirection), 0.0);
  float light = 0.30 + keyDiffuse * 0.58 + fillDiffuse * 0.18;

  vec3 halfVector = normalize(keyDirection + viewDirection);
  float specular = pow(max(dot(normal, halfVector), 0.0), 24.0) * 0.16;
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2) * 0.10;

  vec3 shaded = uColor.rgb * light;
  shaded += vec3(specular + rim * 0.42);
  gl_FragColor = vec4(shaded, uColor.a);
}`;
