import { Color } from './../math/Color';
import { IFog } from './Fog';
/**
 * This class contains the parameters that define exponential squared fog, which gives a clear view near the camera and a faster than exponentially densening fog farther from the camera.
 */
export class FogExp2 implements IFog {

	constructor( hex: number | string, density?: number );

	name: string;
	color: Color;

	/**
	 * Defines how fast the fog will grow dense.
	 * Default is 0.00025.
	 */
	density: number;

	clone(): this;
	toJSON(): any;

}
