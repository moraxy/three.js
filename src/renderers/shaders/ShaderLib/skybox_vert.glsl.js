export default /* glsl */`
varying vec3 vWorldPosition;

#include <common>

void main() {

	vWorldPosition = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

	gl_Position.z = gl_Position.w; // set z to camera.far
	// important because otherwise the cube used for rendering the cubeMap might
	// get clipped

}
`;
