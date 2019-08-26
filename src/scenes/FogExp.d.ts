import { Color } from './../math/Color';
import { IFog } from './Fog';
/**
 * This class contains the parameters that define exponential fog, i.e., that grows exponentially denser with the distance.
 */
export class FogExp implements IFog {

	constructor( hex: number | string, density?: number );

	name: string;
	color: Color;

	/**
	 * Defines how fast the fog will grow dense.
	 * Default is 0.015.
	 */
	density: number;

	clone(): this;
	toJSON(): any;

}
