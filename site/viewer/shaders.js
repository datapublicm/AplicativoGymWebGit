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
void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDirection = normalize(uLightDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float ambient = 0.46;
  float light = ambient + diffuse * 0.54;
  float rim = pow(1.0 - abs(normal.z), 2.0) * 0.055;
  gl_FragColor = vec4(uColor.rgb * light + vec3(rim), uColor.a);
}`;
